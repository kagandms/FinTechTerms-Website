import 'server-only';

import { fullRepoTerms } from '@/data/terms/repo-catalog';
import { seoContributors } from '@/data/seo/contributors';
import {
    PRIORITY_TERM_COUNT,
    priorityTermRecordBySlug,
    priorityTermRecords,
} from '@/data/seo/priority-terms';
import { seoSources } from '@/data/seo/sources';
import { seoTopics } from '@/data/seo/topics';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import type { Contributor, Language, LocalizedText, PriorityTermRecord, RegionalMarket, SourceRef, Term, Topic } from '@/types';

interface SeoCatalog {
    readonly terms: readonly Term[];
    readonly termById: ReadonlyMap<string, Term>;
    readonly termBySlug: ReadonlyMap<string, Term>;
    readonly topicById: ReadonlyMap<string, Topic>;
    readonly topicBySlug: ReadonlyMap<string, Topic>;
    readonly contributorById: ReadonlyMap<string, Contributor>;
    readonly contributorBySlug: ReadonlyMap<string, Contributor>;
    readonly sourceById: ReadonlyMap<string, SourceRef>;
}

const WIDE_MARKET_TOPICS = new Set<string>([
    'cards-payments',
    'open-banking',
    'regtech-compliance',
    'market-microstructure',
    'fraud-identity-security',
    'ai-data-finance',
]);

const TOPIC_KEYWORDS: Record<string, readonly string[]> = {
    'cards-payments': ['payment', 'card', 'wallet', 'gateway', 'chargeback', 'acquirer', 'issuer', 'merchant', 'bnpl'],
    'open-banking': ['open banking', 'psd2', 'sepa', 'swift', 'iban', 'iso 20022', 'fednow', 'api'],
    'regtech-compliance': ['kyc', 'aml', 'regtech', 'mica', 'sandbox', 'compliance', 'authentication'],
    'crypto-infrastructure': ['blockchain', 'crypto', 'bitcoin', 'ethereum', 'rollup', 'validator', 'oracle', 'account abstraction', 'mev'],
    'rwa-tokenization': ['token', 'tokenization', 'stablecoin', 'rwa', 'cbdc', 'wrapped'],
    'market-microstructure': ['market', 'spread', 'slippage', 'order', 'latency', 'liquidity', 'arbitrage', 'trading'],
    'fraud-identity-security': ['fraud', 'security', 'phishing', 'private key', 'biometric', '2fa', 'authentication', 'blind signing'],
    'ai-data-finance': ['ai', 'machine learning', 'data', 'analytics', 'algorithm', 'predictive', 'language processing'],
};

const PRIORITY_SLUG_TO_TOPICS = seoTopics.reduce<Map<string, Set<string>>>((map, topic) => {
    for (const slug of topic.priorityTermSlugs) {
        const topicIds = map.get(slug) ?? new Set<string>();
        topicIds.add(topic.id);
        map.set(slug, topicIds);
    }

    return map;
}, new Map<string, Set<string>>());

const dedupe = <T,>(values: readonly T[]): T[] => Array.from(new Set(values));
const isReducedTestCatalog = (catalog: readonly Term[]): boolean => catalog.length <= 5;

const getPriorityRecord = (term: Pick<Term, 'slug'>): PriorityTermRecord | null => (
    priorityTermRecordBySlug.get(term.slug) ?? null
);

const getTopicKeywordHits = (term: Term): string[] => {
    const haystack = `${term.term_en} ${term.definition_en}`.toLowerCase();

    return Object.entries(TOPIC_KEYWORDS).flatMap(([topicId, keywords]) => (
        keywords.some((keyword) => haystack.includes(keyword)) ? [topicId] : []
    ));
};

const getFallbackTopicIds = (term: Term): string[] => {
    if (term.category === 'Finance') {
        return ['market-microstructure'];
    }

    if (term.category === 'Technology') {
        return ['ai-data-finance'];
    }

    if (term.term_en.toLowerCase().includes('blockchain') || term.term_en.toLowerCase().includes('crypto')) {
        return ['crypto-infrastructure'];
    }

    return ['cards-payments'];
};

