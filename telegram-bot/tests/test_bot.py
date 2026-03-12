"""Unit and integration-style tests for the Telegram bot."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from bot import handlers, quiz
from bot.config import (
    CATEGORY_EMOJI,
    SRS_LEVEL_LABELS,
    SUPPORTED_LANGUAGES,
    WEB_APP_URL,
)
from bot.db_terms import (
    build_academic_search_filters,
    is_public_term,
    normalize_public_terms,
    normalize_term_payload,
)
from bot.i18n import STRINGS, t
from bot.quiz import build_accuracy_bar, build_quiz, build_quiz_result, choose_smart_tip


def make_term(
    term_id: str,
    term_en: str,
    definition_en: str,
    *,
    term_ru: str | None = None,
    definition_ru: str | None = None,
    category: str = "Finance",
) -> dict[str, Any]:
    return {
        "id": term_id,
        "term_en": term_en,
        "term_ru": term_ru or term_en,
        "term_tr": term_en,
        "definition_en": definition_en,
        "definition_ru": definition_ru or definition_en,
        "definition_tr": definition_en,
        "example_sentence_en": f"{term_en} example",
        "example_sentence_ru": f"{term_en} пример",
        "example_sentence_tr": f"{term_en} ornek",
        "category": category,
    }


def sample_terms() -> list[dict[str, Any]]:
    return [
        make_term("term_1", "Liquidity", "How easily an asset can be converted to cash."),
        make_term("term_2", "Volatility", "The degree of price fluctuation in a market."),
        make_term("term_3", "Hedging", "Reducing risk by taking an offsetting position."),
        make_term("term_4", "Yield", "Income generated from an investment over time."),
        make_term("term_5", "Spread", "The gap between bid and ask prices."),
    ]


class DummySentMessage:
    def __init__(
        self,
        text: str | None = None,
        *,
        parse_mode: str | None = None,
        reply_markup: InlineKeyboardMarkup | None = None,
        voice: Any | None = None,
        caption: str | None = None,
    ) -> None:
        self.text = text
        self.parse_mode = parse_mode
        self.reply_markup = reply_markup
        self.voice = voice
        self.caption = caption
        self.deleted = False

    async def delete(self) -> None:
        self.deleted = True


class DummyMessage:
    def __init__(self, text: str | None = None) -> None:
        self.text = text
        self.replies: list[DummySentMessage] = []
        self.voice_replies: list[DummySentMessage] = []

    async def reply_text(
        self,
        text: str,
        *,
        parse_mode: str | None = None,
        reply_markup: InlineKeyboardMarkup | None = None,
    ) -> DummySentMessage:
        sent = DummySentMessage(text, parse_mode=parse_mode, reply_markup=reply_markup)
        self.replies.append(sent)
        return sent

    async def reply_voice(
        self,
        *,
        voice: Any,
        caption: str | None = None,
    ) -> DummySentMessage:
        sent = DummySentMessage(voice=voice, caption=caption)
        self.voice_replies.append(sent)
        return sent


class DummyQuery:
    def __init__(self, data: str, message: DummyMessage | None = None) -> None:
        self.data = data
        self.message = message or DummyMessage()
        self.edits: list[DummySentMessage] = []
        self.answer_calls: list[dict[str, Any]] = []

    async def edit_message_text(
        self,
        text: str,
        *,
        parse_mode: str | None = None,
        reply_markup: InlineKeyboardMarkup | None = None,
    ) -> DummySentMessage:
        edited = DummySentMessage(text, parse_mode=parse_mode, reply_markup=reply_markup)
        self.edits.append(edited)
        return edited

    async def answer(self, text: str | None = None, show_alert: bool = False) -> None:
        self.answer_calls.append({"text": text, "show_alert": show_alert})


def make_context(*, args: list[str] | None = None, user_data: dict[str, Any] | None = None) -> SimpleNamespace:
    return SimpleNamespace(args=args or [], user_data=user_data or {})


def make_update(
    *,
    message: DummyMessage | None = None,
    query: DummyQuery | None = None,
    user_id: int = 100,
    language_code: str = "en",
) -> SimpleNamespace:
    return SimpleNamespace(
        effective_user=SimpleNamespace(id=user_id, language_code=language_code),
        message=message,
        callback_query=query,
    )


def option_rows(markup: InlineKeyboardMarkup) -> list[list[InlineKeyboardButton]]:
    return markup.inline_keyboard[:-1]


class TestI18n:
    def test_basic_translation_ru(self) -> None:
        assert "Добро пожаловать" in t("welcome", "ru")

    def test_basic_translation_en(self) -> None:
        assert "Welcome" in t("welcome", "en")

    def test_basic_translation_tr(self) -> None:
        assert "Hoş Geldiniz" in t("welcome", "tr")

    def test_fallback_to_russian(self) -> None:
        assert "Добро пожаловать" in t("welcome", "xx")

    def test_unknown_key_returns_key(self) -> None:
        assert t("nonexistent_key_xyz", "en") == "nonexistent_key_xyz"

    def test_format_kwargs(self) -> None:
        assert "Bitcoin" in t("search_no_results", "en", query="Bitcoin")

    def test_format_missing_kwargs_no_crash(self) -> None:
        assert "{query}" in t("search_no_results", "en")

    def test_all_supported_languages_have_welcome(self) -> None:
        for lang in SUPPORTED_LANGUAGES:
            assert len(t("welcome", lang)) > 10

    def test_all_strings_have_all_languages(self) -> None:
        for key, translations in STRINGS.items():
            for lang in SUPPORTED_LANGUAGES:
                assert lang in translations, f"Key '{key}' missing '{lang}'"

    def test_open_web_labels_are_short_and_localized(self) -> None:
        assert t("open_web", "ru") == "Сайт"
        assert t("open_web", "en") == "Website"
        assert t("open_web", "tr") == "Web Sitesi"

    def test_welcome_copy_excludes_linking_and_report_commands(self) -> None:
        for lang in SUPPORTED_LANGUAGES:
            welcome = t("welcome", lang)
            assert "/link" not in welcome
            assert "/bagla" not in welcome
            assert "/report" not in welcome

    def test_help_copy_excludes_linking_and_report_commands(self) -> None:
        for lang in SUPPORTED_LANGUAGES:
            help_text = t("help", lang)
            assert "/link" not in help_text
            assert "/bagla" not in help_text
            assert "/report" not in help_text


class TestConfig:
    def test_category_emoji_mapping(self) -> None:
        assert CATEGORY_EMOJI["Fintech"] == "💳"
        assert CATEGORY_EMOJI["Finance"] == "💰"
        assert CATEGORY_EMOJI["Technology"] == "💻"

    def test_srs_level_labels_count(self) -> None:
        for lang in SUPPORTED_LANGUAGES:
            assert len(SRS_LEVEL_LABELS[lang]) == 5

    def test_supported_languages(self) -> None:
        assert "ru" in SUPPORTED_LANGUAGES
        assert "en" in SUPPORTED_LANGUAGES
        assert "tr" in SUPPORTED_LANGUAGES


class TestAcademicTaxonomy:
    def test_build_academic_search_filters(self) -> None:
        filters = build_academic_search_filters("MOEX economics HSE")

        assert {"regional_market": "MOEX"} in filters
        assert {"context_tags": {"disciplines": ["economics"]}} in filters
        assert {"context_tags": {"target_universities": ["HSE"]}} in filters

    def test_normalize_term_payload_defaults_taxonomy(self) -> None:
        normalized = normalize_term_payload(
            {
                "id": "term_001",
                "term_en": "Liquidity",
                "category": "Finance",
                "context_tags": None,
                "regional_market": None,
            }
        )

        assert normalized["regional_market"] == "GLOBAL"
        assert normalized["context_tags"] == {}

    def test_normalize_term_payload_parses_stringified_context_tags(self) -> None:
        normalized = normalize_term_payload(
            {
                "id": "term_002",
                "context_tags": "{\"disciplines\": [\"economics\"]}",
                "regional_market": "bist",
            }
        )

        assert normalized["regional_market"] == "BIST"
        assert normalized["context_tags"] == {"disciplines": ["economics"]}

    def test_normalize_term_payload_handles_non_dict(self) -> None:
        normalized = normalize_term_payload(None)

        assert normalized["regional_market"] == "GLOBAL"
        assert normalized["context_tags"] == {}

    def test_is_public_term_matches_web_quarantine_logic(self) -> None:
        assert is_public_term({"id": "term_001", "is_academic": True}) is True
        assert is_public_term({"id": "term_002", "is_academic": None}) is True
        assert is_public_term({"id": "term_003", "is_academic": False}) is False

    def test_normalize_public_terms_filters_quarantined_rows(self) -> None:
        normalized = normalize_public_terms(
            [
                {"id": "term_001", "is_academic": True, "regional_market": "moex"},
                {"id": "term_002", "is_academic": False, "regional_market": "bist"},
                {"id": "term_003", "regional_market": None},
            ]
        )

        assert [row["id"] for row in normalized] == ["term_001", "term_003"]
        assert normalized[0]["regional_market"] == "MOEX"
        assert normalized[1]["regional_market"] == "GLOBAL"


class TestQuizModule:
    def test_build_quiz_returns_four_unique_options_and_correct_answer(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_fetch_all_terms() -> list[dict[str, Any]]:
            return sample_terms()

        monkeypatch.setattr(quiz, "fetch_all_terms", fake_fetch_all_terms)
        monkeypatch.setattr(quiz.random, "choice", lambda seq: seq[0])
        monkeypatch.setattr(quiz.random, "sample", lambda seq, count: list(seq)[:count])
        monkeypatch.setattr(quiz.random, "shuffle", lambda seq: None)

        text, keyboard = asyncio.run(build_quiz("en"))

        assert text and "Liquidity" in text
        assert keyboard is not None

        buttons = option_rows(keyboard)
        assert len(buttons) == 4
        button_texts = [row[0].text for row in buttons]
        callback_data = [row[0].callback_data for row in buttons]

        assert len(set(button_texts)) == 4
        assert callback_data.count("quiz:1:term_1") == 1
        assert all(data.startswith("quiz:") for data in callback_data if data)
        assert keyboard.inline_keyboard[-1][0].callback_data == "menu:main"

    def test_build_quiz_returns_none_when_there_are_not_four_unique_definitions(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        duplicate_terms = [
            make_term("term_1", "Liquidity", "Shared definition"),
            make_term("term_2", "Cash Flow", "Shared definition"),
            make_term("term_3", "Yield", "Income generated from an investment."),
            make_term("term_4", "Spread", "Difference between bid and ask."),
        ]

        async def fake_fetch_all_terms() -> list[dict[str, Any]]:
            return duplicate_terms

        monkeypatch.setattr(quiz, "fetch_all_terms", fake_fetch_all_terms)

        text, keyboard = asyncio.run(build_quiz("en"))

        assert text is None
        assert keyboard is None

    def test_build_quiz_returns_none_when_fewer_than_four_terms_are_available(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_fetch_all_terms() -> list[dict[str, Any]]:
            return sample_terms()[:3]

        monkeypatch.setattr(quiz, "fetch_all_terms", fake_fetch_all_terms)

        text, keyboard = asyncio.run(build_quiz("en"))

        assert text is None
        assert keyboard is None

    def test_build_quiz_result_shows_correct_answer_definition_for_wrong_responses(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_fetch_term_by_id(term_id: str) -> dict[str, Any]:
            assert term_id == "term_4"
            return make_term(
                "term_4",
                "Yield",
                "Income generated from an investment over time.",
            )

        monkeypatch.setattr(quiz, "fetch_term_by_id", fake_fetch_term_by_id)

        text, keyboard = asyncio.run(build_quiz_result("en", False, "term_4"))

        assert "Income generated from an investment over time." in text
        assert keyboard.inline_keyboard[0][0].callback_data == "menu:quiz"
        assert keyboard.inline_keyboard[0][1].callback_data == "menu:main"

    def test_build_quiz_result_uses_localized_success_copy_for_correct_answers(self) -> None:
        text, keyboard = asyncio.run(build_quiz_result("ru", True, "term_1"))

        assert text == t("quiz_correct", "ru")
        assert keyboard.inline_keyboard[0][0].callback_data == "menu:quiz"


class TestCommandHandlers:
    def test_start_handler_sends_welcome_and_menu(self) -> None:
        message = DummyMessage()
        update = make_update(message=message)
        context = make_context()

        asyncio.run(handlers.start_handler(update, context))

        assert len(message.replies) == 1
        sent = message.replies[0]
        assert "Welcome to FinTechTerms" in sent.text
        assert sent.reply_markup is not None
        assert sent.reply_markup.inline_keyboard[0][0].callback_data == "menu:search"

    def test_menu_handler_sends_localized_menu(self) -> None:
        message = DummyMessage()
        update = make_update(message=message, language_code="tr")
        context = make_context()

        asyncio.run(handlers.menu_handler(update, context))

        sent = message.replies[0]
        assert "FinTechTerms Bot" in sent.text
        assert sent.reply_markup is not None
        assert sent.reply_markup.inline_keyboard[0][0].text.startswith("🔍 ")

    def test_search_handler_without_args_shows_prompt(self) -> None:
        message = DummyMessage()
        update = make_update(message=message)
        context = make_context()

        asyncio.run(handlers.search_handler(update, context))

        sent = message.replies[0]
        assert "search" in sent.text.casefold()
        assert sent.reply_markup is not None
        assert sent.reply_markup.inline_keyboard[0][0].callback_data == "menu:main"

    def test_search_handler_with_results_shows_first_term(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_search_terms(query: str, limit: int = 10) -> list[dict[str, Any]]:
            assert query == "liquidity"
            assert limit == 3
            return [sample_terms()[0]]

        monkeypatch.setattr(handlers, "search_terms", fake_search_terms)

        message = DummyMessage()
        update = make_update(message=message)
        context = make_context(args=["liquidity"])

        asyncio.run(handlers.search_handler(update, context))

        sent = message.replies[0]
        assert "Liquidity" in sent.text
        assert sent.reply_markup is not None
        assert sent.reply_markup.inline_keyboard[0][1].url == f"{WEB_APP_URL}/term/term_1"

    def test_daily_handler_sends_random_term(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_is_rate_limited(user_id: int) -> bool:
            assert user_id == 100
            return False

        async def fake_get_random_term() -> dict[str, Any]:
            return sample_terms()[1]

        monkeypatch.setattr(handlers, "is_rate_limited", fake_is_rate_limited)
        monkeypatch.setattr(handlers, "get_random_term", fake_get_random_term)

        message = DummyMessage()
        update = make_update(message=message)
        context = make_context()

        asyncio.run(handlers.daily_handler(update, context))

        sent = message.replies[0]
        assert "Volatility" in sent.text
        assert sent.reply_markup is not None
        assert sent.reply_markup.inline_keyboard[1][0].callback_data == "daily:next"

    def test_quiz_handler_uses_quiz_module_markup(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_is_rate_limited(user_id: int) -> bool:
            return False

        async def fake_build_quiz(lang: str) -> tuple[str, InlineKeyboardMarkup]:
            assert lang == "en"
            return "Quiz text", InlineKeyboardMarkup(
                [[InlineKeyboardButton("A) Option", callback_data="quiz:1:term_1")]]
            )

        monkeypatch.setattr(handlers, "is_rate_limited", fake_is_rate_limited)
        monkeypatch.setattr(handlers, "build_quiz", fake_build_quiz)

        message = DummyMessage()
        update = make_update(message=message)
        context = make_context()

        asyncio.run(handlers.quiz_handler(update, context))

        sent = message.replies[0]
        assert sent.text == "Quiz text"
        assert sent.reply_markup is not None
        assert sent.reply_markup.inline_keyboard[0][0].callback_data == "quiz:1:term_1"

    def test_quiz_handler_runs_the_real_quiz_builder(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_is_rate_limited(user_id: int) -> bool:
            return False

        async def fake_fetch_all_terms() -> list[dict[str, Any]]:
            return sample_terms()

        monkeypatch.setattr(handlers, "is_rate_limited", fake_is_rate_limited)
        monkeypatch.setattr(quiz, "fetch_all_terms", fake_fetch_all_terms)
        monkeypatch.setattr(quiz.random, "choice", lambda seq: seq[0])
        monkeypatch.setattr(quiz.random, "sample", lambda seq, count: list(seq)[:count])
        monkeypatch.setattr(quiz.random, "shuffle", lambda seq: None)

        message = DummyMessage()
        update = make_update(message=message)
        context = make_context()

        asyncio.run(handlers.quiz_handler(update, context))

        sent = message.replies[0]
        assert "Liquidity" in sent.text
        assert sent.reply_markup is not None
        assert len(option_rows(sent.reply_markup)) == 4

    def test_lang_handler_shows_language_picker(self) -> None:
        message = DummyMessage()
        update = make_update(message=message)
        context = make_context()

        asyncio.run(handlers.lang_handler(update, context))

        sent = message.replies[0]
        assert "language" in sent.text.casefold()
        assert sent.reply_markup is not None
        assert sent.reply_markup.inline_keyboard[0][0].callback_data == "lang:ru"

    def test_stats_handler_builds_stats_message(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_get_term_count() -> int:
            return 42

        async def fake_get_category_counts() -> dict[str, int]:
            return {"Finance": 20, "Technology": 22}

        monkeypatch.setattr(handlers, "get_term_count", fake_get_term_count)
        monkeypatch.setattr(handlers, "get_category_counts", fake_get_category_counts)

        message = DummyMessage()
        update = make_update(message=message)
        context = make_context()

        asyncio.run(handlers.stats_handler(update, context))

        sent = message.replies[0]
        assert "42" in sent.text
        assert WEB_APP_URL in sent.text
        assert "Technology" in sent.text

    def test_help_handler_sends_help_copy(self) -> None:
        message = DummyMessage()
        update = make_update(message=message)
        context = make_context()

        asyncio.run(handlers.help_handler(update, context))

        sent = message.replies[0]
        assert "/search" in sent.text
        assert sent.reply_markup is not None
        assert sent.reply_markup.inline_keyboard[0][0].callback_data == "menu:main"

    def test_text_handler_searches_plain_messages(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        captured: dict[str, Any] = {}

        async def fake_search_terms(query: str, limit: int = 10) -> list[dict[str, Any]]:
            captured["query"] = query
            captured["limit"] = limit
            return [sample_terms()[2]]

        monkeypatch.setattr(handlers, "search_terms", fake_search_terms)

        message = DummyMessage(text="hedging")
        update = make_update(message=message)
        context = make_context()

        asyncio.run(handlers.text_handler(update, context))

        sent = message.replies[0]
        assert captured == {"query": "hedging", "limit": 3}
        assert "Hedging" in sent.text

    def test_callback_handler_menu_quiz_edits_existing_message(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_build_quiz(lang: str) -> tuple[str, InlineKeyboardMarkup]:
            return "Quiz from callback", InlineKeyboardMarkup(
                [[InlineKeyboardButton("A) Option", callback_data="quiz:1:term_9")]]
            )

        monkeypatch.setattr(handlers, "build_quiz", fake_build_quiz)

        query = DummyQuery("menu:quiz")
        update = make_update(query=query)
        context = make_context()

        asyncio.run(handlers.callback_handler(update, context))

        assert len(query.edits) == 1
        assert query.edits[0].text == "Quiz from callback"
        assert query.edits[0].reply_markup is not None
        assert query.answer_calls[-1] == {"text": None, "show_alert": False}

    def test_callback_handler_quiz_wrong_answer_uses_real_quiz_result_builder(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        async def fake_fetch_term_by_id(term_id: str) -> dict[str, Any]:
            assert term_id == "term_4"
            return make_term(
                "term_4",
                "Yield",
                "Income generated from an investment over time.",
            )

        monkeypatch.setattr(quiz, "fetch_term_by_id", fake_fetch_term_by_id)

        query = DummyQuery("quiz:0:term_4")
        update = make_update(query=query)
        context = make_context()

        asyncio.run(handlers.callback_handler(update, context))

        assert len(query.edits) == 1
        assert "Income generated from an investment over time." in query.edits[0].text
        assert query.edits[0].reply_markup is not None
        assert query.edits[0].reply_markup.inline_keyboard[0][0].callback_data == "menu:quiz"
        assert query.answer_calls[-1] == {"text": None, "show_alert": False}


class TestReportHelpers:
    def test_accuracy_bar_generation(self) -> None:
        bar = build_accuracy_bar(70)
        assert len(bar) == 10
        assert bar.count("█") == 7
        assert bar.count("░") == 3

    def test_accuracy_bar_zero(self) -> None:
        assert build_accuracy_bar(0) == "░" * 10

    def test_accuracy_bar_full(self) -> None:
        assert build_accuracy_bar(100) == "█" * 10

    def test_choose_smart_tip_prioritizes_missing_searches(self) -> None:
        assert choose_smart_tip(0, 2, 1, "en") == t("report_tip_search", "en")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
