import 'server-only';

import { findRelevantAiTerms } from '@/lib/ai/grounding';
import type { AiChatResponse, AiQuizFeedback, AiStudyCoachResponse, AiTermExplainResponse, AiExplainMode } from '@/types/ai';
import type { Language, Term } from '@/types';

const getLocalizedTermLabel = (term: Term, language: Language): string => (
    language === 'tr' ? term.term_tr : language === 'ru' ? term.term_ru : term.term_en
);

const getLocalizedDefinition = (term: Term, language: Language): string => (
    language === 'tr' ? term.definition_tr : language === 'ru' ? term.definition_ru : term.definition_en
);

const getLocalizedExample = (term: Term, language: Language): string => (
    language === 'tr' ? term.example_sentence_tr : language === 'ru' ? term.example_sentence_ru : term.example_sentence_en
);

export const buildQuizFeedbackFallback = (
    term: Term,
    language: Language,
    selectedWrongLabel?: string | null
): AiQuizFeedback => {
    const label = getLocalizedTermLabel(term, language);
    const definition = getLocalizedDefinition(term, language);
    const example = getLocalizedExample(term, language);

    if (language === 'tr') {
        return {
            whyWrong: `${selectedWrongLabel ?? 'Seçilen cevap'}, "${definition}" tanımını karşılamıyor.`,
            whyCorrect: `${label} doğru cevaptır çünkü bu tanım doğrudan bu kavrama karşılık gelir.`,
            memoryHook: `${label} için aklında şunu tut: ${example}`,
            confusedWith: selectedWrongLabel
                ? `${label} ile ${selectedWrongLabel} benzer alanlarda geçebilir, ama karar verirken tanıma odaklanmalısın.`
                : `${label} kavramını ezberlerken önce tanımı, sonra örneği hatırla.`,
        };
    }

    if (language === 'ru') {
        return {
            whyWrong: `${selectedWrongLabel ?? 'Выбранный вариант'} не соответствует определению «${definition}».`,
            whyCorrect: `${label} — правильный ответ, потому что именно этот термин отражает данное определение.`,
            memoryHook: `Запомните ${label} через этот пример: ${example}`,
            confusedWith: selectedWrongLabel
                ? `${label} можно спутать с ${selectedWrongLabel}, если смотреть только на тему. Проверяйте точное определение.`
                : `Для ${label} сначала держите в голове определение, а затем пример.`,
        };
    }

    return {
        whyWrong: `${selectedWrongLabel ?? 'The selected answer'} does not match the definition “${definition}”.`,
        whyCorrect: `${label} is correct because this definition points directly to that concept.`,
        memoryHook: `Remember ${label} through this example: ${example}`,
        confusedWith: selectedWrongLabel
            ? `${label} can be confused with ${selectedWrongLabel}, so anchor on the exact definition first.`
            : `For ${label}, remember the definition first and the example second.`,
    };
};

export const buildTermExplainFallback = (
    term: Term,
    language: Language,
    mode: AiExplainMode
): AiTermExplainResponse => {
    const label = getLocalizedTermLabel(term, language);
    const definition = getLocalizedDefinition(term, language);
    const example = getLocalizedExample(term, language);
    const secondaryTerms = [
        `EN: ${term.term_en}`,
        `TR: ${term.term_tr}`,
        `RU: ${term.term_ru}`,
    ];

    if (language === 'tr') {
        if (mode === 'language-bridge') {
            return {
                title: `${label} için dil köprüsü`,
                summary: `${label} kavramı üç dilde aynı çekirdeği taşır: ${definition}`,
                keyPoints: secondaryTerms,
                memoryHook: `Tanımı örnekle bağla: ${example}`,
            };
        }

        return {
            title: `${label} için kısa AI açıklaması`,
            summary: definition,
            keyPoints: [
                `${term.category} kategorisindedir.`,
                `Bölgesel bağlamı: ${term.regional_market}.`,
                `Örnek kullanım: ${example}`,
            ],
            memoryHook: `${label} kavramını bu örnekle hatırla: ${example}`,
        };
    }

    if (language === 'ru') {
        if (mode === 'language-bridge') {
            return {
                title: `Языковой мост для ${label}`,
                summary: `${label} сохраняет одно и то же ядро смысла на трёх языках: ${definition}`,
                keyPoints: secondaryTerms,
                memoryHook: `Свяжите определение с примером: ${example}`,
            };
        }

        return {
            title: `Краткое AI-объяснение для ${label}`,
            summary: definition,
            keyPoints: [
                `Категория: ${term.category}.`,
                `Региональный контекст: ${term.regional_market}.`,
                `Пример использования: ${example}`,
            ],
            memoryHook: `Запомните ${label} через пример: ${example}`,
        };
    }

    if (mode === 'language-bridge') {
        return {
            title: `Language bridge for ${label}`,
            summary: `${label} keeps the same core meaning across all three languages: ${definition}`,
            keyPoints: secondaryTerms,
            memoryHook: `Link the definition to this example: ${example}`,
        };
    }

    return {
        title: `Quick AI explanation for ${label}`,
        summary: definition,
        keyPoints: [
            `Category: ${term.category}.`,
            `Regional context: ${term.regional_market}.`,
            `Example in use: ${example}`,
        ],
        memoryHook: `Remember ${label} through this example: ${example}`,
    };
};

