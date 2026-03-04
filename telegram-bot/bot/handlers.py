"""
FinTechTerms Bot — Command Handlers
Single-message navigation: all callbacks edit the existing message
instead of creating new ones, keeping the chat clean.
"""

from __future__ import annotations

import asyncio
import html
import logging
import random
import time

from typing import Any

import telegram.error
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
)
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from bot.config import CATEGORY_EMOJI, WEB_APP_URL, SUPPORTED_LANGUAGES
from bot.database import (
    search_terms,
    get_random_term,
    get_user_language,
    set_user_language,
    get_term_count,
    get_category_counts,
    fetch_all_terms,
    fetch_term_by_id,
    track_activity,
    get_user_report,
    save_username,
    generate_link_token,
    get_user_favorites,
)
from bot.i18n import t
from bot.tts import generate_tts_audio
from bot.rate_limiter import is_rate_limited

logger = logging.getLogger(__name__)

# ── Helpers ────────────────────────────────────────────────
def sanitize_input(user_input: str) -> str:
    """
    Sanitize user input against SQL wildcards and HTML injections.
    Prevents DB full-table scans and Telegram ParseMode.HTML crashes.
    """
    if not user_input:
        return ""
    # Strip wildcards for the .ilike or fuzzy matching
    safe_query = user_input.replace("%", "").replace("_", "")
    # Escape so malicious brackets don't break Telegram HTML
    return html.escape(safe_query.strip())


def _format_term_card(term: dict[str, Any], lang: str) -> str:
    """Format a term into a rich Telegram message."""
    cat = term.get("category", "Fintech")
    cat_emoji = CATEGORY_EMOJI.get(cat, "📖")

    def_key = f"definition_{lang}"
    ex_key = f"example_{lang}"
    definition = term.get(def_key) or term.get("definition_en", "—")
    example = term.get(ex_key) or term.get("example_en", "—")

    return t(
        "term_card",
        lang,
        cat_emoji=cat_emoji,
        category=cat,
        term_en=term.get("term_en", "—"),
        term_tr=term.get("term_tr", "—"),
        term_ru=term.get("term_ru", "—"),
        definition=definition,
        example=example,
    )


def _back_button(lang: str) -> InlineKeyboardButton:
    """Create a standardised back-to-menu button."""
    label = "🔙 Меню" if lang == "ru" else "🔙 Menü" if lang == "tr" else "🔙 Menu"
    return InlineKeyboardButton(label, callback_data="menu:main")