const resolveTopicIds = (term: Term): string[] => {
    const priorityRecord = getPriorityRecord(term);

    if (priorityRecord) {
        return [priorityRecord.topicId];
    }

    const curatedTopicIds = PRIORITY_SLUG_TO_TOPICS.get(term.slug);
    const combinedTopicIds = dedupe([
        ...term.topic_ids,
        ...(curatedTopicIds ? Array.from(curatedTopicIds) : []),
        ...getTopicKeywordHits(term),
    ]);

    if (combinedTopicIds.length > 0) {
        return combinedTopicIds.slice(0, 3);
    }

    return getFallbackTopicIds(term);
};

const resolveRegionalMarkets = (term: Term, topicIds: readonly string[]): readonly RegionalMarket[] => {
    const priorityRecord = getPriorityRecord(term);

    if (priorityRecord) {
        return priorityRecord.regionalMarkets;
    }

    if (term.regional_markets.length > 0 && !(term.regional_markets.length === 1 && term.regional_markets[0] === 'GLOBAL' && topicIds.some((topicId) => WIDE_MARKET_TOPICS.has(topicId)))) {
        return term.regional_markets;
    }

    if (topicIds.some((topicId) => WIDE_MARKET_TOPICS.has(topicId))) {
        return ['BIST', 'MOEX', 'GLOBAL'];
    }

    return ['GLOBAL'];
};

const getPrimaryMarket = (regionalMarkets: readonly RegionalMarket[]): RegionalMarket => (
    regionalMarkets[0] ?? 'GLOBAL'
);

const getPrimaryTopic = (topicIds: readonly string[]): Topic => {
    const topic = seoTopics.find((candidate) => candidate.id === topicIds[0]);

    if (topic) {
        return topic;
    }

    const fallbackTopic = seoTopics[0];

    if (!fallbackTopic) {
        throw new Error('SEO topics catalog must contain at least one topic.');
    }

    return fallbackTopic;
};

const buildPriorityBlock = (
    term: Term,
    topic: Topic,
    regionalMarkets: readonly RegionalMarket[]
): Pick<Term, 'expanded_definition' | 'why_it_matters' | 'how_it_works' | 'risks_and_pitfalls' | 'regional_notes' | 'seo_title' | 'seo_description'> => ({
    expanded_definition: {
        en: `${term.definition_en} Within FinTechTerms, ${term.term_en} is grouped under ${topic.title.en.toLowerCase()} to explain where the concept sits in financial products, infrastructure, and market operations. ${term.example_sentence_en}`.trim(),
        ru: `${term.definition_ru} В FinTechTerms термин ${term.term_ru} отнесён к теме «${topic.title.ru.toLowerCase()}», чтобы показать его место в финансовых продуктах, инфраструктуре и рыночных процессах. ${term.example_sentence_ru}`.trim(),
        tr: `${term.definition_tr} FinTechTerms içinde ${term.term_tr}, finansal ürünler, altyapı ve piyasa operasyonları içindeki yerini göstermek için ${topic.title.tr.toLowerCase()} başlığı altında ele alınır. ${term.example_sentence_tr}`.trim(),
    },
    why_it_matters: {
        en: `${term.term_en} matters because it changes how teams evaluate product risk, user experience, compliance exposure, and financial interpretation.`,
        ru: `${term.term_ru} важен, потому что меняет подход к оценке продуктового риска, пользовательского опыта, комплаенс-нагрузки и финансовой интерпретации.`,
        tr: `${term.term_tr}, ürün riski, kullanıcı deneyimi, uyum yükü ve finansal yorumun nasıl değerlendirileceğini değiştirdiği için önemlidir.`,
    },
    how_it_works: {
        en: `In practice, ${term.term_en} is understood through its operational role, the systems it touches, and the market actors that depend on it.`,
        ru: `На практике ${term.term_ru} понимается через его операционную роль, затрагиваемые системы и рыночных участников, которые от него зависят.`,
        tr: `Pratikte ${term.term_tr}, operasyonel rolü, etkilediği sistemler ve ona bağlı piyasa aktörleri üzerinden anlaşılır.`,
    },
    risks_and_pitfalls: {
        en: `The main pitfall is to use ${term.term_en} as a buzzword without understanding the underlying controls, limits, and cross-border implications.`,
        ru: `Главная ошибка — использовать ${term.term_ru} как модное слово, не понимая базовых контролей, ограничений и трансграничных последствий.`,
        tr: `Temel hata, ${term.term_tr} kavramını altyapı kontrollerini, limitleri ve sınır ötesi etkileri anlamadan slogan gibi kullanmaktır.`,
    },
    regional_notes: {
        en: `This concept appears across ${regionalMarkets.join(', ')} contexts, but implementation can change with local regulation, payment rails, and institutional practice.`,
        ru: `Концепт встречается в контекстах ${regionalMarkets.join(', ')}, но реализация меняется в зависимости от локального регулирования, платёжных рельсов и институциональной практики.`,
        tr: `Bu kavram ${regionalMarkets.join(', ')} bağlamlarında görülür; ancak uygulama, yerel düzenleme, ödeme rayları ve kurumsal pratiğe göre değişebilir.`,
    },
    seo_title: {
        en: `${term.term_en} meaning in fintech and finance`,
        ru: `${term.term_ru}: значение в финтехе и финансах`,
        tr: `${term.term_tr} nedir: fintek ve finans anlamı`,
    },
    seo_description: {
        en: `Learn ${term.term_en} with definition, why it matters, how it works, risks, and ${regionalMarkets.join('/')} context.`,
        ru: `Изучите термин ${term.term_ru}: определение, значение, принцип работы, риски и контекст ${regionalMarkets.join('/')}.`,
        tr: `${term.term_tr} terimini tanım, önem, çalışma mantığı, riskler ve ${regionalMarkets.join('/')} bağlamıyla öğrenin.`,
    },
});

