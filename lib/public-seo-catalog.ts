import 'server-only';

import { fullRepoTerms } from '@/data/terms/repo-catalog';
import { seoContributors } from '@/data/seo/contributors';
import { getEditorialAuthorityOverride } from '@/data/seo/editorial-authority';
import {
    PRIORITY_TERM_COUNT,
    priorityTermRecordBySlug,
    priorityTermRecords,
} from '@/data/seo/priority-terms';
import { seoSources } from '@/data/seo/sources';
import { seoTopics } from '@/data/seo/topics';
import { filterAcademicTerms } from '@/lib/academicQuarantine';
import type { Contributor, Language, LocalizedText, PriorityTermRecord, RegionalMarket, SourceRef, Term, Topic } from '@/types';

// SEO surfaces intentionally render the repo catalog. `public.terms` is expected
// to stay mirrored through release verification, not as the canonical authoring source.
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

type SeoContentBlock = Pick<
    Term,
    | 'expanded_definition'
    | 'why_it_matters'
    | 'how_it_works'
    | 'risks_and_pitfalls'
    | 'regional_notes'
    | 'seo_title'
    | 'seo_description'
>;

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

const CATEGORY_CONTEXT: Record<Term['category'], LocalizedText> = {
    Finance: {
        en: 'valuation, risk, reporting, and market interpretation',
        ru: 'оценкой стоимости, риском, отчётностью и интерпретацией рынка',
        tr: 'değerleme, risk, raporlama ve piyasa yorumu',
    },
    Fintech: {
        en: 'digital financial products, regulated infrastructure, and user-facing transaction flows',
        ru: 'цифровыми финансовыми продуктами, регулируемой инфраструктурой и пользовательскими транзакционными потоками',
        tr: 'dijital finans ürünleri, düzenlemeye tabi altyapı ve kullanıcıya dönük işlem akışları',
    },
    Technology: {
        en: 'system design, data infrastructure, security, and operational reliability',
        ru: 'архитектурой систем, инфраструктурой данных, безопасностью и операционной надёжностью',
        tr: 'sistem tasarımı, veri altyapısı, güvenlik ve operasyonel güvenilirlik',
    },
};

const TOPIC_SEARCH_INTENT: Record<string, LocalizedText> = {
    'cards-payments': {
        en: 'authorization, capture, settlement, refunds, merchant risk, and checkout conversion',
        ru: 'авторизацию, capture, settlement, возвраты, merchant risk и конверсию checkout',
        tr: 'yetkilendirme, tahsilat, mutabakat, iade, üye işyeri riski ve ödeme dönüşümü',
    },
    'open-banking': {
        en: 'consent, account access, regulated APIs, payment initiation, and bank connectivity',
        ru: 'согласие, доступ к счетам, регулируемые API, инициацию платежей и банковскую связность',
        tr: 'rıza, hesap erişimi, regüle API’ler, ödeme başlatma ve banka bağlantısı',
    },
    'regtech-compliance': {
        en: 'identity checks, compliance controls, reporting duties, and supervisory expectations',
        ru: 'проверки личности, комплаенс-контроли, отчётные обязанности и ожидания надзора',
        tr: 'kimlik kontrolleri, uyum kontrolleri, raporlama yükümlülükleri ve denetleyici beklentiler',
    },
    'crypto-infrastructure': {
        en: 'wallets, protocols, on-chain execution, custody, and blockchain settlement risk',
        ru: 'кошельки, протоколы, on-chain исполнение, custody и settlement-риск блокчейна',
        tr: 'cüzdanlar, protokoller, zincir üstü yürütme, saklama ve blokzincir mutabakat riski',
    },
    'rwa-tokenization': {
        en: 'asset representation, issuance, custody, redemption, and reserve transparency',
        ru: 'представление активов, выпуск, custody, погашение и прозрачность резервов',
        tr: 'varlık temsili, ihraç, saklama, itfa ve rezerv şeffaflığı',
    },
    'market-microstructure': {
        en: 'order flow, liquidity, spreads, execution quality, and market data interpretation',
        ru: 'поток заявок, ликвидность, спреды, качество исполнения и интерпретацию рыночных данных',
        tr: 'emir akışı, likidite, spread, yürütme kalitesi ve piyasa verisi yorumu',
    },
    'fraud-identity-security': {
        en: 'authentication, credential safety, transaction approval, and fraud-loss prevention',
        ru: 'аутентификацию, защиту credential, подтверждение транзакций и предотвращение fraud loss',
        tr: 'kimlik doğrulama, kimlik bilgisi güvenliği, işlem onayı ve dolandırıcılık kaybı önleme',
    },
    'ai-data-finance': {
        en: 'data quality, model behavior, analytics decisions, automation limits, and governance',
        ru: 'качество данных, поведение моделей, аналитические решения, лимиты автоматизации и governance',
        tr: 'veri kalitesi, model davranışı, analitik kararlar, otomasyon sınırları ve yönetişim',
    },
};