def _main_menu_keyboard(lang: str) -> InlineKeyboardMarkup:
    """Build the main menu inline keyboard."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "🔍 " + ("Поиск" if lang == "ru" else "Ara" if lang == "tr" else "Search"),
                    callback_data="menu:search",
                ),
                InlineKeyboardButton(
                    "📖 " + ("Термин дня" if lang == "ru" else "Günün Terimi" if lang == "tr" else "Daily Term"),
                    callback_data="menu:daily",
                ),
            ],
            [
                InlineKeyboardButton(
                    "🎯 " + ("Тест" if lang == "ru" else "Test" if lang == "tr" else "Quiz"),
                    callback_data="menu:quiz",
                ),
                InlineKeyboardButton(
                    "📋 " + ("Отчёт" if lang == "ru" else "Rapor" if lang == "tr" else "Report"),
                    callback_data="menu:report",
                ),
            ],
            [
                InlineKeyboardButton(
                    "📊 " + ("Статистика" if lang == "ru" else "İstatistik" if lang == "tr" else "Stats"),
                    callback_data="menu:stats",
                ),
                InlineKeyboardButton(
                    "🔗 " + ("Связать аккаунт" if lang == "ru" else "Bağla" if lang == "tr" else "Link Account"),
                    callback_data="menu:link",
                ),
            ],
            [
                InlineKeyboardButton(
                    "🌍 " + ("Язык" if lang == "ru" else "Dil" if lang == "tr" else "Language"),
                    callback_data="menu:lang",
                ),
                InlineKeyboardButton(
                    "ℹ️ " + ("Помощь" if lang == "ru" else "Yardım" if lang == "tr" else "Help"),
                    callback_data="menu:help",
                ),
            ],
            [
                InlineKeyboardButton(
                    "⭐ " + ("Избранные" if lang == "ru" else "Favoriler" if lang == "tr" else "Favorites"),
                    callback_data="menu:favorites",
                ),
                InlineKeyboardButton("🌐 " + t("open_web", lang), url=WEB_APP_URL),
            ],
        ]
    )


def _term_keyboard(term: dict[str, Any], lang: str) -> InlineKeyboardMarkup:
    """Build inline keyboard for a term card."""
    term_id = term.get("id", "")
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    t("listen_button", lang), callback_data=f"tts:{term_id}:{lang}"
                ),
                InlineKeyboardButton(
                    t("open_web", lang), url=f"{WEB_APP_URL}/term/{term_id}"
                ),
            ],
            [
                InlineKeyboardButton(
                    t("next_term", lang), callback_data="daily:next"
                ),
                _back_button(lang),
            ],
        ]
    )


# ── /start — only command that sends a NEW message ────────
async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send welcome message with main menu (initial message)."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = await get_user_language(user_id)

    # Persist Telegram username for admin dashboard
    await save_username(user_id, update.effective_user.username)

    await update.message.reply_text(
        t("welcome", lang),
        parse_mode=ParseMode.HTML,
        reply_markup=_main_menu_keyboard(lang),
    )


# ── /search ────────────────────────────────────────────────
async def search_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Search for a term. Usage: /search <query>"""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = await get_user_language(user_id)

    if await is_rate_limited(user_id):
        # Ignore silently to prevent spam feedback loops
        return

    if not context.args:
        await update.message.reply_text(
            t("search_prompt", lang),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        )
        return

    raw_query = " ".join(context.args)
    query = sanitize_input(raw_query)
    
    if not query:
        await update.message.reply_text(
            t("search_prompt", lang),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        )
        return

    try:
        results = await search_terms(query, limit=3)
    except ConnectionError:
        await update.message.reply_text(
            "⏳ Sistem şu an yoğun, lütfen daha sonra tekrar deneyin.",
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        )
        return

    await track_activity(user_id, "search")

    if not results:
        await update.message.reply_text(
            t("search_no_results", lang, query=query),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        )
        return

    # Show first result as card
    term = results[0]
    header = t("search_results_header", lang, count=len(results), query=query)
    card = _format_term_card(term, lang)
    await update.message.reply_text(
        f"{header}\n\n{card}",
        parse_mode=ParseMode.HTML,
        reply_markup=_term_keyboard(term, lang),
    )


# ── /daily ─────────────────────────────────────────────────
async def daily_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a random term of the day."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = await get_user_language(user_id)

    if await is_rate_limited(user_id):
        return

    try:
        term = await get_random_term()
    except ConnectionError:
        await update.message.reply_text(
            "⏳ Sistem şu an yoğun, lütfen daha sonra tekrar deneyin."
        )
        return

    if not term:
        await update.message.reply_text(t("error", lang), parse_mode=ParseMode.HTML)
        return

    await track_activity(user_id, "daily")
    await track_activity(user_id, "term_viewed", category=term.get("category", ""))

    header = t("daily_header", lang)
    card = _format_term_card(term, lang)

    await update.message.reply_text(
        f"{header}\n\n{card}",
        parse_mode=ParseMode.HTML,
        reply_markup=_term_keyboard(term, lang),
    )


# ── /quiz ──────────────────────────────────────────────────
async def quiz_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Start an inline quiz."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = await get_user_language(user_id)

    if await is_rate_limited(user_id):
        return

    try:
        text, keyboard = await _build_quiz(lang)
    except ConnectionError:
        await update.message.reply_text(
            "⏳ Sistem şu an yoğun, lütfen daha sonra tekrar deneyin."
        )
        return

    if text:
        await update.message.reply_text(
            text, parse_mode=ParseMode.HTML, reply_markup=keyboard
        )
    else:
        await update.message.reply_text(
            t("quiz_no_terms", lang), parse_mode=ParseMode.HTML
        )


