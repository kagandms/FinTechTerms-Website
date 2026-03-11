"""Quiz builders and quiz-related helpers for the Telegram bot."""

from __future__ import annotations

import random
from typing import Any

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from bot.config import CATEGORY_EMOJI
from bot.db_terms import fetch_all_terms
from bot.i18n import t

MAX_QUIZ_OPTIONS = 4
QUIZ_OPTION_PREVIEW_LENGTH = 80


def _back_button(lang: str) -> InlineKeyboardButton:
    """Create a standardised back-to-menu button."""
    label = "🔙 Меню" if lang == "ru" else "🔙 Menü" if lang == "tr" else "🔙 Menu"
    return InlineKeyboardButton(label, callback_data="menu:main")


def _clean_text(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _localized_term(term: dict[str, Any], lang: str) -> str:
    return _clean_text(term.get(f"term_{lang}") or term.get("term_en") or "—")


def _localized_definition(term: dict[str, Any], lang: str) -> str:
    return _clean_text(term.get(f"definition_{lang}") or term.get("definition_en") or "—")


def _unique_quiz_candidates(
    all_terms: list[dict[str, Any]],
    lang: str,
) -> list[tuple[dict[str, Any], str]]:
    candidates: list[tuple[dict[str, Any], str]] = []
    seen_definitions: set[str] = set()

    for term in all_terms:
        if not isinstance(term, dict):
            continue

        term_id = _clean_text(term.get("id"))
        definition = _localized_definition(term, lang)
        if not term_id or not definition or definition == "—":
            continue

        signature = definition.casefold()
        if signature in seen_definitions:
            continue

        seen_definitions.add(signature)
        candidates.append((term, definition))

    return candidates


def _short_option_text(option: str) -> str:
    if len(option) <= QUIZ_OPTION_PREVIEW_LENGTH:
        return option

    return option[:QUIZ_OPTION_PREVIEW_LENGTH] + "…"


async def build_quiz(
    lang: str,
) -> tuple[str | None, InlineKeyboardMarkup | None]:
    """
    Build quiz question text and keyboard.

    Returns:
        (text, keyboard) or (None, None) if not enough terms available.

    Algorithm:
        1. Fetch all terms from database
        2. Pick one random correct term
        3. Pick 3 random wrong terms (different IDs)
        4. Build shuffled multiple-choice keyboard
    """
    all_terms = await fetch_all_terms()
    candidates = _unique_quiz_candidates(all_terms, lang)

    if len(candidates) < MAX_QUIZ_OPTIONS:
        return None, None

    correct_term, correct_def = random.choice(candidates)
    correct_id = str(correct_term["id"])
    wrong_candidates = [
        (term, definition)
        for term, definition in candidates
        if str(term.get("id")) != correct_id and definition.casefold() != correct_def.casefold()
    ]

    if len(wrong_candidates) < MAX_QUIZ_OPTIONS - 1:
        return None, None

    wrong_terms = random.sample(
        wrong_candidates,
        MAX_QUIZ_OPTIONS - 1,
    )

    options: list[tuple[str, bool]] = [(correct_def, True)] + [
        (wrong_definition, False) for _, wrong_definition in wrong_terms
    ]
    random.shuffle(options)

    buttons: list[list[InlineKeyboardButton]] = []
    for i, (opt, is_correct) in enumerate(options):
        buttons.append(
            [
                InlineKeyboardButton(
                    f"{chr(65 + i)}) {_short_option_text(opt)}",
                    callback_data=f"quiz:{'1' if is_correct else '0'}:{correct_id}",
                )
            ]
        )
    buttons.append([_back_button(lang)])

    term_display = _localized_term(correct_term, lang)
    text = t("quiz_question", lang, term=term_display)

    return text, InlineKeyboardMarkup(buttons)


def build_accuracy_bar(accuracy: int, length: int = 10) -> str:
    """
    Build a visual accuracy progress bar.

    Args:
        accuracy: Percentage (0-100)
        length: Number of blocks in the bar

    Returns:
        String like "███████░░░" (7/10 filled)
    """
    filled = max(0, min(length, accuracy // (100 // length)))
    return "█" * filled + "░" * (length - filled)


def choose_smart_tip(
    searches: int, quizzes_taken: int, daily_used: int, lang: str
) -> str:
    """
    Choose a contextual tip based on the user's weakest area.

    Priority:
        1. If total actions >= 10: compliment
        2. If no searches: suggest search
        3. If < 3 quizzes: suggest quiz
        4. Default: suggest daily term
    """
    total_actions = searches + quizzes_taken + daily_used

    if total_actions >= 10:
        return t("report_tip_great", lang)
    elif searches == 0:
        return t("report_tip_search", lang)
    elif quizzes_taken < 3:
        return t("report_tip_quiz", lang)
    else:
        return t("report_tip_daily", lang)
