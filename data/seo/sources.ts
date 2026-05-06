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
        id: 'stripe-connect-merchant-of-record',
        title: {
            en: 'Stripe Docs: Merchant of record in Connect',
            ru: 'Stripe Docs: Merchant of record in Connect',
            tr: 'Stripe Docs: Connect içinde Merchant of Record',
        },
        publisher: 'Stripe',
        url: 'https://docs.stripe.com/connect/merchant-of-record?locale=en-GB',
        type: 'documentation',
        note: note(
            'Primary implementation source for merchant-of-record responsibility, charge type, statement descriptor, refunds, and disputes.',
            'Первичный implementation source по ответственности merchant of record, charge type, statement descriptor, refunds и disputes.',
            'Merchant of Record sorumluluğu, charge type, statement descriptor, iadeler ve itirazlar için birincil uygulama kaynağı.'
        ),
        last_verified: '2026-04-30',
    },
    {
        id: 'visa-payment-facilitator-model',
        title: {
            en: 'Visa: Payment Facilitator Model',
            ru: 'Visa: Payment Facilitator Model',
            tr: 'Visa: Payment Facilitator Model',
        },
        publisher: 'Visa',
        url: 'https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/visa-payment-facilitator-model.pdf',
        type: 'documentation',
        note: note(
            'Network-level reference for payment facilitator registration, sponsored merchants, acceptance, and model risk.',
            'Network-level source по payment facilitator registration, sponsored merchants, acceptance и model risk.',
            'Payment facilitator kaydı, sponsored merchants, kabul ve model riski için kart ağı seviyesinde referans.'
        ),
        last_verified: '2026-04-30',
    },
    {
        id: 'stripe-authorization-capture',
        title: {
            en: 'Stripe Docs: Separate authorization and capture',
            ru: 'Stripe Docs: Separate authorization and capture',
            tr: 'Stripe Docs: Ayrı authorization ve capture',
        },
        publisher: 'Stripe',
        url: 'https://docs.stripe.com/payments/place-a-hold-on-a-payment-method',
        type: 'documentation',
        note: note(
            'Primary implementation source for authorization holds, capture timing, and manual capture windows.',
            'Первичный implementation source по authorization holds, capture timing и manual capture windows.',
            'Authorization hold, capture zamanlaması ve manual capture pencereleri için birincil uygulama kaynağı.'
        ),
        last_verified: '2026-04-30',
    },
    {
        id: 'adyen-capture-docs',
        title: {
            en: 'Adyen Docs: Capture an authorized payment',
            ru: 'Adyen Docs: Capture an authorized payment',
            tr: 'Adyen Docs: Yetkilendirilmiş ödemeyi capture etme',
        },
        publisher: 'Adyen',
        url: 'https://docs.adyen.com/online-payments/capture?tab=delayed-individual_2',
        type: 'documentation',
        note: note(
            'Primary implementation source for payment capture after authorization, manual capture, and capture request behavior.',
            'Первичный implementation source по capture after authorization, manual capture и capture request behavior.',
            'Authorization sonrası capture, manual capture ve capture isteği davranışı için birincil uygulama kaynağı.'
        ),
        last_verified: '2026-04-30',
    },
    {
        id: 'visa-developer-glossary',
        title: {
            en: 'Visa Developer: Glossary',
            ru: 'Visa Developer: Glossary',
            tr: 'Visa Developer: Glossary',
        },
        publisher: 'Visa Developer',
        url: 'https://developer.visa.com/pages/glossary',
        type: 'documentation',
        note: note(
            'Primary network terminology source for acquirer, issuer, API, and authorization definitions.',
            'Первичный network terminology source для определений acquirer, issuer, API и authorization.',
            'Acquirer, issuer, API ve authorization tanımları için kart ağı terminoloji kaynağı.'
        ),
        last_verified: '2026-04-30',
    },
    {
        id: 'visa-visanet-acceptance',
        title: {
            en: 'Visa Developer: VisaNet Connect Acceptance',
            ru: 'Visa Developer: VisaNet Connect Acceptance',
            tr: 'Visa Developer: VisaNet Connect Acceptance',
        },
        publisher: 'Visa Developer',
        url: 'https://developer.visa.com/capabilities/visanet-connect-acceptance',
        type: 'documentation',
        note: note(
            'Primary network source for acquirer-facing authorization, capture, clearing, settlement, and issuer decision routing.',
            'Первичный network source по acquirer-facing authorization, capture, clearing, settlement и issuer decision routing.',
            'Acquirer taraflı authorization, capture, clearing, settlement ve issuer karar yönlendirmesi için kart ağı kaynağı.'
        ),
        last_verified: '2026-04-30',
    },
    {
        id: 'visa-cybersource-payments',
        title: {
            en: 'Visa Developer: CyberSource Payments',
            ru: 'Visa Developer: CyberSource Payments',
            tr: 'Visa Developer: CyberSource Payments',
        },
        publisher: 'Visa Developer',
        url: 'https://developer.visa.com/products/cybersource',
        type: 'documentation',
        note: note(
            'Gateway and processing source for authorization request routing, issuer decisioning, capture, and settlement context.',
            'Источник по gateway and processing для authorization request routing, issuer decisioning, capture и settlement context.',
            'Authorization request routing, issuer decisioning, capture ve settlement bağlamı için gateway/processing kaynağı.'
        ),
        last_verified: '2026-04-30',
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
    {
        id: 'fatf-recommendations',
        title: {
            en: 'FATF: The FATF Recommendations',
            ru: 'FATF: Рекомендации FATF',
            tr: 'FATF: FATF Tavsiyeleri',
        },
        publisher: 'Financial Action Task Force',
        url: 'https://www.fatf-gafi.org/en/publications/Fatfrecommendations/Fatf-recommendations.html',
        type: 'regulation',
        note: note(
            'Primary international AML/CFT framework for customer due diligence, sanctions screening, and financial crime controls.',
            'Первичная международная AML/CFT-рамка для customer due diligence, санкционного скрининга и контроля financial crime.',
            'Müşteri tanıma, yaptırım taraması ve finansal suç kontrolleri için birincil uluslararası AML/CFT çerçevesi.'
        ),
        last_verified: '2026-05-04',
    },
    {
        id: 'bis-pfmi',
        title: {
            en: 'BIS CPMI-IOSCO: Principles for financial market infrastructures',
            ru: 'BIS CPMI-IOSCO: Принципы для инфраструктур финансового рынка',
            tr: 'BIS CPMI-IOSCO: Finansal piyasa altyapıları ilkeleri',
        },
        publisher: 'Bank for International Settlements',
        url: 'https://www.bis.org/cpmi/info_pfmi.htm',
        type: 'documentation',
        note: note(
            'International standards for payment systems, settlement systems, central counterparties, and trade repositories.',
            'Международные стандарты для payment systems, settlement systems, central counterparties и trade repositories.',
            'Ödeme sistemleri, mutabakat sistemleri, merkezi karşı taraflar ve işlem kayıt merkezleri için uluslararası standart.'
        ),
        last_verified: '2026-05-04',
    },
    {
        id: 'sec-market-structure-algorithmic-trading',
        title: {
            en: 'SEC: Market Structure and Algorithmic Trading',
            ru: 'SEC: Market Structure and Algorithmic Trading',
            tr: 'SEC: Market Structure and Algorithmic Trading',
        },
        publisher: 'U.S. Securities and Exchange Commission',
        url: 'https://www.sec.gov/file/market-structure-and-algorithmic-trading',
        type: 'documentation',
        note: note(
            'Primary regulator source for market structure, algorithmic trading, execution quality, and trading-system risk context.',
            'Первичный источник регулятора по market structure, algorithmic trading, execution quality и рискам торговых систем.',
            'Piyasa yapısı, algoritmik işlem, emir icra kalitesi ve işlem sistemi riskleri için birincil düzenleyici kaynak.'
        ),
        last_verified: '2026-05-04',
    },
    {
        id: 'nist-ai-rmf',
        title: {
            en: 'NIST: AI Risk Management Framework',
            ru: 'NIST: AI Risk Management Framework',
            tr: 'NIST: AI Risk Management Framework',
        },
        publisher: 'National Institute of Standards and Technology',
        url: 'https://www.nist.gov/itl/ai-risk-management-framework',
        type: 'documentation',
        note: note(
            'Primary AI risk-management framework for trustworthy AI, model governance, measurement, and operational controls.',
            'Первичная рамка AI risk management для trustworthy AI, model governance, измерения и операционных контролей.',
            'Güvenilir AI, model yönetişimi, ölçümleme ve operasyonel kontroller için birincil AI risk yönetimi çerçevesi.'
        ),
        last_verified: '2026-05-04',
    },
    {
        id: 'oecd-ai-principles',
        title: {
            en: 'OECD: AI Principles',
            ru: 'OECD: Принципы ИИ',
            tr: 'OECD: AI İlkeleri',
        },
        publisher: 'OECD',
        url: 'https://www.oecd.org/en/topics/ai-principles.html',
        type: 'documentation',
        note: note(
            'Intergovernmental standard for trustworthy AI principles, policy alignment, accountability, and human-centered deployment.',
            'Межправительственный стандарт по trustworthy AI principles, policy alignment, accountability и human-centered deployment.',
            'Güvenilir AI ilkeleri, politika uyumu, hesap verebilirlik ve insan odaklı dağıtım için hükümetler arası standart.'
        ),
        last_verified: '2026-05-04',
    },
    {
        id: 'bitcoin-whitepaper',
        title: {
            en: 'Bitcoin: A Peer-to-Peer Electronic Cash System',
            ru: 'Bitcoin: A Peer-to-Peer Electronic Cash System',
            tr: 'Bitcoin: A Peer-to-Peer Electronic Cash System',
        },
        publisher: 'Bitcoin.org',
        url: 'https://bitcoin.org/en/bitcoin-paper.pdf',
        type: 'research',
        note: note(
            'Original Bitcoin whitepaper for peer-to-peer cash, proof of work, transaction ordering, and settlement assumptions.',
            'Оригинальный whitepaper Bitcoin про peer-to-peer cash, proof of work, порядок транзакций и assumptions settlement.',
            'Peer-to-peer nakit, proof of work, işlem sıralaması ve mutabakat varsayımları için özgün Bitcoin whitepaper kaynağı.'
        ),
        last_verified: '2026-05-04',
    },
    {
        id: 'ethereum-whitepaper',
        title: {
            en: 'Ethereum Whitepaper',
            ru: 'Ethereum Whitepaper',
            tr: 'Ethereum Whitepaper',
        },
        publisher: 'Ethereum.org',
        url: 'https://ethereum.org/whitepaper/',
        type: 'documentation',
        note: note(
            'Ethereum source for smart contracts, programmable settlement, accounts, decentralized applications, and protocol design assumptions.',
            'Источник Ethereum по smart contracts, programmable settlement, accounts, decentralized applications и protocol design assumptions.',
            'Akıllı sözleşmeler, programlanabilir mutabakat, hesaplar, merkeziyetsiz uygulamalar ve protokol tasarım varsayımları için Ethereum kaynağı.'
        ),
        last_verified: '2026-05-04',
    },
    {
        id: 'sec-private-funds',
        title: {
            en: 'SEC: Private Funds',
            ru: 'SEC: Private Funds',
            tr: 'SEC: Private Funds',
        },
        publisher: 'U.S. Securities and Exchange Commission',
        url: 'https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/private-funds',
        type: 'documentation',
        note: note(
            'Regulator source for private funds, venture capital fund context, exempt advisers, fundraising, and investor-risk framing.',
            'Источник регулятора по private funds, venture capital fund context, exempt advisers, fundraising и investor-risk framing.',
            'Özel fonlar, venture capital fund bağlamı, muaf danışmanlar, fon toplama ve yatırımcı riski çerçevesi için düzenleyici kaynak.'
        ),
        last_verified: '2026-05-04',
    },
];