const enrichTerm = (term: Term): Term => {
    const priorityRecord = getPriorityRecord(term);
    const topicIds = resolveTopicIds(term);
    const regionalMarkets = resolveRegionalMarkets(term, topicIds);
    const priorityBlock = buildPriorityBlock(term, getPrimaryTopic(topicIds), regionalMarkets);
    const sourceRefs = priorityRecord?.requiredSourceIds
        ?? (term.source_refs.length > 0
        ? term.source_refs
        : getPrimaryTopic(topicIds).sourceIds.slice(0, 3));
    const indexPriority = priorityRecord ? 'high' : (PRIORITY_SLUG_TO_TOPICS.has(term.slug) ? 'high' : term.index_priority);

    return {
        ...term,
        topic_ids: topicIds,
        regional_markets: regionalMarkets,
        primary_market: getPrimaryMarket(regionalMarkets),
        regional_market: getPrimaryMarket(regionalMarkets),
        source_refs: sourceRefs,
        index_priority: indexPriority,
        comparison_term_id: term.comparison_term_id,
        prerequisite_term_id: term.prerequisite_term_id,
        ...(indexPriority === 'high' ? priorityBlock : {}),
    };
};

const buildRelatedTermIds = (catalog: readonly Term[], currentTerm: Term): readonly string[] => {
    const priorityRecord = getPriorityRecord(currentTerm);

    if (priorityRecord) {
        return priorityRecord.relatedSlugs
            .map((slug) => catalog.find((candidate) => candidate.slug === slug)?.id)
            .filter((value): value is string => Boolean(value))
            .slice(0, 6);
    }

    const sameTopic = catalog.filter((candidate) => (
        candidate.id !== currentTerm.id
        && candidate.topic_ids.some((topicId) => currentTerm.topic_ids.includes(topicId))
    ));
    const sameCategory = catalog.filter((candidate) => (
        candidate.id !== currentTerm.id
        && candidate.category === currentTerm.category
    ));
    const rankedTerms = [...sameTopic, ...sameCategory]
        .sort((left, right) => {
            if (left.index_priority === right.index_priority) {
                return left.term_en.localeCompare(right.term_en);
            }

            return left.index_priority === 'high' ? -1 : 1;
        })
        .map((term) => term.id);

    return dedupe(rankedTerms).slice(0, 6);
};

const buildComparisonTermId = (catalog: readonly Term[], currentTerm: Term): string | null => {
    const priorityRecord = getPriorityRecord(currentTerm);

    if (!priorityRecord?.comparisonSlug) {
        return currentTerm.comparison_term_id;
    }

    return catalog.find((candidate) => candidate.slug === priorityRecord.comparisonSlug)?.id ?? null;
};

