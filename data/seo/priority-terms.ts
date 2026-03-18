import type { EditorialStatus, Language, PriorityTermRecord, RegionalMarket, TopicId } from '@/types';

type ClusterConfig = {
    readonly anchorCount: number;
    readonly sourceIds: readonly string[];
    readonly regionalMarkets: readonly RegionalMarket[];
    readonly slugs: readonly string[];
};

type PriorityOverride = Partial<Pick<
    PriorityTermRecord,
    'comparisonSlug' | 'prerequisiteSlug' | 'relatedSlugs' | 'requiredSourceIds' | 'regionalMarkets'
>>;

const buildLocaleStatus = (status: EditorialStatus): Record<Language, EditorialStatus> => ({
    en: status,
    ru: status,
    tr: status,
});

export const priorityClusters: Record<TopicId, ClusterConfig> = {
    'cards-payments': {
        anchorCount: 6,
        sourceIds: ['stripe-tokenization-101', 'stripe-merchant-of-record', 'adyen-payment-glossary'],
        regionalMarkets: ['BIST', 'MOEX', 'GLOBAL'],
        slugs: [
            '3d-secure',
            'payment-gateway',
            'chargeback',
            'acquirer',
            'issuer',
            'merchant-of-record',
            'payment-facilitator',
            'network-token',
            'account-updater',
            'payment-orchestration',
            'contactless-payment',
            'qr-code-payment',
            'buy-now-pay-later',
            'wallet-digital',
            'embedded-finance',
            'digital-banking',
            'peer-to-peer-lending',
            'robo-advisor',
            'insurtech',
            'interchange-fee',
        ],
    },
    'open-banking': {
        anchorCount: 5,
        sourceIds: ['open-banking-uk-standard', 'eba-sca', 'swift-iso-20022'],
        regionalMarkets: ['BIST', 'MOEX', 'GLOBAL'],
        slugs: [
            'open-banking',
            'psd2',
            'sca',
            'iso-20022',
            'api-banking',
            'api',
            'sepa',
            'sepa-instant',
            'swift',
            'iban',
            'bacs',
            'neobank',
            'variable-recurring-payments',
            'fedwire',
            'faster-payments',
        ],
    },
    'regtech-compliance': {
        anchorCount: 5,
        sourceIds: ['eba-sca', 'european-commission-mica', 'google-helpful-content'],
        regionalMarkets: ['BIST', 'MOEX', 'GLOBAL'],
        slugs: [
            'regtech',
            'mica',
            'know-your-customer',
            'anti-money-laundering',
            'regulatory-sandbox',
            'kyc',
            'aml',
            'two-factor-authentication',
            'biometric-authentication',
            'embedded-insurance',
            'parametric-insurance',
            'usage-based-insurance',
            'peer-to-peer-insurance',
            'challenger-bank',
            'banking-as-a-service',
        ],
    },
    'crypto-infrastructure': {
        anchorCount: 5,
        sourceIds: ['coinbase-crypto-glossary', 'european-commission-mica', 'google-helpful-content'],
        regionalMarkets: ['GLOBAL'],
        slugs: [
            'blockchain',
            'bitcoin',
            'ethereum',
            'smart-contract',
            'bitcoin-layer-2',
            'cryptocurrency',
            'validator',
            'layer-2',
            'zk-snark',
            'oracle',
            'mev',
            'account-abstraction',
            'blind-signing',
            'appchain',
            'bitvm',
        ],
    },
    'rwa-tokenization': {
        anchorCount: 3,
        sourceIds: ['stripe-tokenization-101', 'bis-proof-of-reserves', 'coinbase-crypto-glossary'],
        regionalMarkets: ['GLOBAL'],
        slugs: [
            'tokenization',
            'stablecoin',
            'rwa',
            'nft',
            'wrapped-token',
            'wrapped-bitcoin',
            'security-token',
            'utility-token',
            'equity-token',
            'asset-backed-token',
        ],
    },
    'market-microstructure': {
        anchorCount: 2,
        sourceIds: ['google-helpful-content', 'adyen-payment-glossary', 'google-title-links'],
        regionalMarkets: ['BIST', 'MOEX', 'GLOBAL'],
        slugs: [
            'algorithmic-trading',
            'high-frequency-trading-hft',
            'market-maker',
            'liquidity-pool',
            'arbitrage',
            'slippage',
            'volatility',
            'order-book',
            'spread',
            'latency',
        ],
    },
    'fraud-identity-security': {
        anchorCount: 2,
        sourceIds: ['emv-3ds', 'eba-sca', 'coinbase-crypto-glossary'],
        regionalMarkets: ['BIST', 'MOEX', 'GLOBAL'],
        slugs: [
            'private-key',
            'wallet',
            'cold-wallet',
            'hot-wallet',
            'hardware-wallet',
            'paper-wallet',
            'multisig-wallet',
            'cryptojacking',
            'consensus-mechanism',
            'consensus-algorithm',
        ],
    },
    'ai-data-finance': {
        anchorCount: 2,
        sourceIds: ['google-helpful-content', 'google-title-links', 'coinbase-crypto-glossary'],
        regionalMarkets: ['BIST', 'MOEX', 'GLOBAL'],
        slugs: [
            'ai',
            'machine-learning',
            'natural-language-processing',
            'big-data',
            'predictive-analytics',
        ],
    },
};

