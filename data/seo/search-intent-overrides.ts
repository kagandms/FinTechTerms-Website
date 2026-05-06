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
            'Learn High-Frequency Trading HFT as a market microstructure strategy involving low latency, automated execution, liquidity, spreads, and exchange infrastructure.',
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
            'Understand High Frequency Trading as the plain-language concept behind fast algorithmic execution, order-book reaction speed, and automated market participation.',
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
            'Understand ROA as the abbreviation for return on assets, used in profitability analysis, asset efficiency comparisons, and bank or company performance reviews.',
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
            'Whitepaper kavramını kripto ve token projelerinde protokol tasarımı, token modeli, yol haritası, riskler, yönetişim ve teknik varsayımlar belgesi olarak öğrenin.'
        ),
    },
};

export const getSearchIntentMetadataOverride = (
    slug: string
): SearchIntentMetadataOverride | null => (
    searchIntentMetadataOverrides[slug] ?? null
);