export const buildStudyCoachFallback = (
    language: Language,
    summary: {
        favorites: Array<{ label: string; category: string }>;
        recentWrongTerms: Array<{ label: string; category: string; wrongCount: number }>;
        dueToday: number;
        accuracy: number | null;
        currentStreak: number;
        mistakeQueueCount: number;
    }
): AiStudyCoachResponse => {
    const topWrongTerm = summary.recentWrongTerms[0]?.label;
    const firstFavorite = summary.favorites[0]?.label;

    if (language === 'tr') {
        return {
            focusAreas: [
                topWrongTerm ? `${topWrongTerm} ve benzer kavramlar` : 'Son yanlış yapılan kavramlar',
                summary.dueToday > 0 ? `Bugünkü ${summary.dueToday} tekrar kartı` : 'Yeni tekrar planı',
            ],
            todayPlan: [
                summary.mistakeQueueCount > 0 ? `Önce hata tekrarı kuyruğundaki ${summary.mistakeQueueCount} kartı çöz.` : 'Önce kısa bir tekrar turu yap.',
                firstFavorite ? `${firstFavorite} gibi favori kavramları yeniden gözden geçir.` : 'Favori kavramlarını yeniden gözden geçir.',
                'Son turda zorlandığın tanımları yüksek sesle tekrar et.',
            ],
            reason: summary.accuracy !== null ? `Doğruluk oranına (%${summary.accuracy}) ve yanlış yapılan kavramlara göre odak bu alanlarda yoğunlaştırıldı.` : 'Son zorlanılan kavramlar ve tekrar yükü baz alınarak plan hazırlandı.',
            encouragement: summary.currentStreak > 0 ? `Serin ${summary.currentStreak} gün. Aynı ritmi korursan hatırlama daha hızlı oturur.` : 'Kısa ama düzenli tekrar, bugün için en yüksek getiriyi sağlayacak.',
        };
    }

    if (language === 'ru') {
        return {
            focusAreas: [
                topWrongTerm ? `${topWrongTerm} и похожие понятия` : 'Недавние ошибки',
                summary.dueToday > 0 ? `Сегодняшние ${summary.dueToday} карточек повторения` : 'Новый план повторения',
            ],
            todayPlan: [
                summary.mistakeQueueCount > 0 ? `Сначала пройдите ${summary.mistakeQueueCount} карточек из очереди ошибок.` : 'Сначала сделайте короткий круг повторения.',
                firstFavorite ? `Повторите избранные термины вроде ${firstFavorite}.` : 'Повторите ваши избранные термины.',
                'Проговорите вслух определения, в которых недавно ошибались.',
            ],
            reason: summary.accuracy !== null ? `План опирается на точность (%${summary.accuracy}) и последние ошибки.` : 'План построен по последним трудным терминам и текущей нагрузке повторения.',
            encouragement: summary.currentStreak > 0 ? `Серия уже ${summary.currentStreak} дней. Сохраните ритм, и запоминание станет устойчивее.` : 'Короткое, но регулярное повторение сегодня даст наибольшую отдачу.',
        };
    }

    return {
        focusAreas: [
            topWrongTerm ? `${topWrongTerm} and similar concepts` : 'Recent mistakes',
            summary.dueToday > 0 ? `Today’s ${summary.dueToday} review cards` : 'A fresh review pass',
        ],
        todayPlan: [
            summary.mistakeQueueCount > 0 ? `Start with the ${summary.mistakeQueueCount} cards in your mistake queue.` : 'Start with a short review round.',
            firstFavorite ? `Revisit favorite terms such as ${firstFavorite}.` : 'Revisit your saved favorite terms.',
            'Say the tricky definitions out loud before your next round.',
        ],
        reason: summary.accuracy !== null ? `This plan is based on your accuracy (%${summary.accuracy}) and the terms you missed most recently.` : 'This plan is based on recent misses and your current review load.',
        encouragement: summary.currentStreak > 0 ? `You are on a ${summary.currentStreak}-day streak. Keep the rhythm and retention will settle faster.` : 'A short, consistent study session will give you the highest return today.',
    };
};

export const buildChatFallback = (
    language: Language,
    message: string
): AiChatResponse => {
    const relevantTerms = findRelevantAiTerms(message, 3);
    const relatedTerms = relevantTerms.map((term) => term.slug);

    if (relevantTerms.length === 0) {
        if (language === 'tr') {
            return {
                answer: 'Şu an ayrıntılı AI yanıtı üretemiyorum. Sorunu biraz daha belirgin bir finans, fintek veya teknoloji terimiyle tekrar deneyebilirsin.',
                relatedTerms: [],
                refused: false,
            };
        }

        if (language === 'ru') {
            return {
                answer: 'Сейчас я не могу сгенерировать подробный AI-ответ. Попробуйте задать вопрос через более конкретный финансовый, финтех- или технологический термин.',
                relatedTerms: [],
                refused: false,
            };
        }

        return {
            answer: 'I cannot generate a detailed AI answer right now. Try asking again with a more specific finance, fintech, or technology term.',
            relatedTerms: [],
            refused: false,
        };
    }

    if (language === 'tr') {
        const summary = relevantTerms.map((term) => `${term.term_tr}: ${term.definition_tr}`).join(' ');
        return {
            answer: `AI yanıtı şu an tam üretilemedi, ancak sözlük bağlamına göre en yakın kavramlar şunlar: ${summary}`,
            relatedTerms,
            refused: false,
        };
    }

    if (language === 'ru') {
        const summary = relevantTerms.map((term) => `${term.term_ru}: ${term.definition_ru}`).join(' ');
        return {
            answer: `Сейчас полный AI-ответ недоступен, но по словарному контексту ближе всего подходят такие термины: ${summary}`,
            relatedTerms,
            refused: false,
        };
    }

    const summary = relevantTerms.map((term) => `${term.term_en}: ${term.definition_en}`).join(' ');
    return {
        answer: `A full AI answer is unavailable right now, but the closest glossary context is: ${summary}`,
        relatedTerms,
        refused: false,
    };
};
