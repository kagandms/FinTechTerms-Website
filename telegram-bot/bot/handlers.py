"""
FinTechTerms Bot — Command Handlers
Single-message navigation: all callbacks edit the existing message
instead of creating new ones, keeping the chat clean.
"""

from __future__ import annotations

import asyncio
import html
import logging
import time

from typing import Any

import telegram.error
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

from bot.config import CATEGORY_EMOJI, WEB_APP_URL, SUPPORTED_LANGUAGES, config
from bot.db_stats import (
    get_term_count,
    get_category_counts,
)
from bot.db_terms import (
    search_terms,
    get_random_term,
    fetch_term_by_id,
)
from bot.i18n import t
from bot.quiz import build_quiz
from bot.tts import generate_tts_audio
from bot.rate_limiter import is_rate_limited

logger = logging.getLogger(__name__)

MAX_TELEGRAM_MESSAGE_LENGTH = 3900
PAGINATION_STORE_KEY = "paginated_messages"
MAX_PAGINATION_SESSIONS = 20
LANGUAGE_OVERRIDE_KEY = "ui_language"

START_WELCOME_TEXT = (
    "🇷🇺 <b>Привет! Добро пожаловать в FinTechTerms.</b>\n"
    "🇹🇷 FinTechTerms'e hoş geldiniz.\n"
    "🇬🇧 Welcome to FinTechTerms."
)

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


def _normalize_telegram_language(language_code: str | None) -> str:
    if isinstance(language_code, str):
        normalized = language_code.strip().lower()
        for supported in SUPPORTED_LANGUAGES:
            if normalized == supported or normalized.startswith(f"{supported}-"):
                return supported

    if config.default_language in SUPPORTED_LANGUAGES:
        return config.default_language

    return "ru"


def _resolve_lang(update: Update, context: ContextTypes.DEFAULT_TYPE) -> str:
    override = context.user_data.get(LANGUAGE_OVERRIDE_KEY)
    if isinstance(override, str) and override in SUPPORTED_LANGUAGES:
        return override

    language_code = update.effective_user.language_code if update.effective_user else None
    return _normalize_telegram_language(language_code)


def _localize_context_value(value: Any, lang: str) -> str:
    localized = {
        "ru": {
            "economics": "Экономика",
            "mis": "MIS",
        },
        "en": {
            "economics": "Economics",
            "mis": "MIS",
        },
        "tr": {
            "economics": "Ekonomi",
            "mis": "MIS",
        },
    }

    raw_value = str(value).strip()
    if not raw_value:
        return ""

    return html.escape(localized.get(lang, {}).get(raw_value.casefold(), raw_value))


def _format_term_taxonomy(term: dict[str, Any], lang: str) -> str:
    labels = {
        "ru": {"market": "Рынок", "context": "Контекст"},
        "en": {"market": "Market", "context": "Context"},
        "tr": {"market": "Pazar", "context": "Bağlam"},
    }.get(lang, {"market": "Market", "context": "Context"})

    lines: list[str] = []
    market = str(term.get("regional_market") or "").strip().upper()
    if market:
        lines.append(f"🏛️ <b>{labels['market']}:</b> {html.escape(market)}")

    context_tags = term.get("context_tags") if isinstance(term.get("context_tags"), dict) else {}
    context_values: list[str] = []

    for key in ("disciplines", "target_universities"):
        raw_value = context_tags.get(key)
        values = raw_value if isinstance(raw_value, list) else [raw_value] if raw_value else []
        for value in values:
            localized_value = _localize_context_value(value, lang)
            if localized_value and localized_value not in context_values:
                context_values.append(localized_value)

    if context_values:
        lines.append(f"🎓 <b>{labels['context']}:</b> {', '.join(context_values[:5])}")

    return "\n" + "\n".join(lines) if lines else ""


