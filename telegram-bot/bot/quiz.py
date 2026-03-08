"""
FinTechTerms Bot — Quiz Handler Module (M50)
Skill: code-refactoring-refactor-clean, python-pro

Extracted quiz logic from the monolithic handlers.py file
for better maintainability and testability.
"""

from __future__ import annotations

import random
from typing import Any

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from bot.config import CATEGORY_EMOJI
from bot.db_terms import fetch_all_terms
from bot.i18n import t


def _back_button(lang: str) -> InlineKeyboardButton:
    """Create a standardised back-to-menu button."""
    label = "🔙 Меню" if lang == "ru" else "🔙 Menü" if lang == "tr" else "🔙 Menu"
    return InlineKeyboardButton(label, callback_data="menu:main")


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
    wrong_defs = [
        wt.get(def_key) or wt.get("definition_en", "—") for wt in wrong_terms
    ]

    options: list[tuple[str, bool]] = [(correct_def, True)] + [
        (wd, False) for wd in wrong_defs
    ]
    random.shuffle(options)

    buttons: list[list[InlineKeyboardButton]] = []
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
