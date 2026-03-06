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
    Message,
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
    get_linked_profile_context,
    get_favorites_by_user_id,
    get_activity_stats_by_user_id,
)
from bot.i18n import t
from bot.tts import generate_tts_audio
from bot.rate_limiter import is_rate_limited

logger = logging.getLogger(__name__)

MAX_TELEGRAM_MESSAGE_LENGTH = 3900
PAGINATION_STORE_KEY = "paginated_messages"
MAX_PAGINATION_SESSIONS = 20

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
    cat = term.get("category", "Fintech")
    cat_emoji = CATEGORY_EMOJI.get(cat, "📖")

    def_key = f"definition_{lang}"
    ex_key = f"example_sentence_{lang}"
    definition = (
        term.get(def_key)
        or term.get("definition_ru")
        or term.get("definition_en")
        or term.get("definition_tr")
        or "—"
    )
    example = (
        term.get(ex_key)
        or term.get("example_sentence_ru")
        or term.get("example_sentence_en")
        or term.get("example_sentence_tr")
        or "—"
    )
    metadata_block = _format_term_taxonomy(term, lang)

    return t(
        "term_card",
        lang,
        cat_emoji=cat_emoji,
        category=cat,
        metadata_block=metadata_block,
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


def _account_menu_keyboard() -> InlineKeyboardMarkup:
    """Russian-first account dashboard keyboard."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("⭐ Мои избранные", callback_data="account:favorites"),
                InlineKeyboardButton("📊 Моя статистика", callback_data="account:stats"),
            ]
        ]
    )


def _account_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("🔙 Меню", callback_data="account:home")]]
    )


def _link_hint_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🔗 " + t("link_account_button", lang), callback_data="menu:link")],
            [_back_button(lang)],
        ]
    )


def _public_site_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("🌐 Перейти на сайт", url=WEB_APP_URL)]]
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

    pages = payload["pages"]
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


def _start_keyboard(is_linked: bool) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton("🔑 Получить код (Kod Al / Get Code)", callback_data="start:get_code")],
    ]

    if is_linked:
        rows.append(
            [
                InlineKeyboardButton("⭐ Мои избранные", callback_data="account:favorites"),
                InlineKeyboardButton("📊 Моя статистика", callback_data="account:stats"),
            ]
        )

    rows.extend(
        [
            [
                InlineKeyboardButton("📖 Меню / Menu", callback_data="menu:main"),
                InlineKeyboardButton("ℹ️ Помощь / Help", callback_data="menu:help"),
            ],
            [InlineKeyboardButton("🌐 Открыть сайт / Open Website", url=WEB_APP_URL)],
        ]
    )

    return InlineKeyboardMarkup(rows)


def _start_code_keyboard(lang: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("🔙 Назад / Back", callback_data="start:home"),
                InlineKeyboardButton("🌐 " + t("open_web", lang), url=WEB_APP_URL),
            ]
        ]
    )


async def _resolve_account_context(
    telegram_id: int, fallback_lang: str, username: str | None = None
) -> dict[str, Any]:
    try:
        linked = await get_linked_profile_context(telegram_id, username=username)
        lang = linked.get("language") or fallback_lang
        return {
            "ok": True,
            "lang": lang,
            "is_linked": bool(linked.get("is_linked")),
            "user_id": linked.get("user_id"),
            "full_name": linked.get("full_name"),
            "error": None,
        }
    except Exception as exc:
        logger.exception("Failed to resolve account context for %s", telegram_id)
        return {
            "ok": False,
            "lang": fallback_lang,
            "is_linked": False,
            "user_id": None,
            "full_name": None,
            "error": str(exc),
        }


def _build_start_text(context: dict[str, Any], first_name: str | None = None) -> str:
    if context.get("is_linked"):
        raw_name = context.get("full_name") or first_name or "Пользователь"
        safe_name = html.escape(str(raw_name))
        status = (
            f"✅ <b>Аккаунт привязан: {safe_name}</b>\n"
            "Можно пользоваться полным функционалом без повторной привязки."
        )
    else:
        status = (
            "⚠️ Аккаунт пока не привязан.\n"
            "Нажмите кнопку «Получить код (Kod Al / Get Code)» и завершите привязку на сайте."
        )

    return f"{START_WELCOME_TEXT}\n\n{status}"


async def _build_account_home_text(
    telegram_id: int, fallback_lang: str, username: str | None = None, first_name: str | None = None
) -> tuple[str, InlineKeyboardMarkup, str]:
    context = await _resolve_account_context(telegram_id, fallback_lang, username=username)
    lang = context["lang"]

    if not context["ok"]:
        error_text = html.escape(context["error"] or "Unknown error")
        return t("account_data_error", lang, error=error_text), _link_hint_keyboard(lang), lang

    if not context["is_linked"]:
        return t("account_not_linked", lang), _link_hint_keyboard(lang), lang

    raw_name = context["full_name"] or first_name or username or "Пользователь"
    safe_name = html.escape(str(raw_name))
    return t("account_welcome", lang, name=safe_name), _account_menu_keyboard(), lang


async def _build_account_favorites_text(
    telegram_id: int, fallback_lang: str, username: str | None = None
) -> tuple[str, InlineKeyboardMarkup, str]:
    context = await _resolve_account_context(telegram_id, fallback_lang, username=username)
    lang = context["lang"]

    if not context["ok"]:
        error_text = html.escape(context["error"] or "Unknown error")
        return t("account_data_error", lang, error=error_text), _account_back_keyboard(), lang

    if not context["is_linked"] or not context["user_id"]:
        return t("account_not_linked", lang), _link_hint_keyboard(lang), lang

    try:
        favorites = await get_favorites_by_user_id(str(context["user_id"]), limit=20)
    except Exception as exc:
        logger.exception("Favorites fetch failed for telegram_id %s", telegram_id)
        error_text = html.escape(str(exc))
        return t("account_data_error", lang, error=error_text), _account_back_keyboard(), lang

    if not favorites:
        return t("account_favorites_empty", lang), _account_back_keyboard(), lang

    header = t("account_favorites_header", lang, count=len(favorites))
    lines = [header]

    display_terms = favorites[:12]
    for index, term in enumerate(display_terms, start=1):
        category = term.get("category", "Fintech")
        cat_emoji = CATEGORY_EMOJI.get(category, "📖")
        lines.append(
            t(
                "account_favorites_item",
                lang,
                num=index,
                cat_emoji=cat_emoji,
                term_ru=html.escape(str(term.get("term_ru", "—"))),
                term_en=html.escape(str(term.get("term_en", "—"))),
                term_tr=html.escape(str(term.get("term_tr", "—"))),
            )
        )

    if len(favorites) > len(display_terms):
        remaining = len(favorites) - len(display_terms)
        lines.append(t("account_favorites_more", lang, remaining=remaining))

    lines.append(t("account_favorites_footer", lang))
    return "\n".join(lines), _account_back_keyboard(), lang


async def _build_account_stats_text(
    telegram_id: int, fallback_lang: str, username: str | None = None
) -> tuple[str, InlineKeyboardMarkup, str]:
    context = await _resolve_account_context(telegram_id, fallback_lang, username=username)
    lang = context["lang"]

    if not context["ok"]:
        error_text = html.escape(context["error"] or "Unknown error")
        return t("account_data_error", lang, error=error_text), _account_back_keyboard(), lang

    if not context["is_linked"] or not context["user_id"]:
        return t("account_not_linked", lang), _link_hint_keyboard(lang), lang

    try:
        stats = await get_activity_stats_by_user_id(str(context["user_id"]))
    except Exception as exc:
        logger.exception("Stats fetch failed for telegram_id %s", telegram_id)
        error_text = html.escape(str(exc))
        return t("account_data_error", lang, error=error_text), _account_back_keyboard(), lang

    text = t(
        "account_stats",
        lang,
        quizzes_taken=stats.get("quizzes_taken", 0),
        quizzes_correct=stats.get("quizzes_correct", 0),
        accuracy=stats.get("accuracy", 0),
        words_added=stats.get("words_added", 0),
        words_reviewed=stats.get("words_reviewed", 0),
        favorites_count=stats.get("favorites_count", 0),
        active_days=stats.get("active_days", 0),
    )
    return text, _account_back_keyboard(), lang


# ── /start & /menu ─────────────────────────────────────────
async def start_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send trilingual public welcome with inline actions."""
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    await save_username(user_id, update.effective_user.username)
    lang = await get_user_language(user_id)

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

    user_id = update.effective_user.id
    await save_username(user_id, update.effective_user.username)
    lang = await get_user_language(user_id)

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

    user_id = update.effective_user.id
    lang = await get_user_language(user_id)

    if await is_rate_limited(user_id):
        await _send_busy_fallback(
            update.message,
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        )
        return

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

    await track_activity(user_id, "search")

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
    lang = await get_user_language(user_id)

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

    await track_activity(user_id, "daily")
    await track_activity(user_id, "term_viewed", category=term.get("category", ""))

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
    lang = await get_user_language(user_id)

    if await is_rate_limited(user_id):
        await _send_busy_fallback(update.message, lang)
        return

    try:
        text, keyboard = await _build_quiz(lang)
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
    user_id = update.effective_user.id
    lang = await get_user_language(user_id)
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
    lang = await get_user_language(update.effective_user.id)
    await _reply_paginated(
        update.message,
        context,
        t("help", lang),
        lang,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        parse_mode=ParseMode.HTML,
        scope="help",
    )


# ── /report ────────────────────────────────────────────────
async def report_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show user's activity report."""
    if not update.effective_user or not update.message:
        return
    user_id = update.effective_user.id
    lang = await get_user_language(user_id)
    text = await _build_report_text(user_id, lang)
    await _reply_paginated(
        update.message,
        context,
        text,
        lang,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        parse_mode=ParseMode.HTML,
        scope="report",
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

    account_context = await _resolve_account_context(
        user_id,
        lang,
        username=update.effective_user.username,
    )
    if account_context.get("is_linked"):
        await _reply_paginated(
            update.message,
            context,
            "✅ <b>Аккаунт уже привязан.</b>\nВы можете сразу пользоваться командами бота.",
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            parse_mode=ParseMode.HTML,
            scope="link-already",
        )
        return

    text = await _build_link_text(user_id, lang)
    if not text:
        await _reply_paginated(
            update.message,
            context,
            _busy_message(lang),
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
            parse_mode=ParseMode.HTML,
            scope="link-busy",
        )
        return

    await _reply_paginated(
        update.message,
        context,
        text,
        lang,
        reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        parse_mode=ParseMode.HTML,
        scope="link",
    )


# ── /favorites ────────────────────────────────────────────
async def favorites_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show the user's favorite terms from the web app inline."""
    if not update.effective_user or not update.message:
        return

    telegram_id = update.effective_user.id

    # Ratelimit protection against spam polling
    if await is_rate_limited(telegram_id):
        lang = await get_user_language(telegram_id)
        await _send_busy_fallback(update.message, lang)
        return

    # Fallback languages dict context
    lang = await get_user_language(telegram_id)

    try:
        # 1. Resolve Auth linkage via sync user
        linked_ctx = await get_linked_profile_context(telegram_id, username=update.effective_user.username)

        if not linked_ctx.get("is_linked") or not linked_ctx.get("user_id"):
            msg = (
                "⚠️ Вы не привязали аккаунт Telegram к сайту.\n" if lang == "ru" else
                "⚠️ Telegram hesabınız siteye bağlı değil.\n" if lang == "tr" else
                "⚠️ Your Telegram account is not linked to the website.\n"
            )
            await _reply_paginated(
                update.message,
                context,
                msg + "Используйте /link для привязки. (Use /link to attach profile)",
                lang,
                parse_mode=ParseMode.HTML,
                scope="favorites-link-required",
            )
            return

        user_id = str(linked_ctx["user_id"])

        # 2. Fetch Hydrated Favorites List
        favorites = await get_favorites_by_user_id(user_id, limit=20)

        if not favorites:
            empty_msg = (
                "У вас пока нет избранных терминов." if lang == "ru" else
                "Henüz favori kelimeniz yok." if lang == "tr" else
                "You have no favorite terms yet."
            )
            await _reply_paginated(update.message, context, empty_msg, lang, parse_mode=ParseMode.HTML, scope="favorites-empty")
            return

        # 3. Construct beautiful UI response
        lines = [f"⭐ <b>Мои Избранные</b> ({len(favorites)})" if lang == "ru" else
                 f"⭐ <b>Favorilerim</b> ({len(favorites)})" if lang == "tr" else
                 f"⭐ <b>My Favorites</b> ({len(favorites)})", ""]

        for idx, term in enumerate(favorites[:15], start=1):
            term_ru = html.escape(str(term.get("term_ru", "—")))
            term_tr = html.escape(str(term.get("term_tr", "—")))
            term_en = html.escape(str(term.get("term_en", "—")))

            # Use dynamic localization rendering based on target language
            if lang == "ru":
                display = f"🇷🇺 {term_ru} (🇬🇧 {term_en})"
            elif lang == "tr":
                display = f"🇹🇷 {term_tr} (🇬🇧 {term_en})"
            else:
                display = f"🇬🇧 {term_en} (🇷🇺 {term_ru})"

            lines.append(f"{idx}. {display}")

        if len(favorites) > 15:
            lines.append(f"\n...и еще {len(favorites) - 15} терминов на сайте." if lang == "ru" else
                         f"\n...ve web sitesinde {len(favorites) - 15} terim daha." if lang == "tr" else
                         f"\n...and {len(favorites) - 15} more terms on the website.")

        final_text = "\n".join(lines)

        # Add open web button layout
        markup = InlineKeyboardMarkup([[
            InlineKeyboardButton("🌐 Перейти на сайт" if lang == "ru" else "🌐 Siteye Git", url=WEB_APP_URL)
        ]])

        await _reply_paginated(
            update.message,
            context,
            final_text,
            lang,
            parse_mode=ParseMode.HTML,
            reply_markup=markup,
            scope="favorites",
        )

    except Exception as e:
        logger.exception("Favorites retrieval failed for telegram ID: %s", telegram_id)
        error_msg = ("Произошла ошибка базы данных." if lang == "ru" else
                     "Veritabanı bağlantı hatası oluştu." if lang == "tr" else
                     "A database error occurred.")
        await _reply_paginated(update.message, context, error_msg, lang, parse_mode=ParseMode.HTML, scope="favorites-error")


async def _build_favorites_text(telegram_id: int, lang: str) -> str:
    """Build a formatted list of the user's favorite terms."""
    try:
        favorites = await get_user_favorites(telegram_id)
    except Exception as exc:
        logger.exception("Failed to build favorites text for %s", telegram_id)
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

    user_id = update.effective_user.id
    lang = await get_user_language(user_id)
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

        # ── Start screen / Old Main Menu ──
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

        elif data == "start:home":
            account_context = await _resolve_account_context(
                user_id,
                "ru",
                username=update.effective_user.username,
            )
            start_text = _build_start_text(account_context, update.effective_user.first_name)
            await _edit_paginated(
                query,
                context,
                start_text,
                reply_markup=_start_keyboard(bool(account_context.get("is_linked"))),
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-start-home",
            )

        # ── Generate link code from start button ──
        elif data == "start:get_code":
            account_context = await _resolve_account_context(
                user_id,
                lang,
                username=update.effective_user.username,
            )
            if account_context.get("is_linked"):
                await _edit_paginated(
                    query,
                    context,
                    "✅ <b>Аккаунт уже привязан.</b>\nКод больше не нужен, используйте команды бота.",
                    reply_markup=_start_keyboard(True),
                    parse_mode=ParseMode.HTML,
                    lang=lang,
                    scope="cb-start-linked",
                )
            else:
                link_lang = account_context.get("lang") or lang
                link_text = await _build_link_text(user_id, link_lang)
                if not link_text:
                    link_text = _busy_message(link_lang)

                await _edit_paginated(
                    query,
                    context,
                    link_text,
                    reply_markup=_start_code_keyboard(link_lang),
                    parse_mode=ParseMode.HTML,
                    lang=link_lang,
                    scope="cb-start-link",
                )

        # ── Account dashboard ──
        elif data in ("menu:main", "account:home"):
            home_text, home_keyboard, _ = await _build_account_home_text(
                user_id,
                lang,
                username=update.effective_user.username,
                first_name=update.effective_user.first_name,
            )
            await _edit_paginated(
                query,
                context,
                home_text,
                reply_markup=home_keyboard,
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-account-home",
            )

        # ── Account favorites (live Supabase fetch) ──
        elif data == "account:favorites":
            favorites_text, favorites_keyboard, _ = await _build_account_favorites_text(
                user_id,
                lang,
                username=update.effective_user.username,
            )
            await _edit_paginated(
                query,
                context,
                favorites_text,
                reply_markup=favorites_keyboard,
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-account-favorites",
            )

        # ── Account statistics (live Supabase fetch) ──
        elif data == "account:stats":
            stats_text, stats_keyboard, _ = await _build_account_stats_text(
                user_id,
                lang,
                username=update.effective_user.username,
            )
            await _edit_paginated(
                query,
                context,
                stats_text,
                reply_markup=stats_keyboard,
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-account-stats",
            )

        # ── Search prompt ──
        elif data == "menu:search":
            await _edit_paginated(
                query,
                context,
                t("search_prompt", lang),
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-search",
            )

        # ── Daily term ──
        elif data in ("menu:daily", "daily:next"):
            term = await get_random_term()
            if term:
                await track_activity(user_id, "daily")
                await track_activity(user_id, "term_viewed", category=term.get("category", ""))
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

        # ── Quiz ──
        elif data == "menu:quiz":
            text, keyboard = await _build_quiz(lang)
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

        # ── Stats ──
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

        # ── Language selection menu ──
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

        # ── Report ──
        elif data == "menu:report":
            text = await _build_report_text(user_id, lang)
            await _edit_paginated(
                query,
                context,
                text,
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-report",
            )

        # ── Link ──
        elif data == "menu:link":
            account_context = await _resolve_account_context(
                user_id,
                lang,
                username=update.effective_user.username,
            )
            if account_context.get("is_linked"):
                text = "✅ <b>Аккаунт уже привязан.</b>\nКод не требуется."
            else:
                text = await _build_link_text(user_id, lang)
                if not text:
                    text = _busy_message(lang)

            await _edit_paginated(
                query,
                context,
                text,
                reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-link",
            )

        # ── Help ──
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

        # ── Favorites ──
        elif data == "menu:favorites":
            text, keyboard, _ = await _build_account_favorites_text(
                user_id,
                lang,
                username=update.effective_user.username,
            )
            await _edit_paginated(
                query,
                context,
                text,
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML,
                lang=lang,
                scope="cb-favorites",
            )

        # ── Language change ──
        elif data.startswith("lang:"):
            new_lang = data.split(":")[1]
            if new_lang in SUPPORTED_LANGUAGES:
                await set_user_language(user_id, new_lang)
                home_text, home_keyboard, _ = await _build_account_home_text(
                    user_id,
                    new_lang,
                    username=update.effective_user.username,
                    first_name=update.effective_user.first_name,
                )
                await _edit_paginated(
                    query,
                    context,
                    t("lang_changed", new_lang) + "\n\n" + home_text,
                    reply_markup=home_keyboard,
                    parse_mode=ParseMode.HTML,
                    lang=new_lang,
                    scope="cb-lang-change",
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

    user_id = update.effective_user.id
    lang = await get_user_language(user_id)
    if await is_rate_limited(user_id):
        await _send_busy_fallback(
            update.message,
            lang,
            reply_markup=InlineKeyboardMarkup([[_back_button(lang)]]),
        )
        return

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