const buildPrerequisiteTermId = (catalog: readonly Term[], currentTerm: Term): string | null => {
    const priorityRecord = getPriorityRecord(currentTerm);

    if (!priorityRecord?.prerequisiteSlug) {
        return currentTerm.prerequisite_term_id;
    }

    return catalog.find((candidate) => candidate.slug === priorityRecord.prerequisiteSlug)?.id ?? null;
};

const validatePriorityRegistry = (catalog: readonly Term[]): void => {
    const termSlugSet = new Set(catalog.map((term) => term.slug));
    const sourceIdSet = new Set(seoSources.map((source) => source.id));
    const contributorIdSet = new Set(seoContributors.map((contributor) => contributor.id));
    const reducedCatalog = isReducedTestCatalog(catalog);
    const missingTermSlugs = priorityTermRecords
        .map((record) => record.slug)
        .filter((slug) => !termSlugSet.has(slug));
    const missingSourceIds = priorityTermRecords.flatMap((record) => (
        record.requiredSourceIds.filter((sourceId) => !sourceIdSet.has(sourceId))
    ));
    const missingContributors = catalog.filter((term) => !contributorIdSet.has(term.author_id) || !contributorIdSet.has(term.reviewer_id));

    if (missingTermSlugs.length > 0) {
        if (reducedCatalog) {
            return;
        }
        throw new Error(`Priority term registry contains unknown slugs: ${missingTermSlugs.join(', ')}`);
    }

    if (missingSourceIds.length > 0) {
        throw new Error(`Priority term registry contains unknown source ids: ${missingSourceIds.join(', ')}`);
    }

    if (missingContributors.length > 0) {
        throw new Error('SEO catalog contains terms with unknown author or reviewer ids.');
    }

    const incompletePriorityTerms = priorityTermRecords.flatMap((record) => {
        const term = catalog.find((candidate) => candidate.slug === record.slug);

        if (!term) {
            return [];
        }

        const errors: string[] = [];

        if (term.source_refs.length < 3) {
            errors.push('source quorum');
        }
        if (term.related_term_ids.length < 3) {
            errors.push('related terms');
        }
        if (!term.comparison_term_id) {
            errors.push('comparison term');
        }
        if (!term.prerequisite_term_id) {
            errors.push('prerequisite term');
        }

        return errors.length > 0 ? [`${record.slug}: ${errors.join(', ')}`] : [];
    });

    if (incompletePriorityTerms.length > 0) {
        if (reducedCatalog) {
            return;
        }
        throw new Error(`Priority SEO terms are incomplete: ${incompletePriorityTerms.join('; ')}`);
    }
};

const buildCatalog = (): SeoCatalog => {
    const enrichedTerms = filterAcademicTerms(fullRepoTerms).map(enrichTerm);
    const catalog = enrichedTerms.map((term) => ({
        ...term,
        related_term_ids: buildRelatedTermIds(enrichedTerms, term),
        comparison_term_id: buildComparisonTermId(enrichedTerms, term),
        prerequisite_term_id: buildPrerequisiteTermId(enrichedTerms, term),
    }));
    validatePriorityRegistry(catalog);

    return {
        terms: catalog,
        termById: new Map(catalog.map((term) => [term.id, term] as const)),
        termBySlug: new Map(catalog.map((term) => [term.slug, term] as const)),
        topicById: new Map(seoTopics.map((topic) => [topic.id, topic] as const)),
        topicBySlug: new Map(seoTopics.map((topic) => [topic.slug, topic] as const)),
        contributorById: new Map(seoContributors.map((contributor) => [contributor.id, contributor] as const)),
        contributorBySlug: new Map(seoContributors.map((contributor) => [contributor.slug, contributor] as const)),
        sourceById: new Map(seoSources.map((source) => [source.id, source] as const)),
    };
};

const seoCatalog = buildCatalog();

export const getLocalizedText = (value: LocalizedText, locale: Language): string => (
    value[locale] || value.en || value.ru || value.tr
);

export const getLocalizedTermLabel = (term: Term, locale: Language): string => (
    locale === 'ru' ? term.term_ru : locale === 'tr' ? term.term_tr : term.term_en
);

