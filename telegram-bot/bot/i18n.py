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
            "/link — 🔗 Синхронизация с сайтом\n"
            "/report — Мой Отчёт\n"
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
            "/link — 🔗 Sync with web app\n"
            "/report — My Report\n"
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
            "/bagla — 🔗 Web sitesiyle eşle\n"
            "/report — Raporum\n"
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
            "/link — 🔗 Связать аккаунт с сайтом\n"
            "/report — Мой Отчёт об активности\n"
            "/lang — Сменить язык (RU/EN/TR)\n"
            "/stats — Статистика базы данных\n"
            "/help — Эта справка\n\n"
            "🌐 Веб-приложение: fintechterms.com"
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
            "/link — 🔗 Sync Web Account\n"
            "/report — My Activity Report\n"
            "/lang — Change language (RU/EN/TR)\n"
            "/stats — Database statistics\n"
            "/help — This help page\n\n"
            "🌐 Web app: fintechterms.com"
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
            "/bagla — 🔗 Web hesabı bağla\n"
            "/report — Aktivite Raporum\n"
            "/lang — Dil değiştir (RU/EN/TR)\n"
            "/stats — Veritabanı istatistikleri\n"
            "/help — Bu yardım sayfası\n\n"
            "🌐 Web uygulama: fintechterms.com"
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
    # ── Report ─────────────────────────────────────
    "report_header": {
        "ru": (
            "📋 <b>Ваш отчёт об активности</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━\n"
        ),
        "en": (
            "📋 <b>Your Activity Report</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━\n"
        ),
        "tr": (
            "📋 <b>Aktivite Raporunuz</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━\n"
        ),
    },
    "report_body": {
        "ru": (
            "🔍 Поисков выполнено: <b>{searches}</b>\n"
            "📖 Терминов просмотрено: <b>{terms_viewed}</b>\n"
            "📅 Термин дня: <b>{daily_used}</b> раз\n"
            "🔊 Прослушано произношений: <b>{tts_used}</b>\n"
            "📂 Категорий изучено: <b>{categories}</b>/3\n\n"
            "🎯 <b>Результаты тестов</b>\n"
            "   Пройдено: <b>{quizzes_taken}</b>\n"
            "   Верных: <b>{quizzes_correct}</b>\n"
            "   Точность: <b>{accuracy}%</b> {accuracy_bar}\n\n"
            "{tip}"
        ),
        "en": (
            "🔍 Searches made: <b>{searches}</b>\n"
            "📖 Terms viewed: <b>{terms_viewed}</b>\n"
            "📅 Daily term: <b>{daily_used}</b> times\n"
            "🔊 Pronunciations listened: <b>{tts_used}</b>\n"
            "📂 Categories explored: <b>{categories}</b>/3\n\n"
            "🎯 <b>Quiz Performance</b>\n"
            "   Taken: <b>{quizzes_taken}</b>\n"
            "   Correct: <b>{quizzes_correct}</b>\n"
            "   Accuracy: <b>{accuracy}%</b> {accuracy_bar}\n\n"
            "{tip}"
        ),
        "tr": (
            "🔍 Yapılan arama: <b>{searches}</b>\n"
            "📖 Görüntülenen terim: <b>{terms_viewed}</b>\n"
            "📅 Günün terimi: <b>{daily_used}</b> kez\n"
            "🔊 Dinlenen telaffuz: <b>{tts_used}</b>\n"
            "📂 Keşfedilen kategori: <b>{categories}</b>/3\n\n"
            "🎯 <b>Test Performansı</b>\n"
            "   Çözülen: <b>{quizzes_taken}</b>\n"
            "   Doğru: <b>{quizzes_correct}</b>\n"
            "   Doğruluk: <b>{accuracy}%</b> {accuracy_bar}\n\n"
            "{tip}"
        ),
    },
    "report_tip_search": {
        "ru": "💡 <i>Совет: Попробуйте /search для поиска новых терминов!</i>",
        "en": "💡 <i>Tip: Try /search to discover new terms!</i>",
        "tr": "💡 <i>İpucu: Yeni terimler keşfetmek için /search deneyin!</i>",
    },
    "report_tip_quiz": {
        "ru": "💡 <i>Совет: Пройдите больше тестов, чтобы улучшить результат!</i>",
        "en": "💡 <i>Tip: Take more quizzes to improve your score!</i>",
        "tr": "💡 <i>İpucu: Sonucunuzu iyileştirmek için daha fazla test çözün!</i>",
    },
    "report_tip_daily": {
        "ru": "💡 <i>Совет: Изучайте термин дня каждый день для прогресса!</i>",
        "en": "💡 <i>Tip: Check the daily term regularly for steady progress!</i>",
        "tr": "💡 <i>İpucu: Düzenli ilerleme için her gün günün terimini inceleyin!</i>",
    },
    "report_tip_great": {
        "ru": "🌟 <i>Отличная работа! Вы активно изучаете финтех-термины!</i>",
        "en": "🌟 <i>Great job! You're actively learning fintech terms!</i>",
        "tr": "🌟 <i>Harika iş! Fintek terimlerini aktif olarak öğreniyorsunuz!</i>",
    },
    # ── Account Dashboard (Russian-first UX) ──────────────
    "account_welcome": {
        "ru": (
            "👋 <b>Привет, {name}!</b>\n"
            "Merhaba, {name}!\n\n"
            "Выберите действие ниже."
        ),
        "en": (
            "👋 <b>Привет, {name}!</b>\n"
            "Hello, {name}!\n\n"
            "Choose an action below."
        ),
        "tr": (
            "👋 <b>Привет, {name}!</b>\n"
            "Merhaba, {name}!\n\n"
            "Aşağıdan bir işlem seçin."
        ),
    },
    "account_not_linked": {
        "ru": (
            "⚠️ <b>Ваш аккаунт еще не привязан.</b>\n"
            "Hesabınız henüz bağlanmamış.\n\n"
            "🔗 Нажмите кнопку ниже и завершите привязку на сайте."
        ),
        "en": (
            "⚠️ <b>Ваш аккаунт еще не привязан.</b>\n"
            "Your account is not linked yet.\n\n"
            "🔗 Tap the button below and complete linking on the website."
        ),
        "tr": (
            "⚠️ <b>Ваш аккаунт еще не привязан.</b>\n"
            "Hesabınız henüz bağlanmamış.\n\n"
            "🔗 Aşağıdaki butona basıp sitede bağlantıyı tamamlayın."
        ),
    },
    "link_account_button": {
        "ru": "Привязать аккаунт",
        "en": "Link account",
        "tr": "Hesabı bağla",
    },
    "account_data_error": {
        "ru": "❌ Ошибка синхронизации с базой: <code>{error}</code>",
        "en": "❌ Database sync error: <code>{error}</code>",
        "tr": "❌ Veritabanı senkronizasyon hatası: <code>{error}</code>",
    },
    "account_favorites_header": {
        "ru": "⭐ <b>Мои избранные ({count})</b>",
        "en": "⭐ <b>Мои избранные ({count})</b>",
        "tr": "⭐ <b>Мои избранные ({count})</b>",
    },
    "account_favorites_item": {
        "ru": "{num}. {cat_emoji} 🇷🇺 <b>{term_ru}</b> · 🇬🇧 {term_en} · 🇹🇷 {term_tr}",
        "en": "{num}. {cat_emoji} 🇷🇺 <b>{term_ru}</b> · 🇬🇧 {term_en} · 🇹🇷 {term_tr}",
        "tr": "{num}. {cat_emoji} 🇷🇺 <b>{term_ru}</b> · 🇬🇧 {term_en} · 🇹🇷 {term_tr}",
    },
    "account_favorites_more": {
        "ru": "… и ещё {remaining} термин(ов) на сайте.",
        "en": "… and {remaining} more term(s) on the website.",
        "tr": "… ve sitede {remaining} terim daha var.",
    },
    "account_favorites_footer": {
        "ru": "\n🌐 fintechterms.com",
        "en": "\n🌐 fintechterms.com",
        "tr": "\n🌐 fintechterms.com",
    },
    "account_favorites_empty": {
        "ru": "⭐ Избранных пока нет. Добавьте слова на сайте и вернитесь в /menu.",
        "en": "⭐ Favorites are empty. Add terms on the website and return to /menu.",
        "tr": "⭐ Henüz favori yok. Kelimeleri sitede ekleyip /menu'ye dönün.",
    },
    "account_stats": {
        "ru": (
            "📊 <b>Моя статистика</b>\n\n"
            "🎯 Тесты: <b>{quizzes_taken}</b>\n"
            "✅ Верно: <b>{quizzes_correct}</b>\n"
            "📈 Точность: <b>{accuracy}%</b>\n"
            "🆕 Добавлено слов: <b>{words_added}</b>\n"
            "🔁 Повторено слов: <b>{words_reviewed}</b>\n"
            "⭐ Избранных: <b>{favorites_count}</b>\n"
            "📅 Активных дней: <b>{active_days}</b>"
        ),
        "en": (
            "📊 <b>Моя статистика</b>\n\n"
            "🎯 Quizzes: <b>{quizzes_taken}</b>\n"
            "✅ Correct: <b>{quizzes_correct}</b>\n"
            "📈 Accuracy: <b>{accuracy}%</b>\n"
            "🆕 Added words: <b>{words_added}</b>\n"
            "🔁 Reviewed words: <b>{words_reviewed}</b>\n"
            "⭐ Favorites: <b>{favorites_count}</b>\n"
            "📅 Active days: <b>{active_days}</b>"
        ),
        "tr": (
            "📊 <b>Моя статистика</b>\n\n"
            "🎯 Testler: <b>{quizzes_taken}</b>\n"
            "✅ Doğru: <b>{quizzes_correct}</b>\n"
            "📈 Doğruluk: <b>{accuracy}%</b>\n"
            "🆕 Eklenen kelime: <b>{words_added}</b>\n"
            "🔁 Tekrar edilen: <b>{words_reviewed}</b>\n"
            "⭐ Favoriler: <b>{favorites_count}</b>\n"
            "📅 Aktif gün: <b>{active_days}</b>"
        ),
    },
    # ── Favorites ──────────────────────────────────
    "favorites_header": {
        "ru": "⭐ <b>Ваши избранные термины ({count})</b>\n━━━━━━━━━━━━━━━━━━━━━",
        "en": "⭐ <b>Your Favorite Terms ({count})</b>\n━━━━━━━━━━━━━━━━━━━━━",
        "tr": "⭐ <b>Favori Terimleriniz ({count})</b>\n━━━━━━━━━━━━━━━━━━━━━",
    },
    "favorites_empty": {
        "ru": (
            "⭐ <b>Избранные термины</b>\n\n"
            "У вас пока нет избранных терминов.\n\n"
            "💡 <i>Добавляйте термины в избранное на сайте fintechterms.com,\n"
            "нажимая на ⭐ при изучении слов!</i>"
        ),
        "en": (
            "⭐ <b>Favorite Terms</b>\n\n"
            "You don't have any favorite terms yet.\n\n"
            "💡 <i>Add terms to your favorites on fintechterms.com\n"
            "by tapping ⭐ while studying!</i>"
        ),
        "tr": (
            "⭐ <b>Favori Terimler</b>\n\n"
            "Henüz favori teriminiz bulunmuyor.\n\n"
            "💡 <i>fintechterms.com üzerinde kelimeleri çalışırken\n"
            "⭐ ikonuna tıklayarak favorilerinize ekleyebilirsiniz!</i>"
        ),
    },
    "favorites_item": {
        "ru": "\n{num}. {cat_emoji} <b>{term_en}</b>\n   🇹🇷 {term_tr} · 🇷🇺 {term_ru}",
        "en": "\n{num}. {cat_emoji} <b>{term_en}</b>\n   🇹🇷 {term_tr} · 🇷🇺 {term_ru}",
        "tr": "\n{num}. {cat_emoji} <b>{term_en}</b>\n   🇹🇷 {term_tr} · 🇷🇺 {term_ru}",
    },
    "favorites_footer": {
        "ru": "\n\n🌐 Управляйте избранным на fintechterms.com",
        "en": "\n\n🌐 Manage your favorites at fintechterms.com",
        "tr": "\n\n🌐 Favorilerinizi fintechterms.com üzerinden yönetin",
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
