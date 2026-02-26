"""
FinTechTerms Bot — Command Handlers
All Telegram command handlers, callbacks, and conversation flows.
"""

from __future__ import annotations

import logging
import random
from typing import Any

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
)
from bot.i18n import t
from bot.tts import generate_tts_audio

logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────
def _format_term_card(term: dict[str, Any], lang: str) -> str:
    """Format a term into a rich Telegram message."""
    cat = term.get("category", "Fintech")
    cat_emoji = CATEGORY_EMOJI.get(cat, "📖")

    # Choose definition and example based on language
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


def _term_keyboard(term: dict[str, Any], lang: str) -> InlineKeyboardMarkup:
    """Build inline keyboard for a term card."""
    term_id = term.get("id", "")
    buttons = [
        [
            InlineKeyboardButton(
                t("listen_button", lang),
                callback_data=f"tts:{term_id}:{lang}",
            ),
            InlineKeyboardButton(
                t("open_web", lang),
                url=f"{WEB_APP_URL}/term/{term_id}",
            ),
        ],
    ]
    return InlineKeyboardMarkup(buttons)


# ── /start ─────────────────────────────────────────────────
async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send welcome message with main menu."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = get_user_language(user_id)

    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("🔍 " + ("Поиск" if lang == "ru" else "Ara" if lang == "tr" else "Search"), callback_data="menu:search"),
                InlineKeyboardButton("📖 " + ("Термин дня" if lang == "ru" else "Günün Terimi" if lang == "tr" else "Daily Term"), callback_data="menu:daily"),
            ],
            [
                InlineKeyboardButton("🎯 " + ("Тест" if lang == "ru" else "Test" if lang == "tr" else "Quiz"), callback_data="menu:quiz"),
                InlineKeyboardButton("📊 " + ("Статистика" if lang == "ru" else "İstatistik" if lang == "tr" else "Stats"), callback_data="menu:stats"),
            ],
            [
                InlineKeyboardButton("🌍 " + ("Язык" if lang == "ru" else "Dil" if lang == "tr" else "Language"), callback_data="menu:lang"),
                InlineKeyboardButton("ℹ️ " + ("Помощь" if lang == "ru" else "Yardım" if lang == "tr" else "Help"), callback_data="menu:help"),
            ],
            [
                InlineKeyboardButton(
                    "🌐 " + t("open_web", lang),
                    url=WEB_APP_URL,
                ),
            ],
        ]
    )

    await update.message.reply_text(
        t("welcome", lang),
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
    )