export const getLocalizedTermDefinition = (term: Term, locale: Language): string => (
    locale === 'ru' ? term.definition_ru : locale === 'tr' ? term.definition_tr : term.definition_en
);

export const getLocalizedTermSeoTitle = (term: Term, locale: Language): string => (
    getLocalizedText(term.seo_title, locale)
);

export const getLocalizedTermSeoDescription = (term: Term, locale: Language): string => (
    getLocalizedText(term.seo_description, locale)
);

export const listSeoTerms = async (): Promise<readonly Term[]> => seoCatalog.terms;

export const getSeoTermBySlug = async (slug: string): Promise<Term | null> => (
    seoCatalog.termBySlug.get(slug) ?? null
);

export const getSeoTermById = async (termId: string): Promise<Term | null> => (
    seoCatalog.termById.get(termId) ?? null
);

export const listGlossaryTerms = async (locale: Language): Promise<readonly Term[]> => (
    [...seoCatalog.terms].sort((left, right) => (
        getLocalizedTermLabel(left, locale).localeCompare(getLocalizedTermLabel(right, locale), locale)
    ))
);

export const listPrioritySeoTerms = async (limit = 12): Promise<readonly Term[]> => (
    priorityTermRecords
        .map((record) => seoCatalog.termBySlug.get(record.slug))
        .filter((term): term is Term => Boolean(term))
        .slice(0, limit)
);

export const listStaticPriorityTermSlugs = async (): Promise<readonly string[]> => (
    priorityTermRecords
        .map((record) => record.slug)
        .filter((slug) => seoCatalog.termBySlug.has(slug))
);

export const listPriorityTermRecords = async (): Promise<readonly PriorityTermRecord[]> => (
    priorityTermRecords.filter((record) => seoCatalog.termBySlug.has(record.slug))
);
export const getPriorityTermCount = (): number => (
    priorityTermRecords.filter((record) => seoCatalog.termBySlug.has(record.slug)).length
);

export const listSeoTopics = async (): Promise<readonly Topic[]> => seoTopics;

export const listStaticTopicSlugs = async (): Promise<readonly string[]> => (
    seoTopics.map((topic) => topic.slug)
);

export const getSeoTopicBySlug = async (slug: string): Promise<Topic | null> => (
    seoCatalog.topicBySlug.get(slug) ?? null
);

export const getSeoTopicById = async (topicId: string): Promise<Topic | null> => (
    seoCatalog.topicById.get(topicId) ?? null
);

export const listTopicTerms = async (topicId: string): Promise<readonly Term[]> => (
    seoCatalog.terms.filter((term) => term.topic_ids.includes(topicId))
);

export const listSeoContributors = async (): Promise<readonly Contributor[]> => seoContributors;

export const listStaticContributorSlugs = async (): Promise<readonly string[]> => (
    seoContributors.map((contributor) => contributor.slug)
);

export const getSeoContributorBySlug = async (slug: string): Promise<Contributor | null> => (
    seoCatalog.contributorBySlug.get(slug) ?? null
);

export const listSeoSources = async (): Promise<readonly SourceRef[]> => seoSources;

export const getSeoSourceById = async (sourceId: string): Promise<SourceRef | null> => (
    seoCatalog.sourceById.get(sourceId) ?? null
);

export const listRelatedTerms = async (term: Term): Promise<readonly Term[]> => (
    term.related_term_ids
        .map((termId) => seoCatalog.termById.get(termId))
        .filter((candidate): candidate is Term => Boolean(candidate))
);

export const getComparisonTerm = async (term: Term): Promise<Term | null> => (
    term.comparison_term_id ? seoCatalog.termById.get(term.comparison_term_id) ?? null : null
);

export const getPrerequisiteTerm = async (term: Term): Promise<Term | null> => (
    term.prerequisite_term_id ? seoCatalog.termById.get(term.prerequisite_term_id) ?? null : null
);

export const getSeoContributorById = async (contributorId: string): Promise<Contributor | null> => (
    seoCatalog.contributorById.get(contributorId) ?? null
);

export const listTermsByContributor = async (
    contributorId: string,
    role: 'author' | 'reviewer'
): Promise<readonly Term[]> => (
    seoCatalog.terms.filter((term) => (
        role === 'author'
            ? term.author_id === contributorId
            : term.reviewer_id === contributorId
    ))
);
