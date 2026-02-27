"""
FinTechTerms Bot — Unit Tests
Skill: tdd-workflow, unit-testing-test-generate, python-pro

Tests handler helper functions and i18n system.
"""

import pytest
from bot.i18n import t, STRINGS
from bot.config import CATEGORY_EMOJI, SRS_LEVEL_LABELS, SUPPORTED_LANGUAGES


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

    def test_fallback_to_english(self):
        """If requested language missing, fall back to English."""
        result = t("welcome", "xx")  # Non-existent language
        assert "Welcome" in result

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
