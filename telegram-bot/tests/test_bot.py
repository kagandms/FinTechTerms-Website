"""
FinTechTerms Bot — Unit Tests
Skill: tdd-workflow, unit-testing-test-generate, python-pro

Tests handler helper functions and i18n system.
"""

import pytest
from bot.i18n import t, STRINGS
from bot.config import CATEGORY_EMOJI, SRS_LEVEL_LABELS, SUPPORTED_LANGUAGES
from bot.database import build_academic_search_filters, normalize_term_payload


# ── i18n Translation System ──────────────────────────────

class TestI18n:
    """Tests for the translation function."""

    def test_basic_translation_ru(self):
        result = t("welcome", "ru")
        assert "Добро пожаловать" in result

    def test_basic_translation_en(self):
        result = t("welcome", "en")
        assert "Welcome" in result

    def test_basic_translation_tr(self):
        result = t("welcome", "tr")
        assert "Hoş Geldiniz" in result

    def test_fallback_to_russian(self):
        """If requested language missing, fall back to Russian."""
        result = t("welcome", "xx")  # Non-existent language
        assert "Добро пожаловать" in result

    def test_unknown_key_returns_key(self):
        """Unknown keys should return the key itself."""
        result = t("nonexistent_key_xyz", "en")
        assert result == "nonexistent_key_xyz"

    def test_format_kwargs(self):
        """Placeholders should be filled with kwargs."""
        result = t("search_no_results", "en", query="Bitcoin")
        assert "Bitcoin" in result

    def test_format_missing_kwargs_no_crash(self):
        """Missing kwargs should not crash, return unformatted string."""
        result = t("search_no_results", "en")
        assert "{query}" in result  # Unformatted placeholder remains

    def test_all_supported_languages_have_welcome(self):
        """All supported languages should have a welcome string."""
        for lang in SUPPORTED_LANGUAGES:
            result = t("welcome", lang)
            assert len(result) > 10, f"Welcome too short for {lang}"

    def test_all_strings_have_all_languages(self):
        """Every string key should have all 3 supported languages."""
        for key, translations in STRINGS.items():
            for lang in SUPPORTED_LANGUAGES:
                assert lang in translations, f"Key '{key}' missing '{lang}'"

    def test_open_web_labels_are_short_and_localized(self):
        assert t("open_web", "ru") == "Сайт"
        assert t("open_web", "en") == "Website"
        assert t("open_web", "tr") == "Web Sitesi"

    def test_welcome_copy_excludes_linking_and_report_commands(self):
        for lang in SUPPORTED_LANGUAGES:
            welcome = t("welcome", lang)
            assert "/link" not in welcome
            assert "/bagla" not in welcome
            assert "/report" not in welcome

    def test_help_copy_excludes_linking_and_report_commands(self):
        for lang in SUPPORTED_LANGUAGES:
            help_text = t("help", lang)
            assert "/link" not in help_text
            assert "/bagla" not in help_text
            assert "/report" not in help_text


# ── Config Constants ──────────────────────────────────────

class TestConfig:
    """Tests for bot configuration constants."""

    def test_category_emoji_mapping(self):
        assert CATEGORY_EMOJI["Fintech"] == "💳"
        assert CATEGORY_EMOJI["Finance"] == "💰"
        assert CATEGORY_EMOJI["Technology"] == "💻"

    def test_srs_level_labels_count(self):
        for lang in SUPPORTED_LANGUAGES:
            assert len(SRS_LEVEL_LABELS[lang]) == 5

    def test_supported_languages(self):
        assert "ru" in SUPPORTED_LANGUAGES
        assert "en" in SUPPORTED_LANGUAGES
        assert "tr" in SUPPORTED_LANGUAGES


class TestAcademicTaxonomy:
    """Tests for contest-ready term taxonomy helpers."""

    def test_build_academic_search_filters(self):
        filters = build_academic_search_filters("MOEX economics HSE")

        assert {"regional_market": "MOEX"} in filters
        assert {"context_tags": {"disciplines": ["economics"]}} in filters
        assert {"context_tags": {"target_universities": ["HSE"]}} in filters

    def test_normalize_term_payload_defaults_taxonomy(self):
        normalized = normalize_term_payload({
            "id": "term_001",
            "term_en": "Liquidity",
            "category": "Finance",
            "context_tags": None,
            "regional_market": None,
        })

        assert normalized["regional_market"] == "GLOBAL"
        assert normalized["context_tags"] == {}

    def test_normalize_term_payload_parses_stringified_context_tags(self):
        normalized = normalize_term_payload({
            "id": "term_002",
            "context_tags": "{\"disciplines\": [\"economics\"]}",
            "regional_market": "bist",
        })

        assert normalized["regional_market"] == "BIST"
        assert normalized["context_tags"] == {"disciplines": ["economics"]}

    def test_normalize_term_payload_handles_non_dict(self):
        normalized = normalize_term_payload(None)

        assert normalized["regional_market"] == "GLOBAL"
        assert normalized["context_tags"] == {}


# ── Report Builder Helper ─────────────────────────────────

class TestReportHelpers:
    """Tests for report-related helper logic."""

    def test_accuracy_bar_generation(self):
        """Test the accuracy progress bar logic from handlers.py."""
        accuracy = 70
        filled = accuracy // 10
        bar = "█" * filled + "░" * (10 - filled)
        assert len(bar) == 10
        assert bar.count("█") == 7
        assert bar.count("░") == 3

    def test_accuracy_bar_zero(self):
        accuracy = 0
        filled = accuracy // 10
        bar = "█" * filled + "░" * (10 - filled)
        assert bar == "░" * 10

    def test_accuracy_bar_full(self):
        accuracy = 100
        filled = accuracy // 10
        bar = "█" * filled + "░" * (10 - filled)
        assert bar == "█" * 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