const anchorOverrides: Record<string, PriorityOverride> = {
    'tokenization': {
        relatedSlugs: ['network-token', 'stablecoin', 'rwa', 'blockchain'],
        comparisonSlug: 'network-token',
        prerequisiteSlug: 'payment-gateway',
    },
    'open-banking': {
        relatedSlugs: ['psd2', 'sca', 'api-banking', 'variable-recurring-payments'],
        comparisonSlug: 'banking-as-a-service',
        prerequisiteSlug: 'api',
    },
    'regtech': {
        relatedSlugs: ['kyc', 'aml', 'mica', 'regulatory-sandbox'],
        comparisonSlug: 'open-banking',
        prerequisiteSlug: 'know-your-customer',
    },
    'mica': {
        relatedSlugs: ['regtech', 'proof-of-reserves', 'stablecoin', 'cryptocurrency'],
        comparisonSlug: 'psd2',
        prerequisiteSlug: 'regtech',
    },
    '3d-secure': {
        relatedSlugs: ['sca', 'chargeback', 'payment-gateway', 'network-token'],
        comparisonSlug: 'two-factor-authentication',
        prerequisiteSlug: 'payment-gateway',
        requiredSourceIds: ['emv-3ds', 'eba-sca', 'adyen-payment-glossary'],
    },
    'network-token': {
        relatedSlugs: ['tokenization', 'payment-orchestration', 'account-updater', '3d-secure'],
        comparisonSlug: 'tokenization',
        prerequisiteSlug: 'payment-gateway',
    },
    'merchant-of-record': {
        relatedSlugs: ['payment-facilitator', 'chargeback', 'acquirer', 'issuer'],
        comparisonSlug: 'payment-facilitator',
        prerequisiteSlug: 'acquirer',
    },
    'payment-facilitator': {
        relatedSlugs: ['merchant-of-record', 'payment-gateway', 'acquirer', 'issuer'],
        comparisonSlug: 'merchant-of-record',
        prerequisiteSlug: 'payment-gateway',
    },
    'proof-of-reserves': {
        relatedSlugs: ['mica', 'stablecoin', 'cryptocurrency', 'rwa'],
        comparisonSlug: 'stablecoin',
        prerequisiteSlug: 'blockchain',
        requiredSourceIds: ['bis-proof-of-reserves', 'coinbase-crypto-glossary', 'european-commission-mica'],
    },
    'bitcoin-layer-2': {
        relatedSlugs: ['bitvm', 'layer-2', 'bitcoin', 'wrapped-bitcoin'],
        comparisonSlug: 'layer-2',
        prerequisiteSlug: 'blockchain',
    },
};

const getNeighborSlugs = (slugs: readonly string[], index: number): readonly string[] => {
    const neighbors: string[] = [];

    for (let distance = 1; neighbors.length < 4 && distance < slugs.length; distance += 1) {
        const left = slugs[index - distance];
        const right = slugs[index + distance];

        if (left && !neighbors.includes(left)) {
            neighbors.push(left);
        }

        if (right && !neighbors.includes(right)) {
            neighbors.push(right);
        }
    }

    return neighbors.slice(0, 4);
};

const buildClusterRecords = (
    topicId: TopicId,
    config: ClusterConfig
): PriorityTermRecord[] => (
    config.slugs.map((slug, index) => {
        const override = anchorOverrides[slug];
        const tier = index < config.anchorCount ? 'anchor' : 'supporting';
        const comparisonFallback = config.slugs[index + 1]
            ?? config.slugs[index + 2]
            ?? config.slugs[index - 1]
            ?? null;
        const prerequisiteFallback = config.slugs[index - 1]
            ?? config.slugs[index - 2]
            ?? config.slugs[index + 1]
            ?? null;

        return {
            slug,
            topicId,
            tier,
            locales: buildLocaleStatus('published'),
            requiredSourceIds: override?.requiredSourceIds ?? config.sourceIds,
            relatedSlugs: override?.relatedSlugs ?? getNeighborSlugs(config.slugs, index),
            comparisonSlug: override?.comparisonSlug ?? comparisonFallback,
            prerequisiteSlug: override?.prerequisiteSlug ?? prerequisiteFallback,
            regionalMarkets: override?.regionalMarkets ?? config.regionalMarkets,
        };
    })
);

export const priorityTermRecords: readonly PriorityTermRecord[] = Object.entries(priorityClusters).flatMap(
    ([topicId, config]) => buildClusterRecords(topicId as TopicId, config)
);

export const priorityTermRecordBySlug = new Map(
    priorityTermRecords.map((record) => [record.slug, record] as const)
);

export const PRIORITY_TERM_COUNT = priorityTermRecords.length;
export const PRIORITY_ANCHOR_COUNT = priorityTermRecords.filter((record) => record.tier === 'anchor').length;
