import type { LocalizedText } from '@/types';

interface SearchIntentMetadataOverride {
    readonly seo_title: LocalizedText;
    readonly seo_description: LocalizedText;
}

const text = (en: string, ru: string, tr: string): LocalizedText => ({
    en,
    ru,
    tr,
});

export const searchIntentMetadataOverrides: Readonly<Record<string, SearchIntentMetadataOverride>> = {
    'know-your-customer': {
        seo_title: text(
            'Know Your Customer process and identity checks',
            'Know Your Customer: проверка клиента и личности',
            'Know Your Customer nedir: müşteri tanıma süreci'
        ),
        seo_description: text(
            'Learn Know Your Customer as the full compliance process for identity verification, customer onboarding, risk screening, and regulated financial access.',
            'Разберите Know Your Customer как полный compliance-процесс проверки личности, onboarding, risk screening и доступа к финансовым услугам.',
            'Know Your Customer kavramını kimlik doğrulama, müşteri kabulü, risk taraması ve regüle finans erişimi süreci olarak öğrenin.'
        ),
    },
    kyc: {
        seo_title: text(
            'KYC abbreviation in compliance workflows',
            'KYC: сокращение в compliance-процессах',
            'KYC kısaltması: uyum süreçlerindeki anlamı'
        ),
        seo_description: text(
            'Understand KYC as the abbreviation used in compliance workflows, onboarding checklists, identity checks, monitoring, and customer risk controls.',
            'Поймите KYC как сокращение в compliance workflows, onboarding checklist, identity checks, monitoring и customer risk controls.',
            'KYC kısaltmasını uyum akışları, onboarding listeleri, kimlik kontrolleri, izleme ve müşteri risk kontrolleri içinde öğrenin.'
        ),
    },
    'anti-money-laundering': {
        seo_title: text(
            'Anti Money Laundering controls and obligations',
            'Anti Money Laundering: контроль и обязанности',
            'Anti Money Laundering nedir: kontroller ve yükümlülükler'
        ),
        seo_description: text(
            'Learn Anti Money Laundering as the full control framework for detecting suspicious activity, reporting risk, and preventing illicit fund flows.',
            'Разберите Anti Money Laundering как систему контроля suspicious activity, risk reporting и предотвращения незаконных денежных потоков.',
            'Anti Money Laundering kavramını şüpheli işlem tespiti, risk bildirimi ve yasa dışı fon akışlarını önleme çerçevesiyle öğrenin.'
        ),
    },
    aml: {
        seo_title: text(
            'AML abbreviation in financial crime controls',
            'AML: сокращение в контроле financial crime',
            'AML kısaltması: finansal suç kontrollerindeki anlamı'
        ),
        seo_description: text(
            'Understand AML as the abbreviation used in financial crime controls, monitoring queues, sanctions checks, suspicious activity reports, and compliance tooling.',
            'Поймите AML как сокращение для financial crime controls, monitoring queues, sanctions checks, suspicious activity reports и compliance tooling.',
            'AML kısaltmasını finansal suç kontrolleri, izleme kuyrukları, yaptırım taramaları, şüpheli işlem bildirimleri ve uyum araçları içinde öğrenin.'
        ),
    },
    'high-frequency-trading-hft': {
        seo_title: text(
            'High-Frequency Trading HFT strategy and market impact',
            'High-Frequency Trading HFT: стратегия и влияние',
            'High-Frequency Trading HFT nedir: strateji ve piyasa etkisi'
        ),
        seo_description: text(
            'Learn High-Frequency Trading HFT as a low-latency market strategy involving automated execution, liquidity, spreads, and exchange infrastructure.',
            'Разберите High-Frequency Trading HFT как стратегию market microstructure с low latency, automated execution, liquidity, spreads и биржевой инфраструктурой.',
            'High-Frequency Trading HFT kavramını düşük gecikme, otomatik emir iletimi, likidite, spread ve borsa altyapısı bağlamında öğrenin.'
        ),
    },
    'high-frequency-trading': {
        seo_title: text(
            'High Frequency Trading overview without acronym focus',
            'High Frequency Trading: обзор без акцента на аббревиатуру',
            'High Frequency Trading nedir: kısaltmadan bağımsız özet'
        ),
        seo_description: text(
            'Understand High Frequency Trading as fast algorithmic execution, order-book reaction speed, and automated participation in electronic markets.',
            'Поймите High Frequency Trading как plain-language concept быстрого algorithmic execution, реакции order book и автоматического участия на рынке.',
            'High Frequency Trading kavramını hızlı algoritmik emir iletimi, emir defteri tepkisi ve otomatik piyasa katılımı üzerinden öğrenin.'
        ),
    },
    hft: {
        seo_title: text(
            'HFT abbreviation in trading systems',
            'HFT: сокращение в торговых системах',
            'HFT kısaltması: işlem sistemlerindeki anlamı'
        ),
        seo_description: text(
            'Understand HFT as the abbreviation used for low-latency trading systems, automated execution stacks, exchange connectivity, and market-making workflows.',
            'Поймите HFT как сокращение для low-latency trading systems, automated execution stacks, exchange connectivity и market-making workflows.',
            'HFT kısaltmasını düşük gecikmeli işlem sistemleri, otomatik emir altyapısı, borsa bağlantısı ve piyasa yapıcılık akışları içinde öğrenin.'
        ),
    },
    'venture-capital': {
        seo_title: text(
            'Venture Capital financing model and startup risk',
            'Venture Capital: финансирование и startup risk',
            'Venture Capital nedir: finansman modeli ve girişim riski'
        ),
        seo_description: text(
            'Learn Venture Capital as a financing model for high-growth startups, fund economics, ownership dilution, staged capital, and portfolio risk.',
            'Разберите Venture Capital как модель финансирования high-growth startups, fund economics, ownership dilution, staged capital и portfolio risk.',
            'Venture Capital kavramını yüksek büyüme girişimleri, fon ekonomisi, pay seyrelmesi, aşamalı sermaye ve portföy riskiyle öğrenin.'
        ),
    },
    'venture-capital-vc': {
        seo_title: text(
            'Venture Capital VC abbreviation and investor shorthand',
            'Venture Capital VC: сокращение и investor shorthand',
            'Venture Capital VC kısaltması ve yatırımcı dili'
        ),
        seo_description: text(
            'Understand Venture Capital VC as the investor shorthand used in startup financing discussions, cap tables, funding rounds, and portfolio construction.',
            'Поймите Venture Capital VC как investor shorthand в startup financing, cap tables, funding rounds и portfolio construction.',
            'Venture Capital VC kısaltmasını girişim finansmanı, cap table, yatırım turu ve portföy inşası dili içinde öğrenin.'
        ),
    },
    roa: {
        seo_title: text(
            'ROA abbreviation in profitability analysis',
            'ROA: сокращение в анализе прибыльности',
            'ROA kısaltması: karlılık analizindeki anlamı'
        ),
        seo_description: text(
            'Understand ROA as the return on assets abbreviation used in profitability analysis, asset efficiency checks, and bank or company performance reviews.',
            'Поймите ROA как сокращение return on assets для profitability analysis, asset efficiency comparisons и оценки банков или компаний.',
            'ROA kısaltmasını return on assets, varlık verimliliği karşılaştırması ve banka ya da şirket performans analizi içinde öğrenin.'
        ),
    },
    'return-on-assets': {
        seo_title: text(
            'Return on Assets ratio and asset efficiency',
            'Return on Assets: коэффициент и эффективность активов',
            'Return on Assets nedir: oran ve varlık verimliliği'
        ),
        seo_description: text(
            'Learn Return on Assets as a profitability ratio connecting net income, asset base, operating efficiency, balance-sheet scale, and peer comparison.',
            'Разберите Return on Assets как profitability ratio, связывающий net income, asset base, operating efficiency, balance-sheet scale и peer comparison.',
            'Return on Assets kavramını net kar, varlık tabanı, operasyonel verimlilik, bilanço ölçeği ve emsal karşılaştırmasıyla öğrenin.'
        ),
    },
    'white-paper': {
        seo_title: text(
            'White Paper document in finance and projects',
            'White Paper: документ в финансах и проектах',
            'White Paper nedir: finans ve proje belgesi'
        ),
        seo_description: text(
            'Learn White Paper as a formal explanatory document for financial products, project rationale, risk disclosure, methodology, and investor communication.',
            'Разберите White Paper как формальный explanatory document для financial products, project rationale, risk disclosure, methodology и investor communication.',
            'White Paper kavramını finansal ürünler, proje gerekçesi, risk açıklaması, metodoloji ve yatırımcı iletişimi belgesi olarak öğrenin.'
        ),
    },
    whitepaper: {
        seo_title: text(
            'Whitepaper in crypto and token projects',
            'Whitepaper: документ в crypto и token projects',
            'Whitepaper nedir: kripto ve token projelerindeki belge'
        ),
        seo_description: text(
            'Understand Whitepaper as the crypto and token-project document covering protocol design, token model, roadmap, risks, governance, and technical assumptions.',
            'Поймите Whitepaper как документ crypto и token projects про protocol design, token model, roadmap, risks, governance и technical assumptions.',
            'Whitepaper kavramını kripto ve token projelerinde protokol tasarımı, token modeli, yol haritası, riskler ve yönetişim belgesi olarak öğrenin.'
        ),
    },
    '2fa': {
        seo_title: text(
            '2FA abbreviation for second-factor login',
            '2FA: сокращение для второго фактора',
            '2FA kısaltması ve ikinci doğrulama'
        ),
        seo_description: text(
            'Understand 2FA as shorthand for a second login or approval factor in fintech access, checkout, and account security.',
            'Поймите 2FA как сокращение для второго фактора входа или подтверждения в доступе, оплате и защите аккаунта.',
            '2FA kısaltmasını fintek erişimi, ödeme onayı ve hesap güvenliğinde ikinci doğrulama faktörü olarak öğrenin.'
        ),
    },
    ai: {
        seo_title: text(
            'AI abbreviation in financial technology',
            'AI: сокращение в финансовых технологиях',
            'AI kısaltması ve finanstaki kullanımı'
        ),
        seo_description: text(
            'Understand AI as the shorthand for artificial intelligence in analytics, automation, risk scoring, and financial product design.',
            'Поймите AI как сокращение artificial intelligence в аналитике, автоматизации, оценке риска и финансовых продуктах.',
            'AI kısaltmasını analitik, otomasyon, risk skoru ve finansal ürün tasarımındaki yapay zeka anlamıyla öğrenin.'
        ),
    },
    'biometric-auth': {
        seo_title: text(
            'Biometric auth shorthand in security',
            'Biometric auth: сокращение в безопасности',
            'Biometric auth kısaltması ve güvenlik'
        ),
        seo_description: text(
            'Understand biometric auth as shorthand for fingerprint, face, or voice checks used in account access and payment approval.',
            'Поймите biometric auth как сокращение для проверки отпечатка, лица или голоса при входе и подтверждении платежей.',
            'Biometric auth kısaltmasını hesap erişimi ve ödeme onayındaki parmak izi, yüz veya ses kontrolü olarak öğrenin.'
        ),
    },
    difficulty: {
        seo_title: text(
            'Mining difficulty in blockchain networks',
            'Mining difficulty: сложность майнинга',
            'Mining difficulty nedir: madencilik zorluğu'
        ),
        seo_description: text(
            'Learn difficulty as the blockchain mining adjustment that keeps block production near the intended network interval.',
            'Разберите difficulty как настройку майнинга блокчейна, удерживающую выпуск блоков около целевого интервала сети.',
            'Difficulty kavramını blok üretimini hedef ağ aralığına yakın tutan blokzincir madencilik ayarı olarak öğrenin.'
        ),
    },
    fdv: {
        seo_title: text(
            'FDV abbreviation in token valuation',
            'FDV: сокращение в оценке токенов',
            'FDV kısaltması ve token değerlemesi'
        ),
        seo_description: text(
            'Understand FDV as the abbreviation for fully diluted valuation in token supply, market cap, unlock, and dilution analysis.',
            'Поймите FDV как сокращение fully diluted valuation в анализе предложения токенов, капитализации, unlock и dilution.',
            'FDV kısaltmasını token arzı, piyasa değeri, kilit açılışı ve seyrelme analizindeki fully diluted valuation olarak öğrenin.'
        ),
    },
    sbt: {
        seo_title: text(
            'SBT abbreviation for soulbound tokens',
            'SBT: сокращение для soulbound token',
            'SBT kısaltması ve soulbound token'
        ),
        seo_description: text(
            'Understand SBT as the shorthand for non-transferable soulbound tokens used for identity, credentials, and reputation.',
            'Поймите SBT как сокращение для непередаваемых soulbound token в идентичности, credential и репутации.',
            'SBT kısaltmasını kimlik, yeterlilik ve itibar için kullanılan devredilemez soulbound token anlamıyla öğrenin.'
        ),
    },
    'wrapped-bitcoin-wbtc': {
        seo_title: text(
            'WBTC abbreviation for wrapped bitcoin',
            'WBTC: сокращение для wrapped bitcoin',
            'WBTC kısaltması ve sarılı bitcoin'
        ),
        seo_description: text(
            'Understand WBTC as the wrapped bitcoin abbreviation for representing bitcoin liquidity on other blockchain networks.',
            'Поймите WBTC как сокращение wrapped bitcoin для представления ликвидности биткоина в других блокчейн-сетях.',
            'WBTC kısaltmasını bitcoin likiditesini başka blokzincir ağlarında temsil eden sarılı bitcoin anlamıyla öğrenin.'
        ),
    },
    contactless: {
        seo_title: text(
            'Contactless shorthand in card payments',
            'Contactless: сокращение в card payments',
            'Contactless kısaltması ve temassız ödeme'
        ),
        seo_description: text(
            'Understand contactless as shorthand for tap-based card or wallet payments using NFC and nearby payment acceptance.',
            'Поймите contactless как сокращение для оплаты картой или кошельком касанием через NFC и близкое принятие платежа.',
            'Contactless kısaltmasını NFC ile kart veya cüzdan dokundurarak yapılan temassız ödeme anlamıyla öğrenin.'
        ),
    },
    'fiat-money': {
        seo_title: text(
            'Fiat money as everyday currency term',
            'Fiat money: термин для обычных денег',
            'Fiat money nedir: itibari para terimi'
        ),
        seo_description: text(
            'Learn fiat money as the common currency concept behind state-issued money, payments, banking balances, and purchasing power.',
            'Разберите fiat money как понятие обычных государственных денег, платежей, банковских остатков и покупательной силы.',
            'Fiat money kavramını devlet parası, ödemeler, banka bakiyeleri ve satın alma gücü bağlamında öğrenin.'
        ),
    },
    ledger: {
        seo_title: text(
            'Ledger recordkeeping term in finance',
            'Ledger: учётная книга в финансах',
            'Ledger nedir: finansal kayıt defteri'
        ),
        seo_description: text(
            'Learn ledger as a recordkeeping system for accounts, balances, transactions, reconciliation, and audit trails.',
            'Разберите ledger как систему учёта счетов, остатков, транзакций, сверки и проверяемой истории записей.',
            'Ledger kavramını hesaplar, bakiyeler, işlemler, mutabakat ve denetim izi için kayıt sistemi olarak öğrenin.'
        ),
    },
    'peer-to-peer': {
        seo_title: text(
            'Peer to peer model without acronym focus',
            'Peer to peer: модель без акцента на P2P',
            'Peer to peer nedir: P2P odaksız model'
        ),
        seo_description: text(
            'Understand peer to peer as the plain model of direct participant interaction in payments, networks, lending, or marketplaces.',
            'Поймите peer to peer как прямое взаимодействие участников в платежах, сетях, кредитовании или маркетплейсах.',
            'Peer to peer kavramını ödemeler, ağlar, kredi veya pazaryerlerinde doğrudan katılımcı etkileşimi olarak öğrenin.'
        ),
    },
};

export const getSearchIntentMetadataOverride = (
    slug: string
): SearchIntentMetadataOverride | null => (
    searchIntentMetadataOverrides[slug] ?? null
);
