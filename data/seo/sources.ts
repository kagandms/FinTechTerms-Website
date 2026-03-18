import type { SourceRef } from '@/types';

const note = (en: string, ru: string, tr: string) => ({ en, ru, tr });

export const seoSources: readonly SourceRef[] = [
    {
        id: 'google-links-crawlable',
        title: {
            en: 'Google Search Central: Make links crawlable',
            ru: 'Google Search Central: Делайте ссылки сканируемыми',
            tr: 'Google Search Central: Bağlantıları taranabilir yapın',
        },
        publisher: 'Google Search Central',
        url: 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable',
        type: 'documentation',
        note: note(
            'Primary source for crawlable internal links and anchor discoverability.',
            'Первичный источник по сканируемым внутренним ссылкам и обнаружению анкорного текста.',
            'Taranabilir iç bağlantılar ve anchor keşfedilebilirliği için birincil kaynak.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'google-noindex',
        title: {
            en: 'Google Search Central: Block indexing with noindex',
            ru: 'Google Search Central: Блокируйте индексацию через noindex',
            tr: 'Google Search Central: noindex ile indekslemeyi engelleyin',
        },
        publisher: 'Google Search Central',
        url: 'https://developers.google.com/search/docs/crawling-indexing/block-indexing',
        type: 'documentation',
        note: note(
            'Used for utility page indexation policy.',
            'Используется для политики индексации сервисных страниц.',
            'Yardımcı sayfaların indeks politikası için kullanılır.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'google-helpful-content',
        title: {
            en: 'Google Search Central: Helpful, reliable, people-first content',
            ru: 'Google Search Central: Полезный, надёжный, ориентированный на людей контент',
            tr: 'Google Search Central: Yararlı, güvenilir, insan odaklı içerik',
        },
        publisher: 'Google Search Central',
        url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
        type: 'documentation',
        note: note(
            'Defines trust, helpfulness, and people-first expectations for YMYL-adjacent content.',
            'Определяет ожидания по доверию, полезности и ориентации на пользователя для YMYL-контента.',
            'YMYL’e yakın içerikler için güven, fayda ve insan odaklı beklentileri tanımlar.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'google-title-links',
        title: {
            en: 'Google Search Central: Title links best practices',
            ru: 'Google Search Central: Лучшие практики title links',
            tr: 'Google Search Central: Başlık bağlantıları için en iyi uygulamalar',
        },
        publisher: 'Google Search Central',
        url: 'https://developers.google.com/search/docs/appearance/title-link',
        type: 'documentation',
        note: note(
            'Supports title hygiene and metadata governance.',
            'Поддерживает гигиену title и управление metadata.',
            'Title hijyeni ve metadata yönetimini destekler.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'stripe-tokenization-101',
        title: {
            en: 'Stripe: Payment tokenization 101',
            ru: 'Stripe: Payment tokenization 101',
            tr: 'Stripe: Payment tokenization 101',
        },
        publisher: 'Stripe',
        url: 'https://stripe.com/resources/more/payment-tokenization-101',
        type: 'glossary',
        note: note(
            'Used for payment tokenization, network token, and account updater context.',
            'Используется для контекста payment tokenization, network token и account updater.',
            'Payment tokenization, network token ve account updater bağlamı için kullanılır.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'stripe-merchant-of-record',
        title: {
            en: 'Stripe: Merchant of record',
            ru: 'Stripe: Merchant of record',
            tr: 'Stripe: Merchant of record',
        },
        publisher: 'Stripe',
        url: 'https://stripe.com/resources/more/merchant-of-record',
        type: 'glossary',
        note: note(
            'Primary source for merchant-of-record terminology.',
            'Первичный источник по терминологии merchant of record.',
            'Merchant of record terminolojisi için birincil kaynak.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'stripe-payment-facilitator',
        title: {
            en: 'Stripe: What is a payment facilitator?',
            ru: 'Stripe: What is a payment facilitator?',
            tr: 'Stripe: What is a payment facilitator?',
        },
        publisher: 'Stripe',
        url: 'https://stripe.com/resources/more/what-is-a-payment-facilitator',
        type: 'glossary',
        note: note(
            'Primary source for payfac models and platform payments.',
            'Первичный источник по payfac-моделям и платформенным платежам.',
            'Payfac modelleri ve platform ödemeleri için birincil kaynak.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'adyen-payment-glossary',
        title: {
            en: 'Adyen: Payment methods glossary',
            ru: 'Adyen: Payment methods glossary',
            tr: 'Adyen: Payment methods glossary',
        },
        publisher: 'Adyen',
        url: 'https://www.adyen.com/knowledge-hub/payment-methods-glossary',
        type: 'glossary',
        note: note(
            'Reference source for payments terminology clusters.',
            'Справочный источник для кластеров платёжной терминологии.',
            'Ödeme terminolojisi kümeleri için referans kaynak.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'open-banking-uk-standard',
        title: {
            en: 'Open Banking UK: API standards',
            ru: 'Open Banking UK: API standards',
            tr: 'Open Banking UK: API standards',
        },
        publisher: 'Open Banking UK',
        url: 'https://www.openbanking.org.uk/',
        type: 'documentation',
        note: note(
            'Primary source for open banking permissions and recurring payment rails.',
            'Первичный источник по разрешениям open banking и рекуррентным платёжным рельсам.',
            'Açık bankacılık izinleri ve yinelenen ödeme altyapıları için birincil kaynak.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'eba-sca',
        title: {
            en: 'European Banking Authority: Strong Customer Authentication',
            ru: 'European Banking Authority: Strong Customer Authentication',
            tr: 'European Banking Authority: Strong Customer Authentication',
        },
        publisher: 'European Banking Authority',
        url: 'https://www.eba.europa.eu/regulation-and-policy/payment-services-and-electronic-money/strong-customer-authentication-under-psd2',
        type: 'regulation',
        note: note(
            'Primary source for SCA and PSD2 compliance context.',
            'Первичный источник по контексту SCA и комплаенсу PSD2.',
            'SCA ve PSD2 uyum bağlamı için birincil kaynak.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'swift-iso-20022',
        title: {
            en: 'SWIFT: ISO 20022 migration',
            ru: 'SWIFT: ISO 20022 migration',
            tr: 'SWIFT: ISO 20022 migration',
        },
        publisher: 'SWIFT',
        url: 'https://www.swift.com/standards/iso-20022',
        type: 'documentation',
        note: note(
            'Primary source for ISO 20022 and messaging standards.',
            'Первичный источник по ISO 20022 и стандартам сообщений.',
            'ISO 20022 ve mesajlaşma standartları için birincil kaynak.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'european-commission-mica',
        title: {
            en: 'European Commission: Markets in Crypto-Assets (MiCA)',
            ru: 'European Commission: Markets in Crypto-Assets (MiCA)',
            tr: 'European Commission: Markets in Crypto-Assets (MiCA)',
        },
        publisher: 'European Commission',
        url: 'https://finance.ec.europa.eu/digital-finance/eu-rules-markets-crypto-assets_en',
        type: 'regulation',
        note: note(
            'Primary source for MiCA regulatory framing.',
            'Первичный источник по регуляторной рамке MiCA.',
            'MiCA düzenleyici çerçevesi için birincil kaynak.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'coinbase-crypto-glossary',
        title: {
            en: 'Coinbase Learn: Crypto glossary',
            ru: 'Coinbase Learn: Crypto glossary',
            tr: 'Coinbase Learn: Crypto glossary',
        },
        publisher: 'Coinbase',
        url: 'https://www.coinbase.com/learn/crypto-glossary',
        type: 'glossary',
        note: note(
            'Reference source for crypto infrastructure terminology.',
            'Справочный источник по терминологии криптоинфраструктуры.',
            'Kripto altyapı terminolojisi için referans kaynak.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'bis-proof-of-reserves',
        title: {
            en: 'Bank for International Settlements: Crypto reserves and transparency',
            ru: 'Bank for International Settlements: Crypto reserves and transparency',
            tr: 'Bank for International Settlements: Crypto reserves and transparency',
        },
        publisher: 'Bank for International Settlements',
        url: 'https://www.bis.org/',
        type: 'research',
        note: note(
            'Used as an institutional reference for reserve transparency context.',
            'Используется как институциональная ссылка для контекста прозрачности резервов.',
            'Rezerv şeffaflığı bağlamı için kurumsal referans olarak kullanılır.'
        ),
        last_verified: '2026-03-15',
    },
    {
        id: 'emv-3ds',
        title: {
            en: 'EMVCo: EMV 3-D Secure',
            ru: 'EMVCo: EMV 3-D Secure',
            tr: 'EMVCo: EMV 3-D Secure',
        },
        publisher: 'EMVCo',
        url: 'https://www.emvco.com/emv-technologies/3-d-secure/',
        type: 'documentation',
        note: note(
            'Primary source for 3DS protocol terminology.',
            'Первичный источник по терминологии протокола 3DS.',
            '3DS protokol terminolojisi için birincil kaynak.'
        ),
        last_verified: '2026-03-15',
    },
];
