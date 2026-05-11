import type {
    AiExplainMode,
    AiStudyCoachResponse,
    AiTermExplainResponse,
} from '@/types/ai';
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

export const buildLocalTermExplainFallback = (
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
                summary: `${label} сохраняет одно и то же ядро смысла на трех языках: ${definition}`,
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

export const buildLocalStudyCoachFallback = (
    language: Language,
    summary: {
        readonly favorites: ReadonlyArray<{ readonly label: string; readonly category: string }>;
        readonly recentWrongTerms: ReadonlyArray<{ readonly label: string; readonly category: string; readonly wrongCount: number }>;
        readonly dueToday: number;
        readonly accuracy: number | null;
        readonly currentStreak: number;
        readonly mistakeQueueCount: number;
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
            summary.dueToday > 0 ? `Today's ${summary.dueToday} review cards` : 'A fresh review pass',
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