const TOPIC_RISK_CONTEXT: Record<string, LocalizedText> = {
    'cards-payments': {
        en: 'Confusing the step in the payment lifecycle can create reconciliation errors, chargeback exposure, or misleading conversion analysis.',
        ru: 'Смешение этапов платёжного жизненного цикла приводит к ошибкам reconciliation, chargeback-риску или неверному анализу конверсии.',
        tr: 'Ödeme yaşam döngüsündeki adımı karıştırmak mutabakat hatası, chargeback riski veya yanıltıcı dönüşüm analizi üretebilir.',
    },
    'open-banking': {
        en: 'The common failure is to ignore consent scope, API role boundaries, or the difference between account data and payment initiation.',
        ru: 'Типичная ошибка — игнорировать scope согласия, границы API-ролей или различие между account data и payment initiation.',
        tr: 'Yaygın hata, rıza kapsamını, API rol sınırlarını veya hesap verisi ile ödeme başlatma farkını göz ardı etmektir.',
    },
    'regtech-compliance': {
        en: 'Weak definitions can blur legal duty, product control, and operational evidence, which matters in regulated workflows.',
        ru: 'Слабые определения размывают юридическую обязанность, продуктовый контроль и операционные доказательства в регулируемых процессах.',
        tr: 'Zayıf tanımlar hukuki yükümlülüğü, ürün kontrolünü ve operasyonel kanıtı regüle süreçlerde bulanıklaştırır.',
    },
    'crypto-infrastructure': {
        en: 'Surface-level usage can hide custody, signing, protocol, liquidity, or settlement assumptions.',
        ru: 'Поверхностное использование скрывает допущения по custody, подписи, протоколу, ликвидности или settlement.',
        tr: 'Yüzeysel kullanım saklama, imzalama, protokol, likidite veya mutabakat varsayımlarını gizleyebilir.',
    },
    'rwa-tokenization': {
        en: 'The main risk is separating the token narrative from enforceable asset rights, reserves, custody, and redemption mechanics.',
        ru: 'Главный риск — отделить token narrative от исполнимых прав на актив, резервов, custody и механики погашения.',
        tr: 'Ana risk, token anlatısını uygulanabilir varlık hakları, rezervler, saklama ve itfa mekaniklerinden koparmaktır.',
    },
    'market-microstructure': {
        en: 'A vague reading can misstate execution cost, liquidity quality, or the reliability of a trading signal.',
        ru: 'Расплывчатое понимание искажает стоимость исполнения, качество ликвидности или надёжность торгового сигнала.',
        tr: 'Belirsiz okuma yürütme maliyetini, likidite kalitesini veya işlem sinyalinin güvenilirliğini yanlış gösterebilir.',
    },
    'fraud-identity-security': {
        en: 'Teams can overtrust a control if they do not separate identity proof, possession, authorization, and transaction intent.',
        ru: 'Команды переоценивают контроль, если не разделяют proof of identity, possession, authorization и transaction intent.',
        tr: 'Kimlik kanıtı, sahiplik, yetkilendirme ve işlem niyeti ayrılmazsa ekipler bir kontrole fazla güvenebilir.',
    },
    'ai-data-finance': {
        en: 'The key pitfall is treating model output as neutral without checking data lineage, explainability, monitoring, and governance limits.',
        ru: 'Ключевая ошибка — считать вывод модели нейтральным без проверки data lineage, explainability, мониторинга и governance-лимитов.',
        tr: 'Temel hata, veri soyu, açıklanabilirlik, izleme ve yönetişim sınırları kontrol edilmeden model çıktısını nötr kabul etmektir.',
    },
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

const buildSeoContentBlock = (
    term: Term,
    topic: Topic,
    regionalMarkets: readonly RegionalMarket[]
): SeoContentBlock => ({
    expanded_definition: {
        en: `${term.definition_en} Within the ${topic.title.en.toLowerCase()} cluster, ${term.term_en} helps explain ${TOPIC_SEARCH_INTENT[topic.id]?.en ?? CATEGORY_CONTEXT[term.category].en}. ${term.example_sentence_en}`.trim(),
        ru: `${term.definition_ru} В кластере «${topic.title.ru.toLowerCase()}» термин «${term.term_ru}» помогает объяснить ${TOPIC_SEARCH_INTENT[topic.id]?.ru ?? CATEGORY_CONTEXT[term.category].ru}. ${term.example_sentence_ru}`.trim(),
        tr: `${term.definition_tr} ${topic.title.tr.toLowerCase()} kümesi içinde ${term.term_tr}, ${TOPIC_SEARCH_INTENT[topic.id]?.tr ?? CATEGORY_CONTEXT[term.category].tr} konusunu açıklamaya yardım eder. ${term.example_sentence_tr}`.trim(),
    },
    why_it_matters: {
        en: `${term.term_en} matters because it connects ${CATEGORY_CONTEXT[term.category].en} with the practical decisions teams make inside ${topic.title.en.toLowerCase()}.`,
        ru: `Термин «${term.term_ru}» важен, потому что связывает ${CATEGORY_CONTEXT[term.category].ru} с практическими решениями внутри темы «${topic.title.ru.toLowerCase()}».`,
        tr: `${term.term_tr}, ${CATEGORY_CONTEXT[term.category].tr} ile ${topic.title.tr.toLowerCase()} içindeki pratik kararları bağladığı için önemlidir.`,
    },
    how_it_works: {
        en: `In practice, ${term.term_en} is read through its definition, the systems or market actors it touches, and the way it changes decisions around ${TOPIC_SEARCH_INTENT[topic.id]?.en ?? CATEGORY_CONTEXT[term.category].en}.`,
        ru: `На практике термин «${term.term_ru}» читается через определение, затрагиваемые системы или участников рынка и влияние на решения про ${TOPIC_SEARCH_INTENT[topic.id]?.ru ?? CATEGORY_CONTEXT[term.category].ru}.`,
        tr: `Pratikte ${term.term_tr}; tanımı, temas ettiği sistemler veya piyasa aktörleri ve ${TOPIC_SEARCH_INTENT[topic.id]?.tr ?? CATEGORY_CONTEXT[term.category].tr} üzerindeki karar etkisiyle okunur.`,
    },
    risks_and_pitfalls: {
        en: TOPIC_RISK_CONTEXT[topic.id]?.en ?? `A common mistake is to use ${term.term_en} without understanding the underlying controls, limits, and cross-border implications.`,
        ru: TOPIC_RISK_CONTEXT[topic.id]?.ru ?? `Распространённая ошибка — использовать термин «${term.term_ru}», не понимая базовых контролей, ограничений и трансграничных последствий.`,
        tr: TOPIC_RISK_CONTEXT[topic.id]?.tr ?? `Yaygın hata, ${term.term_tr} kavramını temel kontrolleri, sınırları ve sınır ötesi etkileri anlamadan kullanmaktır.`,
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
    const editorialOverride = getEditorialAuthorityOverride(term.slug);
    const contentBlock = editorialOverride?.content
        ?? buildSeoContentBlock(term, getPrimaryTopic(topicIds), regionalMarkets);
    const sourceRefs = editorialOverride?.sourceIds
        ?? priorityRecord?.requiredSourceIds
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
        ...contentBlock,
        comparison_term_id: term.comparison_term_id,
        prerequisite_term_id: term.prerequisite_term_id,
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
