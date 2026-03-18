import { Term, TermContextTags } from '../../types';

const DEFAULT_AUTHOR_ID = 'kagan-samet-durmus';
const DEFAULT_REVIEWER_ID = 'fintechterms-editorial-review';
const DEFAULT_UPDATED_AT = '2026-03-15T00:00:00.000Z';

const defaultContextTagsByCategory: Record<Term['category'], TermContextTags> = {
    Fintech: {
        disciplines: ['economics', 'mis'],
        contest_tracks: ['economics'],
        target_universities: ['SPbU', 'HSE'],
        contest_profile: 'comparative-economics-mis',
    },
    Finance: {
        disciplines: ['economics'],
        contest_tracks: ['economics'],
        target_universities: ['SPbU', 'HSE'],
        contest_profile: 'russian-economics',
    },
    Technology: {
        disciplines: ['mis'],
        contest_tracks: ['mis'],
        target_universities: ['SPbU', 'HSE'],
        contest_profile: 'russian-mis',
    },
};

const cloneContextTags = (category: Term['category']): TermContextTags => {
    const template = defaultContextTagsByCategory[category];
    const cloned: TermContextTags = {};

    for (const [key, value] of Object.entries(template)) {
        cloned[key] = Array.isArray(value) ? [...value] as typeof value : value;
    }

    return cloned;
};

const buildBaseSlug = (value: string): string => (
    value
        .trim()
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'term'
);

const buildLocalizedText = (
    en: string,
    ru: string,
    tr: string
): Term['short_definition'] => ({
    en,
    ru,
    tr,
});

interface CreateTermOptions extends Partial<Pick<
    Term,
    | 'context_tags'
    | 'regional_market'
    | 'regional_markets'
    | 'primary_market'
    | 'is_academic'
    | 'difficulty_level'
    | 'related_term_ids'
    | 'comparison_term_id'
    | 'prerequisite_term_id'
    | 'topic_ids'
    | 'source_refs'
    | 'author_id'
    | 'reviewer_id'
    | 'reviewed_at'
    | 'updated_at'
    | 'index_priority'
    | 'short_definition'
    | 'expanded_definition'
    | 'why_it_matters'
    | 'how_it_works'
    | 'risks_and_pitfalls'
    | 'regional_notes'
    | 'seo_title'
    | 'seo_description'
    | 'slug'
>> {}

export const createTerm = (
    id: string,
    en: string, ru: string, tr: string,
    category: Term['category'],
    defEn: string, defRu: string, defTr: string,
    exEn: string, exRu: string, exTr: string,
    phonEn?: string, phonRu?: string, phonTr?: string,
    difficulty: number = 2.5,
    options?: CreateTermOptions
): Term => ({
    id,
    slug: options?.slug ?? buildBaseSlug(en),
    term_en: en,
    term_ru: ru,
    term_tr: tr,
    phonetic_en: phonEn,
    phonetic_ru: phonRu,
    phonetic_tr: phonTr,
    category,
    definition_en: defEn,
    definition_ru: defRu,
    definition_tr: defTr,
    example_sentence_en: exEn,
    example_sentence_ru: exRu,
    example_sentence_tr: exTr,
    short_definition: options?.short_definition ?? buildLocalizedText(defEn, defRu, defTr),
    expanded_definition: options?.expanded_definition ?? buildLocalizedText(
        `${defEn} ${exEn}`.trim(),
        `${defRu} ${exRu}`.trim(),
        `${defTr} ${exTr}`.trim()
    ),
    why_it_matters: options?.why_it_matters ?? buildLocalizedText(
        `${en} matters because it affects financial interpretation, product decisions, and industry communication.`,
        `${ru} важен, потому что влияет на финансовую интерпретацию, продуктовые решения и профессиональную коммуникацию.`,
        `${tr} önemlidir çünkü finansal yorumlamayı, ürün kararlarını ve profesyonel iletişimi etkiler.`
    ),
    how_it_works: options?.how_it_works ?? buildLocalizedText(
        `${en} is commonly explained through its core definition and the practical example used in the glossary.`,
        `${ru} обычно объясняется через базовое определение и практический пример из словаря.`,
        `${tr} genellikle temel tanımı ve sözlükte verilen pratik örnek üzerinden açıklanır.`
    ),
    risks_and_pitfalls: options?.risks_and_pitfalls ?? buildLocalizedText(
        `A common mistake is to use ${en} without understanding its operational and regulatory context.`,
        `Распространённая ошибка — использовать ${ru} без понимания его операционного и регуляторного контекста.`,
        `Yaygın hata, ${tr} kavramını operasyonel ve düzenleyici bağlamını anlamadan kullanmaktır.`
    ),
    regional_notes: options?.regional_notes ?? buildLocalizedText(
        `${en} may vary across payment rails, regulations, and market practices.`,
        `${ru} может различаться в зависимости от платёжной инфраструктуры, регулирования и рыночной практики.`,
        `${tr}, ödeme altyapısı, düzenleme ve piyasa uygulamalarına göre farklılaşabilir.`
    ),
    seo_title: options?.seo_title ?? buildLocalizedText(
        `${en} meaning in fintech`,
        `${ru}: определение в финтехе`,
        `${tr} nedir: fintek tanımı`
    ),
    seo_description: options?.seo_description ?? buildLocalizedText(
        `${en} explained in fintech, finance, and technology contexts.`,
        `${ru}: объяснение в контексте финтеха, финансов и технологий.`,
        `${tr}, fintek, finans ve teknoloji bağlamında açıklanır.`
    ),
    context_tags: {
        ...cloneContextTags(category),
        ...(options?.context_tags ?? {}),
    },
    regional_markets: options?.regional_markets ?? [options?.primary_market ?? options?.regional_market ?? 'GLOBAL'],
    primary_market: options?.primary_market ?? options?.regional_market ?? 'GLOBAL',
    regional_market: options?.primary_market ?? options?.regional_market ?? 'GLOBAL',
    is_academic: options?.is_academic ?? true,
    difficulty_level: options?.difficulty_level ?? 'intermediate',
    related_term_ids: options?.related_term_ids ?? [],
    comparison_term_id: options?.comparison_term_id ?? null,
    prerequisite_term_id: options?.prerequisite_term_id ?? null,
    topic_ids: options?.topic_ids ?? [],
    source_refs: options?.source_refs ?? [],
    author_id: options?.author_id ?? DEFAULT_AUTHOR_ID,
    reviewer_id: options?.reviewer_id ?? DEFAULT_REVIEWER_ID,
    reviewed_at: options?.reviewed_at ?? DEFAULT_UPDATED_AT,
    updated_at: options?.updated_at ?? DEFAULT_UPDATED_AT,
    index_priority: options?.index_priority ?? 'standard',
    srs_level: 1,
    next_review_date: new Date().toISOString(),
    last_reviewed: null,
    difficulty_score: difficulty,
    retention_rate: 0,
    times_reviewed: 0,
    times_correct: 0,
});