async def _build_quiz(lang: str) -> tuple[str | None, InlineKeyboardMarkup | None]:
    """Build quiz question text and keyboard. Returns (text, keyboard) or (None, None)."""
    all_terms = await fetch_all_terms()
    if len(all_terms) < 4:
        return None, None

    correct_term = random.choice(all_terms)
    term_key = f"term_{lang}"
    def_key = f"definition_{lang}"

    correct_def = correct_term.get(def_key) or correct_term.get("definition_en", "—")

    wrong_terms = random.sample(
        [ti for ti in all_terms if ti["id"] != correct_term["id"]],
        min(3, len(all_terms) - 1),
    )
    wrong_defs = [wt.get(def_key) or wt.get("definition_en", "—") for wt in wrong_terms]

    options = [(correct_def, True)] + [(wd, False) for wd in wrong_defs]
    random.shuffle(options)

    buttons = []
    for i, (opt, is_correct) in enumerate(options):
        short = opt[:80] + "…" if len(opt) > 80 else opt
        buttons.append(
            [
                InlineKeyboardButton(
                    f"{chr(65 + i)}) {short}",
                    callback_data=f"quiz:{'1' if is_correct else '0'}:{correct_term['id']}",
                )
            ]
        )
    buttons.append([_back_button(lang)])

    term_display = correct_term.get(term_key) or correct_term.get("term_en", "—")
    text = t("quiz_question", lang, term=term_display)

    return text, InlineKeyboardMarkup(buttons)


# ── /lang ──────────────────────────────────────────────────
async def lang_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return
    lang = await get_user_language(update.effective_user.id)
    await update.message.reply_text(
        t("lang_prompt", lang),
        parse_mode=ParseMode.HTML,
        reply_markup=_lang_keyboard(lang),
    )


def _lang_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("🇷🇺 Русский", callback_data="lang:ru"),
                InlineKeyboardButton("🇬🇧 English", callback_data="lang:en"),
                InlineKeyboardButton("🇹🇷 Türkçe", callback_data="lang:tr"),
            ],
            [_back_button(lang)],
        ]
    )


# ── /stats ─────────────────────────────────────────────────
async def stats_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return
    user_id = update.effective_user.id
    lang = await get_user_language(user_id)
    text = await _build_stats_text(lang)
    await update.message.reply_text(
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
    )


async def _build_stats_text(lang: str) -> str:
    total = await get_term_count()
    cats = await get_category_counts()
    text = t("stats_header", lang, total=total)
    for cat_name, count in sorted(cats.items()):
        emoji = CATEGORY_EMOJI.get(cat_name, "📖")
        text += "\n" + t("stats_category", lang, emoji=emoji, name=cat_name, count=count)
    text += f"\n\n🌐 {WEB_APP_URL}"
    return text


# ── /help ──────────────────────────────────────────────────
async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return
    lang = await get_user_language(update.effective_user.id)
    await update.message.reply_text(
        t("help", lang),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
    )


# ── /report ────────────────────────────────────────────────
async def report_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show user's activity report."""
    if not update.effective_user or not update.message:
        return
    user_id = update.effective_user.id
    lang = await get_user_language(user_id)
    text = await _build_report_text(user_id, lang)
    await update.message.reply_text(
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
    )


