"""
FinTechTerms Bot — Internationalisation (i18n)
Trilingual UI strings for the Telegram bot interface.
"""

from typing import Any

STRINGS: dict[str, dict[str, str]] = {
    # ── /start ─────────────────────────────────────
    "welcome": {
        "ru": (
            "👋 <b>Добро пожаловать в FinTechTerms Bot!</b>\n\n"
            "📖 Трёхъязычный словарь финансовых и IT-терминов\n"
            "🇬🇧 English · 🇹🇷 Türkçe · 🇷🇺 Русский\n\n"
            "Используйте кнопки ниже или команды:\n"
            "/search — Поиск термина\n"
            "/daily — Термин дня\n"
            "/quiz — Быстрый тест\n"
            "/lang — Сменить язык\n"
            "/stats — Статистика\n"
            "/help — Помощь"
        ),
        "en": (
            "👋 <b>Welcome to FinTechTerms Bot!</b>\n\n"
            "📖 Trilingual Finance & IT Dictionary\n"
            "🇬🇧 English · 🇹🇷 Türkçe · 🇷🇺 Русский\n\n"
            "Use the buttons below or commands:\n"
            "/search — Search a term\n"
            "/daily — Term of the day\n"
            "/quiz — Quick quiz\n"
            "/lang — Change language\n"
            "/stats — Statistics\n"
            "/help — Help"
        ),
        "tr": (
            "👋 <b>FinTechTerms Bot'a Hoş Geldiniz!</b>\n\n"
            "📖 Üç Dilli Finans & BT Sözlüğü\n"
            "🇬🇧 English · 🇹🇷 Türkçe · 🇷🇺 Русский\n\n"
            "Aşağıdaki butonları veya komutları kullanın:\n"
            "/search — Terim ara\n"
            "/daily — Günün terimi\n"
            "/quiz — Hızlı test\n"
            "/lang — Dil değiştir\n"
            "/stats — İstatistikler\n"
            "/help — Yardım"
        ),
    },
    # ── Search ──────────────────────────────────────
    "search_prompt": {
        "ru": "🔍 Введите термин для поиска (на любом из 3 языков):",
        "en": "🔍 Enter a term to search (in any of 3 languages):",
        "tr": "🔍 Aramak istediğiniz terimi girin (3 dilden herhangi birinde):",
    },
    "search_no_results": {
        "ru": "😕 Ничего не найдено по запросу «{query}».\nПопробуйте другой запрос.",
        "en": "😕 No results found for \"{query}\".\nTry a different search.",
        "tr": "😕 «{query}» için sonuç bulunamadı.\nBaşka bir arama deneyin.",
    },
    "search_results_header": {
        "ru": "🔎 Найдено <b>{count}</b> результат(ов) по запросу «{query}»:",
        "en": "🔎 Found <b>{count}</b> result(s) for \"{query}\":",
        "tr": "🔎 «{query}» için <b>{count}</b> sonuç bulundu:",
    },
    # ── Daily Term ──────────────────────────────────
    "daily_header": {
        "ru": "📖 <b>Термин дня</b>",
        "en": "📖 <b>Term of the Day</b>",
        "tr": "📖 <b>Günün Terimi</b>",
    },
    # ── Quiz ────────────────────────────────────────
    "quiz_question": {
        "ru": "🎯 <b>Тест:</b> Что такое <b>{term}</b>?",
        "en": "🎯 <b>Quiz:</b> What is <b>{term}</b>?",
        "tr": "🎯 <b>Test:</b> <b>{term}</b> nedir?",
    },
    "quiz_correct": {
        "ru": "✅ Правильно! Отличная работа!",
        "en": "✅ Correct! Great job!",
        "tr": "✅ Doğru! Harika!",
    },
    "quiz_wrong": {
        "ru": "❌ Неправильно.\n\n📖 Правильный ответ:\n<i>{answer}</i>",
        "en": "❌ Incorrect.\n\n📖 The correct answer:\n<i>{answer}</i>",
        "tr": "❌ Yanlış.\n\n📖 Doğru cevap:\n<i>{answer}</i>",
    },
    "quiz_no_terms": {
        "ru": "⚠️ Нет доступных терминов для теста.",
        "en": "⚠️ No terms available for quiz.",
        "tr": "⚠️ Test için uygun terim bulunamadı.",
    },
    # ── Language ────────────────────────────────────
    "lang_prompt": {
        "ru": "🌍 Выберите язык интерфейса:",
        "en": "🌍 Choose your interface language:",
        "tr": "🌍 Arayüz dilini seçin:",
    },
    "lang_changed": {
        "ru": "✅ Язык изменён на <b>Русский</b> 🇷🇺",
        "en": "✅ Language changed to <b>English</b> 🇬🇧",
        "tr": "✅ Dil <b>Türkçe</b> 🇹🇷 olarak değiştirildi",
    },
    # ── Stats ───────────────────────────────────────
    "stats_header": {
        "ru": (
            "📊 <b>Статистика FinTechTerms</b>\n\n"
            "📖 Всего терминов: <b>{total}</b>\n"
        ),
        "en": (
            "📊 <b>FinTechTerms Statistics</b>\n\n"
            "📖 Total terms: <b>{total}</b>\n"
        ),
        "tr": (
            "📊 <b>FinTechTerms İstatistikleri</b>\n\n"
            "📖 Toplam terim: <b>{total}</b>\n"
        ),
    },
    "stats_category": {
        "ru": "{emoji} {name}: <b>{count}</b> терминов",
        "en": "{emoji} {name}: <b>{count}</b> terms",
        "tr": "{emoji} {name}: <b>{count}</b> terim",
    },
    # ── Help ────────────────────────────────────────
    "help": {
        "ru": (
            "ℹ️ <b>Справка — FinTechTerms Bot</b>\n\n"
            "Этот бот — часть проекта FinTechTerms,\n"
            "трёхъязычного словаря финансовых и IT-терминов.\n\n"
            "<b>Команды:</b>\n"
            "/start — Главное меню\n"
            "/search <i>запрос</i> — Поиск термина\n"
            "/daily — Случайный термин дня\n"
            "/quiz — Мини-тест на знание терминов\n"
            "/lang — Сменить язык (RU/EN/TR)\n"
            "/stats — Статистика базы данных\n"
            "/help — Эта справка\n\n"
            "🌐 Веб-приложение: fintechterms.vercel.app"
        ),
        "en": (
            "ℹ️ <b>Help — FinTechTerms Bot</b>\n\n"
            "This bot is part of the FinTechTerms project,\n"
            "a trilingual finance & IT dictionary.\n\n"
            "<b>Commands:</b>\n"
            "/start — Main menu\n"
            "/search <i>query</i> — Search a term\n"
            "/daily — Random term of the day\n"
            "/quiz — Mini knowledge quiz\n"
            "/lang — Change language (RU/EN/TR)\n"
            "/stats — Database statistics\n"
            "/help — This help page\n\n"
            "🌐 Web app: fintechterms.vercel.app"
        ),
        "tr": (
            "ℹ️ <b>Yardım — FinTechTerms Bot</b>\n\n"
            "Bu bot, üç dilli finans ve BT sözlüğü olan\n"
            "FinTechTerms projesinin bir parçasıdır.\n\n"
            "<b>Komutlar:</b>\n"
            "/start — Ana menü\n"
            "/search <i>sorgu</i> — Terim ara\n"
            "/daily — Rastgele günün terimi\n"
            "/quiz — Mini bilgi testi\n"
            "/lang — Dil değiştir (RU/EN/TR)\n"
            "/stats — Veritabanı istatistikleri\n"
            "/help — Bu yardım sayfası\n\n"
            "🌐 Web uygulama: fintechterms.vercel.app"
        ),
    },
    # ── Misc ────────────────────────────────────────
    "error": {
        "ru": "⚠️ Произошла ошибка. Пожалуйста, попробуйте позже.",
        "en": "⚠️ An error occurred. Please try again later.",
        "tr": "⚠️ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
    },
    "term_card": {
        "ru": (
            "{cat_emoji} <b>{category}</b>\n\n"
            "🇬🇧 <b>{term_en}</b>\n"
            "🇹🇷 {term_tr}\n"
            "🇷🇺 {term_ru}\n\n"
            "📝 <b>Определение:</b>\n<i>{definition}</i>\n\n"
            "💬 <b>Пример:</b>\n<i>«{example}»</i>"
        ),
        "en": (
            "{cat_emoji} <b>{category}</b>\n\n"
            "🇬🇧 <b>{term_en}</b>\n"
            "🇹🇷 {term_tr}\n"
            "🇷🇺 {term_ru}\n\n"
            "📝 <b>Definition:</b>\n<i>{definition}</i>\n\n"
            "💬 <b>Example:</b>\n<i>\"{example}\"</i>"
        ),
        "tr": (
            "{cat_emoji} <b>{category}</b>\n\n"
            "🇬🇧 <b>{term_en}</b>\n"
            "🇹🇷 {term_tr}\n"
            "🇷🇺 {term_ru}\n\n"
            "📝 <b>Tanım:</b>\n<i>{definition}</i>\n\n"
            "💬 <b>Örnek:</b>\n<i>«{example}»</i>"
        ),
    },
    "listen_button": {
        "ru": "🔊 Произношение",
        "en": "🔊 Pronunciation",
        "tr": "🔊 Telaffuz",
    },
    "open_web": {
        "ru": "🌐 Открыть в браузере",
        "en": "🌐 Open in browser",
        "tr": "🌐 Tarayıcıda aç",
    },
    "next_term": {
        "ru": "➡️ Следующий",
        "en": "➡️ Next",
        "tr": "➡️ Sonraki",
    },
}


def t(key: str, lang: str = "ru", **kwargs: Any) -> str:
    """
    Get a translated string by key and language.
    Supports format kwargs for dynamic values.
    Falls back to English, then to the raw key.
    """
    entry = STRINGS.get(key)
    if entry is None:
        return key

    text = entry.get(lang) or entry.get("en") or key

    if kwargs:
        try:
            text = text.format(**kwargs)
        except (KeyError, IndexError):
            pass  # Return unformatted if placeholders don't match

    return text