# ── /search ────────────────────────────────────────────────
async def search_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Search for a term. Usage: /search <query>"""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = get_user_language(user_id)

    # Check if query is provided
    if not context.args:
        await update.message.reply_text(
            t("search_prompt", lang),
            parse_mode=ParseMode.HTML,
        )
        return

    query = " ".join(context.args)
    results = await search_terms(query, limit=5)

    if not results:
        await update.message.reply_text(
            t("search_no_results", lang, query=query),
            parse_mode=ParseMode.HTML,
        )
        return

    # Send header
    await update.message.reply_text(
        t("search_results_header", lang, count=len(results), query=query),
        parse_mode=ParseMode.HTML,
    )

    # Send each result as a card
    for term in results:
        text = _format_term_card(term, lang)
        keyboard = _term_keyboard(term, lang)
        await update.message.reply_text(
            text,
            parse_mode=ParseMode.HTML,
            reply_markup=keyboard,
        )


# ── /daily ─────────────────────────────────────────────────
async def daily_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a random term of the day."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = get_user_language(user_id)

    term = await get_random_term()
    if not term:
        await update.message.reply_text(t("error", lang), parse_mode=ParseMode.HTML)
        return

    header = t("daily_header", lang)
    card = _format_term_card(term, lang)
    keyboard = _term_keyboard(term, lang)

    # Add "Next" button for another random term
    buttons = keyboard.inline_keyboard + [
        [InlineKeyboardButton(t("next_term", lang), callback_data="daily:next")]
    ]

    await update.message.reply_text(
        f"{header}\n\n{card}",
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(buttons),
    )


# ── /quiz ──────────────────────────────────────────────────
async def quiz_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Start an inline quiz with 4 options."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = get_user_language(user_id)

    all_terms = await fetch_all_terms()
    if len(all_terms) < 4:
        await update.message.reply_text(
            t("quiz_no_terms", lang), parse_mode=ParseMode.HTML
        )
        return

    # Pick a random term as the correct answer
    correct_term = random.choice(all_terms)
    term_key = f"term_{lang}"
    def_key = f"definition_{lang}"

    correct_def = correct_term.get(def_key) or correct_term.get("definition_en", "—")

    # Pick 3 wrong definitions
    wrong_terms = random.sample(
        [t_item for t_item in all_terms if t_item["id"] != correct_term["id"]],
        min(3, len(all_terms) - 1),
    )
    wrong_defs = [
        wt.get(def_key) or wt.get("definition_en", "—") for wt in wrong_terms
    ]

    # Shuffle options
    options = [(correct_def, True)] + [(wd, False) for wd in wrong_defs]
    random.shuffle(options)

    # Build keyboard
    keyboard_buttons = []
    for i, (option_text, is_correct) in enumerate(options):
        # Truncate long definitions for button text
        short = option_text[:80] + "…" if len(option_text) > 80 else option_text
        cb_data = f"quiz:{'1' if is_correct else '0'}:{correct_term['id']}"
        keyboard_buttons.append(
            [InlineKeyboardButton(f"{chr(65 + i)}) {short}", callback_data=cb_data)]
        )

    term_display = correct_term.get(term_key) or correct_term.get("term_en", "—")

    await update.message.reply_text(
        t("quiz_question", lang, term=term_display),
        parse_mode=ParseMode.HTML,
        reply_markup=InlineKeyboardMarkup(keyboard_buttons),
    )


# ── /lang ──────────────────────────────────────────────────
async def lang_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show language selection buttons."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = get_user_language(user_id)

    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("🇷🇺 Русский", callback_data="lang:ru"),
                InlineKeyboardButton("🇬🇧 English", callback_data="lang:en"),
                InlineKeyboardButton("🇹🇷 Türkçe", callback_data="lang:tr"),
            ]
        ]
    )

    await update.message.reply_text(
        t("lang_prompt", lang),
        parse_mode=ParseMode.HTML,
        reply_markup=keyboard,
    )


# ── /stats ─────────────────────────────────────────────────
async def stats_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Display database statistics."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = get_user_language(user_id)

    total = await get_term_count()
    cats = await get_category_counts()

    text = t("stats_header", lang, total=total)
    for cat_name, count in sorted(cats.items()):
        emoji = CATEGORY_EMOJI.get(cat_name, "📖")
        text += "\n" + t("stats_category", lang, emoji=emoji, name=cat_name, count=count)

    text += f"\n\n🌐 {WEB_APP_URL}"

    await update.message.reply_text(text, parse_mode=ParseMode.HTML)


# ── /help ──────────────────────────────────────────────────
async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show help text."""
    if not update.effective_user or not update.message:
        return

    lang = get_user_language(update.effective_user.id)
    await update.message.reply_text(t("help", lang), parse_mode=ParseMode.HTML)