async def _build_report_text(user_id: int, lang: str) -> str:
    """Build a rich activity report for the user."""
    report = await get_user_report(user_id)
    
    # Fallback to defaults to prevent silent crash if DB/cache is empty
    if not report:
        report = {
            "searches": 0, "quizzes_taken": 0, "quizzes_correct": 0, "accuracy": 0,
            "terms_viewed": 0, "daily_used": 0, "tts_used": 0, "categories_explored": 0, "session_start": ""
        }

    # Build accuracy progress bar (10 blocks)
    filled = report.get("accuracy", 0) // 10
    bar = "█" * filled + "░" * (10 - filled)

    # Choose smart tip based on weakest area
    total_actions = (
        report["searches"] + report["quizzes_taken"] + report["daily_used"]
    )
    if total_actions >= 10:
        tip = t("report_tip_great", lang)
    elif report["searches"] == 0:
        tip = t("report_tip_search", lang)
    elif report["quizzes_taken"] < 3:
        tip = t("report_tip_quiz", lang)
    else:
        tip = t("report_tip_daily", lang)

    header = t("report_header", lang)
    body = t(
        "report_body",
        lang,
        searches=report["searches"],
        terms_viewed=report["terms_viewed"],
        daily_used=report["daily_used"],
        tts_used=report["tts_used"],
        categories=report["categories_explored"],
        quizzes_taken=report["quizzes_taken"],
        quizzes_correct=report["quizzes_correct"],
        accuracy=report["accuracy"],
        accuracy_bar=bar,
        tip=tip,
    )
    return header + body


async def _build_link_text(user_id: int, lang: str) -> str | None:
    """Generate an OTP token and string template for linking to the Web App."""
    token = await generate_link_token(user_id)
    if not token:
        return None
        
    text_parts = {
        "tr": (
            f"🔗 <b>Hesap Birleştirme (Kodu Kopyala)</b>\n\n"
            f"Web sitesinde ilerlemenizi senkronize etmek için aşağıdaki kodu kullanın:\n\n"
            f"<code>{token}</code>\n\n"
            f"<i>⚠️ Bu kod 15 dakika geçerlidir.</i>"
        ),
        "ru": (
            f"🔗 <b>Связывание аккаунтов (Скопируйте код)</b>\n\n"
            f"Используйте следующий код на сайте, чтобы синхронизировать прогресс:\n\n"
            f"<code>{token}</code>\n\n"
            f"<i>⚠️ Код действителен 15 минут.</i>"
        ),
        "en": (
            f"🔗 <b>Account Linking (Copy Code)</b>\n\n"
            f"Use the following code on the website to sync your progress:\n\n"
            f"<code>{token}</code>\n\n"
            f"<i>⚠️ This code is valid for 15 minutes.</i>"
        )
    }
    
    return text_parts.get(lang, text_parts["en"])


# ── /link ──────────────────────────────────────────────────
async def link_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Generate an OTP token for linking to the Web App via command."""
    if not update.effective_user or not update.message:
        return
    user_id = update.effective_user.id
    lang = await get_user_language(user_id)
    
    text = await _build_link_text(user_id, lang)
    if not text:
        await update.message.reply_text(
            "⏳ Sistem şu an yoğun, lütfen daha sonra tekrar deneyin.",
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        )
        return
        
    await update.message.reply_text(
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
    )


# ── /favorites ────────────────────────────────────────────
async def favorites_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show the user's favorite terms from the web app."""
    if not update.effective_user or not update.message:
        return
    user_id = update.effective_user.id
    lang = await get_user_language(user_id)

    if await is_rate_limited(user_id):
        return

    text = await _build_favorites_text(user_id, lang)
    await update.message.reply_text(
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
    )