def _format_term_card(term: dict[str, Any], lang: str) -> str:
    """Format a term into a rich Telegram message."""
    safe_term = term if isinstance(term, dict) else {}
    cat = str(safe_term.get("category") or "Fintech")
    cat_emoji = CATEGORY_EMOJI.get(cat, "📖")

    def_key = f"definition_{lang}"
    ex_key = f"example_sentence_{lang}"
    definition = html.escape(str(
        safe_term.get(def_key)
        or safe_term.get("definition_ru")
        or safe_term.get("definition_en")
        or safe_term.get("definition_tr")
        or "—"
    ))
    example = html.escape(str(
        safe_term.get(ex_key)
        or safe_term.get("example_sentence_ru")
        or safe_term.get("example_sentence_en")
        or safe_term.get("example_sentence_tr")
        or "—"
    ))
    metadata_block = _format_term_taxonomy(safe_term, lang)

    return t(
        "term_card",
        lang,
        cat_emoji=cat_emoji,
        category=html.escape(cat),
        metadata_block=metadata_block,
        term_en=html.escape(str(safe_term.get("term_en") or "—")),
        term_tr=html.escape(str(safe_term.get("term_tr") or "—")),
        term_ru=html.escape(str(safe_term.get("term_ru") or "—")),
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
                    "📊 " + ("Статистика" if lang == "ru" else "İstatistik" if lang == "tr" else "Stats"),
                    callback_data="menu:stats",
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
            [InlineKeyboardButton("🌐 " + t("open_web", lang), url=WEB_APP_URL)],
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
                    "🌐 " + t("open_web", lang), url=f"{WEB_APP_URL}/term/{term_id}"
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


def _busy_message(lang: str) -> str:
    return {
        "tr": "Sistem meşgul, lütfen birkaç saniye sonra tekrar deneyin.",
        "ru": "Система занята, попробуйте снова через несколько секунд.",
        "en": "System is busy, please try again in a few seconds.",
    }.get(lang, "System is busy, please try again in a few seconds.")


def _callback_error_message(lang: str) -> str:
    return {
        "tr": "İşlem başarısız, tekrar dene",
        "ru": "Операция не удалась, попробуйте снова",
        "en": "Action failed, try again",
    }.get(lang, "Action failed, try again")


def _pagination_labels(lang: str) -> dict[str, str]:
    return {
        "tr": {"prev": "⬅️ Önceki", "next": "Sonraki ➡️"},
        "ru": {"prev": "⬅️ Назад", "next": "Далее ➡️"},
        "en": {"prev": "⬅️ Prev", "next": "Next ➡️"},
    }.get(lang, {"prev": "⬅️ Prev", "next": "Next ➡️"})


def _chunk_text(text: str, max_length: int = MAX_TELEGRAM_MESSAGE_LENGTH) -> list[str]:
    if len(text) <= max_length:
        return [text]

    chunks: list[str] = []
    current = ""

    for line in text.split("\n"):
        candidate = line if not current else f"{current}\n{line}"
        if len(candidate) <= max_length:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = ""

        remaining = line
        while len(remaining) > max_length:
            split_at = remaining.rfind(" ", 0, max_length)
            if split_at <= 0:
                split_at = max_length
            chunks.append(remaining[:split_at].rstrip())
            remaining = remaining[split_at:].lstrip()

        current = remaining

    if current:
        chunks.append(current)

    return chunks or [text[:max_length]]


def _clone_keyboard(markup: InlineKeyboardMarkup | None) -> list[list[InlineKeyboardButton]]:
    if not markup:
        return []
    return [list(row) for row in markup.inline_keyboard]


def _pagination_store(context: ContextTypes.DEFAULT_TYPE) -> dict[str, dict[str, Any]]:
    store = context.user_data.setdefault(PAGINATION_STORE_KEY, {})
    return store


def _remember_paginated_message(
    context: ContextTypes.DEFAULT_TYPE,
    key: str,
    pages: list[str],
    lang: str,
    reply_markup: InlineKeyboardMarkup | None,
    parse_mode: str | None,
) -> None:
    store = _pagination_store(context)
    store[key] = {
        "pages": pages,
        "lang": lang,
        "reply_markup": reply_markup,
        "parse_mode": parse_mode,
    }

    while len(store) > MAX_PAGINATION_SESSIONS:
        oldest_key = next(iter(store))
        store.pop(oldest_key, None)


def _build_paginated_keyboard(
    key: str,
    page_index: int,
    total_pages: int,
    lang: str,
    base_markup: InlineKeyboardMarkup | None,
) -> InlineKeyboardMarkup | None:
    rows = _clone_keyboard(base_markup)

    if total_pages > 1:
        labels = _pagination_labels(lang)
        nav_row: list[InlineKeyboardButton] = []

        if page_index > 0:
            nav_row.append(
                InlineKeyboardButton(
                    labels["prev"],
                    callback_data=f"page:{key}:{page_index - 1}",
                )
            )

        nav_row.append(
            InlineKeyboardButton(
                f"{page_index + 1}/{total_pages}",
                callback_data="page:noop",
            )
        )

        if page_index < total_pages - 1:
            nav_row.append(
                InlineKeyboardButton(
                    labels["next"],
                    callback_data=f"page:{key}:{page_index + 1}",
                )
            )

        rows.append(nav_row)

    return InlineKeyboardMarkup(rows) if rows else None


async def _send_busy_fallback(
    message: Message,
    lang: str,
    reply_markup: InlineKeyboardMarkup | None = None,
) -> None:
    try:
        await message.reply_text(
            _busy_message(lang),
            parse_mode=ParseMode.HTML,
            reply_markup=reply_markup,
        )
    except Exception as exc:
        logger.warning("Failed to send busy fallback: %s", exc)


async def _reply_paginated(
    message: Message,
    context: ContextTypes.DEFAULT_TYPE,
    text: str,
    lang: str,
    reply_markup: InlineKeyboardMarkup | None = None,
    parse_mode: str | None = ParseMode.HTML,
    scope: str = "message",
) -> None:
    pages = _chunk_text(text)
    outgoing_markup = reply_markup

    if len(pages) > 1:
        key = f"{scope}:{int(time.time() * 1000)}"
        _remember_paginated_message(context, key, pages, lang, reply_markup, parse_mode)
        outgoing_markup = _build_paginated_keyboard(
            key,
            0,
            len(pages),
            lang,
            reply_markup,
        )

    try:
        await message.reply_text(
            pages[0],
            parse_mode=parse_mode,
            reply_markup=outgoing_markup,
        )
    except telegram.error.RetryAfter as exc:
        logger.warning("Reply rate-limited: %s", exc)
        await _send_busy_fallback(message, lang, reply_markup=reply_markup)
    except telegram.error.TimedOut as exc:
        logger.warning("Reply timed out: %s", exc)
        await _send_busy_fallback(message, lang, reply_markup=reply_markup)


async def _edit_paginated(
    query: Any,
    context: ContextTypes.DEFAULT_TYPE,
    text: str,
    lang: str,
    reply_markup: InlineKeyboardMarkup | None = None,
    parse_mode: str | None = ParseMode.HTML,
    scope: str = "callback",
) -> None:
    pages = _chunk_text(text)
    outgoing_markup = reply_markup

    if len(pages) > 1:
        key = f"{scope}:{int(time.time() * 1000)}"
        _remember_paginated_message(context, key, pages, lang, reply_markup, parse_mode)
        outgoing_markup = _build_paginated_keyboard(
            key,
            0,
            len(pages),
            lang,
            reply_markup,
        )

    await query.edit_message_text(
        pages[0],
        parse_mode=parse_mode,
        reply_markup=outgoing_markup,
    )


async def _show_stored_page(
    query: Any,
    context: ContextTypes.DEFAULT_TYPE,
    pagination_key: str,
    page_index: int,
) -> None:
    store = _pagination_store(context)
    payload = store.get(pagination_key)
    if not payload:
        raise ValueError("Pagination state expired")

    pages = payload.get("pages")
    if not isinstance(pages, list) or not pages:
        raise ValueError("Pagination state expired")

    safe_index = max(0, min(page_index, len(pages) - 1))
    await query.edit_message_text(
        pages[safe_index],
        parse_mode=payload["parse_mode"],
        reply_markup=_build_paginated_keyboard(
            pagination_key,
            safe_index,
            len(pages),
            payload["lang"],
            payload["reply_markup"],
        ),
    )


# ── /start & /menu ─────────────────────────────────────────
async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send trilingual public welcome with inline actions."""
    if not update.effective_user or not update.message:
        return

    lang = _resolve_lang(update, context)

    text = START_WELCOME_TEXT + "\n\n" + t("welcome", lang)
    keyboard = _main_menu_keyboard(lang)

    await _reply_paginated(
        update.message,
        context,
        text,
        lang,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
        scope="start",
    )


async def menu_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show the main menu."""
    if not update.effective_user or not update.message:
        return

    lang = _resolve_lang(update, context)

    text = t("welcome", lang)
    keyboard = _main_menu_keyboard(lang)

    await _reply_paginated(
        update.message,
        context,
        text,
        lang,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML,
        scope="menu",
    )


# ── /search ────────────────────────────────────────────────
async def search_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Search for a term. Usage: /search <query>"""
    if not update.effective_user or not update.message:
        return

    lang = _resolve_lang(update, context)

    if not context.args:
        await _reply_paginated(
            update.message,
            context,
            t("search_prompt", lang),
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            parse_mode=ParseMode.HTML,
            scope="search-prompt",
        )
        return

    raw_query = " ".join(context.args)
    query = sanitize_input(raw_query)

    if not query:
        await _reply_paginated(
            update.message,
            context,
            t("search_prompt", lang),
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            parse_mode=ParseMode.HTML,
            scope="search-empty",
        )
        return

    try:
        results = await search_terms(query, limit=3)
    except ConnectionError:
        await _reply_paginated(
            update.message,
            context,
            _busy_message(lang),
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            parse_mode=ParseMode.HTML,
            scope="search-busy",
        )
        return

    if not results:
        await _reply_paginated(
            update.message,
            context,
            t("search_no_results", lang, query=query),
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            parse_mode=ParseMode.HTML,
            scope="search-no-results",
        )
        return

    # Show first result as card
    term = results[0]
    header = t("search_results_header", lang, count=len(results), query=query)
    card = _format_term_card(term, lang)
    await _reply_paginated(
        update.message,
        context,
        f"{header}\n\n{card}",
        lang,
        reply_markup=_term_keyboard(term, lang),
        parse_mode=ParseMode.HTML,
        scope="search-results",
    )


# ── /daily ─────────────────────────────────────────────────
async def daily_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a random term of the day."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = _resolve_lang(update, context)

    if await is_rate_limited(user_id):
        await _send_busy_fallback(update.message, lang)
        return

    try:
        term = await get_random_term()
    except ConnectionError:
        await _reply_paginated(update.message, context, _busy_message(lang), lang, scope="daily-busy")
        return

    if not term:
        await _reply_paginated(update.message, context, t("error", lang), lang, parse_mode=ParseMode.HTML, scope="daily-error")
        return

    header = t("daily_header", lang)
    card = _format_term_card(term, lang)

    await _reply_paginated(
        update.message,
        context,
        f"{header}\n\n{card}",
        lang,
        reply_markup=_term_keyboard(term, lang),
        parse_mode=ParseMode.HTML,
        scope="daily-term",
    )


# ── /quiz ──────────────────────────────────────────────────
async def quiz_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Start an inline quiz."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    lang = _resolve_lang(update, context)

    if await is_rate_limited(user_id):
        await _send_busy_fallback(update.message, lang)
        return

    try:
        text, keyboard = await build_quiz(lang)
    except ConnectionError:
        await _reply_paginated(update.message, context, _busy_message(lang), lang, scope="quiz-busy")
        return

    if text:
        await _reply_paginated(
            update.message,
            context,
            text,
            lang,
            parse_mode=ParseMode.HTML,
            reply_markup=keyboard,
            scope="quiz",
        )
    else:
        await _reply_paginated(update.message, context, t("quiz_no_terms", lang), lang, parse_mode=ParseMode.HTML, scope="quiz-empty")


# ── /lang ──────────────────────────────────────────────────
async def lang_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return
    lang = _resolve_lang(update, context)
    await _reply_paginated(
        update.message,
        context,
        t("lang_prompt", lang),
        lang,
        reply_markup=_lang_keyboard(lang),
        parse_mode=ParseMode.HTML,
        scope="lang",
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
    lang = _resolve_lang(update, context)
    text = await _build_stats_text(lang)
    await _reply_paginated(
        update.message,
        context,
        text,
        lang,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        parse_mode=ParseMode.HTML,
        scope="stats",
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
    lang = _resolve_lang(update, context)
    await _reply_paginated(
        update.message,
        context,
        t("help", lang),
        lang,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        parse_mode=ParseMode.HTML,
        scope="help",
    )


# ══════════════════════════════════════════════════════════
#  CALLBACK QUERY HANDLER  — edits the EXISTING message
# ══════════════════════════════════════════════════════════
async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Route all inline keyboard callbacks. Edits the original message in place."""
    query = update.callback_query
    if not query or not query.data or not update.effective_user:
        return

    lang = _resolve_lang(update, context)
    data = query.data
    callback_alert: str | None = None
    show_alert = False

    try:
        if data == "page:noop":
            return

        if data.startswith("page:"):
            _, pagination_key, page_index = data.split(":", 2)
            await _show_stored_page(query, context, pagination_key, int(page_index))
            return

        if data == "menu:main":
            await _edit_paginated(
                query,
                context,
                t("welcome", lang),
                reply_markup=_main_menu_keyboard(lang),
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-main-menu",
            )
            return

        if data == "menu:search":
            await _edit_paginated(
                query,
                context,
                t("search_prompt", lang),
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-search",
            )

        elif data in ("menu:daily", "daily:next"):
            term = await get_random_term()
            if term:
                header = t("daily_header", lang)
                card = _format_term_card(term, lang)
                await _edit_paginated(
                    query,
                    context,
                    f"{header}\n\n{card}",
                    reply_markup=_term_keyboard(term, lang),
                    parse_mode=ParseMode.HTML,
                    lang=lang,
                    scope="cb-daily",
                )

        elif data == "menu:quiz":
            text, keyboard = await build_quiz(lang)
            if text and keyboard:
                await _edit_paginated(
                    query,
                    context,
                    text,
                    lang,
                    parse_mode=ParseMode.HTML,
                    reply_markup=keyboard,
                    scope="cb-quiz",
                )

        elif data == "menu:stats":
            text = await _build_stats_text(lang)
            await _edit_paginated(
                query,
                context,
                text,
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-stats",
            )

        elif data == "menu:lang":
            await _edit_paginated(
                query,
                context,
                t("lang_prompt", lang),
                reply_markup=_lang_keyboard(lang),
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-lang",
            )

        elif data == "menu:help":
            await _edit_paginated(
                query,
                context,
                t("help", lang),
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-help",
            )

        elif data.startswith("lang:"):
            new_lang = data.split(":")[1]
            if new_lang in SUPPORTED_LANGUAGES:
                context.user_data[LANGUAGE_OVERRIDE_KEY] = new_lang
                await _edit_paginated(
                    query,
                    context,
                    t("lang_changed", new_lang) + "\n\n" + t("welcome", new_lang),
                    reply_markup=_main_menu_keyboard(new_lang),
                    parse_mode=ParseMode.HTML,
                    lang=new_lang,
                    scope="cb-lang-change",
                )

        elif data.startswith("quiz:"):
            parts = data.split(":")
            is_correct = parts[1] == "1"
            term_id = parts[2] if len(parts) > 2 else ""

            if is_correct:
                result_text = t("quiz_correct", lang)
            else:
                term = await fetch_term_by_id(term_id) if term_id else None
                def_key = f"definition_{lang}"
                answer = (
                    term.get(def_key, term.get("definition_en", "—")) if term else "—"
                )
                result_text = t("quiz_wrong", lang, answer=answer)

            await _edit_paginated(
                query,
                context,
                result_text,
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
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-quiz-result",
            )

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
                            with open(audio_path, "rb") as audio_file:
                                sent = await query.message.reply_voice(  # type: ignore[union-attr]
                                    voice=audio_file,
                                    caption=f"🔊 {text_to_speak}",
                                )

                                # Auto-delete voice after 10 seconds to keep chat clean
                                asyncio.create_task(_delete_later(sent, 10))
                    except telegram.error.RetryAfter as exc:
                        logger.warning("TTS callback rate-limited: %s", exc)
                        callback_alert = _busy_message(tts_lang)
                        show_alert = True
                    except Exception as e:
                        logger.exception("TTS error: %s", e)
                        callback_alert = _callback_error_message(tts_lang)
                        show_alert = True

    except telegram.error.RetryAfter as e:
        logger.warning("Callback rate-limited: %s", e)
        callback_alert = _busy_message(lang)
        show_alert = True
    except telegram.error.TimedOut as e:
        logger.warning("Callback timed out: %s", e)
        callback_alert = _busy_message(lang)
        show_alert = True
    except telegram.error.BadRequest as e:
        if "Message is not modified" in str(e):
            logger.debug("Callback message not modified: %s", e)
        else:
            logger.warning("Callback edit failed (BadRequest): %s", e)
            callback_alert = _callback_error_message(lang)
            show_alert = True
    except Exception as e:
        logger.exception("Callback unexpected error: %s", e)
        callback_alert = _callback_error_message(lang)
        show_alert = True
    finally:
        try:
            if callback_alert:
                await query.answer(callback_alert, show_alert=show_alert)
            else:
                await query.answer()
        except Exception as answer_error:
            logger.warning("Failed to answer callback: %s", answer_error)


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

    lang = _resolve_lang(update, context)

    raw_query = update.message.text.strip()

    if not raw_query or raw_query.startswith("/"):
        return

    query = sanitize_input(raw_query)
    if not query:
        return

    try:
        results = await search_terms(query, limit=3)
    except ConnectionError:
        await _reply_paginated(
            update.message,
            context,
            _busy_message(lang),
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            parse_mode=ParseMode.HTML,
            scope="text-search-busy",
        )
        return

    if not results:
        await _reply_paginated(
            update.message,
            context,
            t("search_no_results", lang, query=query),
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            parse_mode=ParseMode.HTML,
            scope="text-search-empty",
        )
        return

    term = results[0]
    header = t("search_results_header", lang, count=len(results), query=query)
    card = _format_term_card(term, lang)
    await _reply_paginated(
        update.message,
        context,
        f"{header}\n\n{card}",
        lang,
        reply_markup=_term_keyboard(term, lang),
        parse_mode=ParseMode.HTML,
        scope="text-search-results",
    )