# ── Callback Query Handler ─────────────────────────────────
async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle all inline keyboard callbacks."""
    query = update.callback_query
    if not query or not query.data or not update.effective_user:
        return

    await query.answer()
    user_id = update.effective_user.id
    lang = get_user_language(user_id)
    data = query.data

    # ── Menu callbacks ──
    if data == "menu:search":
        await query.message.reply_text(  # type: ignore[union-attr]
            t("search_prompt", lang), parse_mode=ParseMode.HTML
        )

    elif data == "menu:daily":
        term = await get_random_term()
        if term:
            header = t("daily_header", lang)
            card = _format_term_card(term, lang)
            keyboard = _term_keyboard(term, lang)
            buttons = keyboard.inline_keyboard + [
                [InlineKeyboardButton(t("next_term", lang), callback_data="daily:next")]
            ]
            await query.message.reply_text(  # type: ignore[union-attr]
                f"{header}\n\n{card}",
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup(buttons),
            )

    elif data == "daily:next":
        term = await get_random_term()
        if term:
            header = t("daily_header", lang)
            card = _format_term_card(term, lang)
            keyboard = _term_keyboard(term, lang)
            buttons = keyboard.inline_keyboard + [
                [InlineKeyboardButton(t("next_term", lang), callback_data="daily:next")]
            ]
            await query.message.reply_text(  # type: ignore[union-attr]
                f"{header}\n\n{card}",
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup(buttons),
            )

    elif data == "menu:quiz":
        all_terms = await fetch_all_terms()
        if len(all_terms) >= 4:
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
            keyboard_buttons = []
            for i, (opt, is_c) in enumerate(options):
                short = opt[:80] + "…" if len(opt) > 80 else opt
                keyboard_buttons.append(
                    [InlineKeyboardButton(f"{chr(65 + i)}) {short}", callback_data=f"quiz:{'1' if is_c else '0'}:{correct_term['id']}")]
                )
            term_display = correct_term.get(term_key) or correct_term.get("term_en", "—")
            await query.message.reply_text(  # type: ignore[union-attr]
                t("quiz_question", lang, term=term_display),
                parse_mode=ParseMode.HTML,
                reply_markup=InlineKeyboardMarkup(keyboard_buttons),
            )

    elif data == "menu:stats":
        total = await get_term_count()
        cats = await get_category_counts()
        text = t("stats_header", lang, total=total)
        for cat_name, count in sorted(cats.items()):
            emoji = CATEGORY_EMOJI.get(cat_name, "📖")
            text += "\n" + t("stats_category", lang, emoji=emoji, name=cat_name, count=count)
        text += f"\n\n🌐 {WEB_APP_URL}"
        await query.message.reply_text(text, parse_mode=ParseMode.HTML)  # type: ignore[union-attr]

    elif data == "menu:lang":
        keyboard = InlineKeyboardMarkup(
            [[
                InlineKeyboardButton("🇷🇺 Русский", callback_data="lang:ru"),
                InlineKeyboardButton("🇬🇧 English", callback_data="lang:en"),
                InlineKeyboardButton("🇹🇷 Türkçe", callback_data="lang:tr"),
            ]]
        )
        await query.message.reply_text(  # type: ignore[union-attr]
            t("lang_prompt", lang), parse_mode=ParseMode.HTML, reply_markup=keyboard
        )

    elif data == "menu:help":
        await query.message.reply_text(  # type: ignore[union-attr]
            t("help", lang), parse_mode=ParseMode.HTML
        )

    # ── Language selection callback ──
    elif data.startswith("lang:"):
        new_lang = data.split(":")[1]
        if new_lang in SUPPORTED_LANGUAGES:
            set_user_language(user_id, new_lang)
            await query.message.reply_text(  # type: ignore[union-attr]
                t("lang_changed", new_lang), parse_mode=ParseMode.HTML
            )

    # ── Quiz answer callback ──
    elif data.startswith("quiz:"):
        parts = data.split(":")
        is_correct = parts[1] == "1"
        term_id = parts[2] if len(parts) > 2 else ""

        if is_correct:
            await query.message.reply_text(  # type: ignore[union-attr]
                t("quiz_correct", lang),
                parse_mode=ParseMode.HTML,
            )
        else:
            from bot.database import fetch_term_by_id

            term = await fetch_term_by_id(term_id) if term_id else None
            def_key = f"definition_{lang}"
            answer = (
                term.get(def_key, term.get("definition_en", "—"))
                if term
                else "—"
            )
            await query.message.reply_text(  # type: ignore[union-attr]
                t("quiz_wrong", lang, answer=answer),
                parse_mode=ParseMode.HTML,
            )

    # ── TTS callback ──
    elif data.startswith("tts:"):
        parts = data.split(":")
        term_id = parts[1] if len(parts) > 1 else ""
        tts_lang = parts[2] if len(parts) > 2 else lang

        from bot.database import fetch_term_by_id

        term = await fetch_term_by_id(term_id) if term_id else None
        if term:
            term_key = f"term_{tts_lang}"
            text_to_speak = term.get(term_key) or term.get("term_en", "")
            if text_to_speak:
                try:
                    audio_path = await generate_tts_audio(text_to_speak, tts_lang)
                    if audio_path:
                        with open(audio_path, "rb") as audio_file:
                            await query.message.reply_voice(  # type: ignore[union-attr]
                                voice=audio_file,
                                caption=f"🔊 {text_to_speak}",
                            )
                    else:
                        await query.message.reply_text(  # type: ignore[union-attr]
                            "⚠️ TTS unavailable."
                        )
                except Exception as e:
                    logger.error("TTS error: %s", e)
                    await query.message.reply_text(  # type: ignore[union-attr]
                        t("error", lang), parse_mode=ParseMode.HTML
                    )


# ── Plain text handler (for search without /command) ───────
async def text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle plain text messages as search queries."""
    if not update.effective_user or not update.message or not update.message.text:
        return

    user_id = update.effective_user.id
    lang = get_user_language(user_id)
    query = update.message.text.strip()

    if not query or query.startswith("/"):
        return

    results = await search_terms(query, limit=3)

    if not results:
        await update.message.reply_text(
            t("search_no_results", lang, query=query),
            parse_mode=ParseMode.HTML,
        )
        return

    await update.message.reply_text(
        t("search_results_header", lang, count=len(results), query=query),
        parse_mode=ParseMode.HTML,
    )

    for term in results:
        text = _format_term_card(term, lang)
        keyboard = _term_keyboard(term, lang)
        await update.message.reply_text(
            text,
            parse_mode=ParseMode.HTML,
            reply_markup=keyboard,
        )