async def _build_favorites_text(telegram_id: int, lang: str) -> str:
    """Build a formatted list of the user's favorite terms."""
    try:
        favorites = await get_user_favorites(telegram_id)
    except Exception:
        return t("error", lang)

    if not favorites:
        return t("favorites_empty", lang)

    # Limit display to first 10 to avoid Telegram message length limits
    display_limit = 10
    display_terms = favorites[:display_limit]

    header = t("favorites_header", lang, count=len(favorites))
    items = ""
    for i, term in enumerate(display_terms, 1):
        cat = term.get("category", "Fintech")
        cat_emoji = CATEGORY_EMOJI.get(cat, "📖")
        items += t(
            "favorites_item",
            lang,
            num=i,
            cat_emoji=cat_emoji,
            term_en=term.get("term_en", "—"),
            term_tr=term.get("term_tr", "—"),
            term_ru=term.get("term_ru", "—"),
        )

    footer = t("favorites_footer", lang)

    overflow = ""
    if len(favorites) > display_limit:
        remaining = len(favorites) - display_limit
        overflow_texts = {
            "ru": f"\n\n<i>... и ещё {remaining} терминов на сайте</i>",
            "en": f"\n\n<i>... and {remaining} more on the website</i>",
            "tr": f"\n\n<i>... ve {remaining} terim daha sitede</i>",
        }
        overflow = overflow_texts.get(lang, overflow_texts["en"])

    return header + items + overflow + footer


# ══════════════════════════════════════════════════════════
#  CALLBACK QUERY HANDLER  — edits the EXISTING message
# ══════════════════════════════════════════════════════════
async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Route all inline keyboard callbacks. Edits the original message in place."""
    query = update.callback_query
    if not query or not query.data or not update.effective_user:
        return

    await query.answer()
    user_id = update.effective_user.id
    lang = await get_user_language(user_id)
    data = query.data

    try:
        # ── Back to main menu ──
        if data == "menu:main":
            await query.edit_message_text(
                t("welcome", lang),
                parse_mode=ParseMode.HTML,
                reply_markup=_main_menu_keyboard(lang),
            )

        # ── Search prompt ──
        elif data == "menu:search":
            await query.edit_message_text(
                t("search_prompt", lang),
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            )

        # ── Daily term ──
        elif data in ("menu:daily", "daily:next"):
            term = await get_random_term()
            if term:
                await track_activity(user_id, "daily")
                await track_activity(user_id, "term_viewed", category=term.get("category", ""))
                header = t("daily_header", lang)
                card = _format_term_card(term, lang)
                await query.edit_message_text(
                    f"{header}\n\n{card}",
                    parse_mode=ParseMode.HTML,
                    reply_markup=_term_keyboard(term, lang),
                )

        # ── Quiz ──
        elif data == "menu:quiz":
            text, keyboard = await _build_quiz(lang)
            if text and keyboard:
                await query.edit_message_text(
                    text, parse_mode=ParseMode.HTML, reply_markup=keyboard
                )

        # ── Stats ──
        elif data == "menu:stats":
            text = await _build_stats_text(lang)
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            )

        # ── Language selection menu ──
        elif data == "menu:lang":
            await query.edit_message_text(
                t("lang_prompt", lang),
                parse_mode=ParseMode.HTML,
                reply_markup=_lang_keyboard(lang),
            )

        # ── Report ──
        elif data == "menu:report":
            text = await _build_report_text(user_id, lang)
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            )

        # ── Link ──
        elif data == "menu:link":
            text = await _build_link_text(user_id, lang)
            if not text:
                text = "⏳ Sistem şu an yoğun, lütfen daha sonra tekrar deneyin."
                
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            )

        # ── Help ──
        elif data == "menu:help":
            await query.edit_message_text(
                t("help", lang),
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            )

        # ── Favorites ──
        elif data == "menu:favorites":
            text = await _build_favorites_text(user_id, lang)
            await query.edit_message_text(
                text,
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            )

        # ── Language change ──
        elif data.startswith("lang:"):
            new_lang = data.split(":")[1]
            if new_lang in SUPPORTED_LANGUAGES:
                await set_user_language(user_id, new_lang)
                # After changing language, show welcome in the new language
                await query.edit_message_text(
                    t("lang_changed", new_lang) + "\n\n" + t("welcome", new_lang),
                    parse_mode=ParseMode.HTML,
                    reply_markup=_main_menu_keyboard(new_lang),
                )

        # ── Quiz answer ──
        elif data.startswith("quiz:"):
            parts = data.split(":")
            is_correct = parts[1] == "1"
            term_id = parts[2] if len(parts) > 2 else ""

            if is_correct:
                result_text = t("quiz_correct", lang)
                await track_activity(user_id, "quiz_taken", correct=True, term_id=term_id)
            else:
                await track_activity(user_id, "quiz_taken", correct=False, term_id=term_id)
                term = await fetch_term_by_id(term_id) if term_id else None
                def_key = f"definition_{lang}"
                answer = (
                    term.get(def_key, term.get("definition_en", "—")) if term else "—"
                )
                result_text = t("quiz_wrong", lang, answer=answer)

            # Show result + offer next quiz or back to menu
            await query.edit_message_text(
                result_text,
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup(
                    [
                        [
                            InlineKeyboardButton(
                                "🎯 " + ("Ещё тест" if lang == "ru" else "Tekrar test" if lang == "tr" else "Next quiz"),
                                callback_data="menu:quiz",
                            ),
                            _back_button(lang),
                        ]
                    ]
                ),
            )

        # ── TTS — this one sends a voice message (can't edit into voice) ──
        elif data.startswith("tts:"):
            parts = data.split(":")
            term_id = parts[1] if len(parts) > 1 else ""
            tts_lang = parts[2] if len(parts) > 2 else lang

            term = await fetch_term_by_id(term_id) if term_id else None
            if term:
                term_key = f"term_{tts_lang}"
                text_to_speak = term.get(term_key) or term.get("term_en", "")
                if text_to_speak:
                    try:
                        loading_msg = await query.message.reply_text("⏳ İşleminiz hazırlanıyor...") # type: ignore
                        audio_path = await generate_tts_audio(text_to_speak, tts_lang)
                        await loading_msg.delete()

                        if audio_path:
                            await track_activity(user_id, "tts")
                            with open(audio_path, "rb") as audio_file:
                                sent = await query.message.reply_voice(  # type: ignore[union-attr]
                                    voice=audio_file,
                                    caption=f"🔊 {text_to_speak}",
                                )

                                # Auto-delete voice after 10 seconds to keep chat clean
                                asyncio.create_task(_delete_later(sent, 10))
                    except Exception as e:
                        logger.error("TTS error: %s", e)

    except telegram.error.BadRequest as e:
        logger.warning("Callback edit failed (BadRequest): %s", e)
    except telegram.error.TimedOut as e:
        logger.warning("Callback timed out: %s", e)
    except Exception as e:
        logger.warning("Callback unexpected error: %s", e)


async def _delete_later(message: Any, delay: float) -> None:
    """Delete a message after a delay (fire-and-forget)."""
    await asyncio.sleep(delay)
    try:
        await message.delete()
    except Exception as e:
        logger.debug("Auto-delete failed (message may have been deleted already): %s", e)


# ── Plain text handler (search by typing) ──────────────────
async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle plain text messages as search queries."""
    if not update.effective_user or not update.message or not update.message.text:
        return

    user_id = update.effective_user.id
    if await is_rate_limited(user_id):
        return

    lang = await get_user_language(user_id)
    raw_query = update.message.text.strip()

    if not raw_query or raw_query.startswith("/"):
        return

    query = sanitize_input(raw_query)
    if not query:
        return

    try:
        results = await search_terms(query, limit=3)
    except ConnectionError:
        await update.message.reply_text(
            "⏳ Sistem şu an yoğun, lütfen daha sonra tekrar deneyin.",
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        )
        return

    if not results:
        await update.message.reply_text(
            t("search_no_results", lang, query=query),
            parse_mode=ParseMode.HTML,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        )
        return

    term = results[0]
    header = t("search_results_header", lang, count=len(results), query=query)
    card = _format_term_card(term, lang)
    await update.message.reply_text(
        f"{header}\n\n{card}",
        parse_mode=ParseMode.HTML,
        reply_markup=_term_keyboard(term, lang),
    )
