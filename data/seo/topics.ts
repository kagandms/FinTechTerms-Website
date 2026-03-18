import { priorityClusters } from '@/data/seo/priority-terms';
import type { Topic } from '@/types';

const section = (
    titleEn: string,
    titleRu: string,
    titleTr: string,
    bodyEn: string,
    bodyRu: string,
    bodyTr: string
): Topic['sections'][number] => ({
    title: {
        en: titleEn,
        ru: titleRu,
        tr: titleTr,
    },
    body: {
        en: bodyEn,
        ru: bodyRu,
        tr: bodyTr,
    },
});

export const seoTopics: readonly Topic[] = [
    {
        id: 'cards-payments',
        slug: 'cards-payments',
        updated_at: '2026-03-15T00:00:00.000Z',
        title: {
            en: 'Cards and payments infrastructure',
            ru: 'Карточная и платёжная инфраструктура',
            tr: 'Kart ve ödeme altyapısı',
        },
        description: {
            en: 'Card processing, merchant operations, acceptance, retries, settlement, and transaction optimization.',
            ru: 'Карточный процессинг, мерчант-операции, эквайринг, повторные попытки, расчёты и оптимизация транзакций.',
            tr: 'Kart işleme, işletme operasyonları, kabul, tekrar denemeler, mutabakat ve işlem optimizasyonu.',
        },
        hero: {
            en: 'Understand how payment acceptance works from authorization to refunds and platform risk.',
            ru: 'Поймите, как работает платёжный приём: от авторизации до возвратов и платформенного риска.',
            tr: 'Ödeme kabulünün yetkilendirmeden iadeye ve platform riskine kadar nasıl işlediğini anlayın.',
        },
        relatedTopicIds: ['open-banking', 'fraud-identity-security', 'regtech-compliance'],
        sourceIds: ['stripe-tokenization-101', 'stripe-merchant-of-record', 'stripe-payment-facilitator', 'adyen-payment-glossary', 'emv-3ds'],
        priorityTermSlugs: priorityClusters['cards-payments'].slugs,
        sections: [
            section(
                'Acceptance stack',
                'Стек платёжного приёма',
                'Ödeme kabul katmanı',
                'This cluster explains how merchant-facing payments move through authorization, authentication, routing, retries, settlement, refunds, and liability shifts. It covers the vocabulary product, risk, and operations teams need when they diagnose conversion loss or payment failures.',
                'Этот кластер объясняет, как merchant-facing платежи проходят через авторизацию, аутентификацию, маршрутизацию, повторные попытки, расчёты, возвраты и перераспределение ответственности. Здесь собрана лексика, необходимая product-, risk- и operations-командам при анализе потери конверсии и платёжных отказов.',
                'Bu küme, merchant-facing ödemelerin yetkilendirme, kimlik doğrulama, yönlendirme, tekrar deneme, mutabakat, iade ve sorumluluk kayması boyunca nasıl ilerlediğini açıklar. Dönüşüm kaybı veya ödeme hatalarını inceleyen ürün, risk ve operasyon ekiplerinin ihtiyaç duyduğu terminolojiyi kapsar.'
            ),
            section(
                'Conversion and routing tradeoffs',
                'Компромиссы конверсии и маршрутизации',
                'Dönüşüm ve yönlendirme dengeleri',
                'Cards and payments infrastructure is not only a checkout topic. Terms such as merchant of record, payment facilitator, network token, and payment orchestration also determine compliance posture, retry logic, recovery from declines, and the economics of cross-border scale.',
                'Карточная и платёжная инфраструктура — это не только тема checkout. Термины вроде merchant of record, payment facilitator, network token и payment orchestration определяют комплаенс-позицию, логику повторных попыток, восстановление после decline и экономику трансграничного масштаба.',
                'Kart ve ödeme altyapısı yalnızca checkout konusu değildir. Merchant of record, payment facilitator, network token ve payment orchestration gibi terimler; uyum duruşunu, tekrar deneme mantığını, decline sonrası toparlanmayı ve sınır ötesi ölçeğin ekonomisini belirler.'
            ),
            section(
                'Market context',
                'Рыночный контекст',
                'Pazar bağlamı',
                'The same payment term can behave differently across BIST, MOEX, and global rails because issuer behavior, scheme rules, merchant risk tolerance, and fraud tooling vary by market. This hub is designed to connect the shared term vocabulary with those execution differences.',
                'Один и тот же платёжный термин может вести себя по-разному в контурах BIST, MOEX и global rails, потому что поведение эмитентов, правила схем, риск-толерантность мерчантов и antifraud-инструменты отличаются по рынкам. Этот hub связывает общий словарь терминов с такими различиями исполнения.',
                'Aynı ödeme terimi BIST, MOEX ve global raylarda farklı çalışabilir; çünkü issuer davranışı, şema kuralları, işletme risk toleransı ve fraud araçları pazara göre değişir. Bu hub, ortak terminolojiyi bu icra farklılıklarına bağlamak için tasarlanmıştır.'
            ),
        ],
    },
    {
        id: 'open-banking',
        slug: 'open-banking',
        updated_at: '2026-03-15T00:00:00.000Z',
        title: {
            en: 'Open banking and payment rails',
            ru: 'Открытый банкинг и платёжные рельсы',
            tr: 'Açık bankacılık ve ödeme rayları',
        },
        description: {
            en: 'API-based banking access, real-time rails, standards, account-to-account payments, and recurring permissions.',
            ru: 'Доступ к банковским данным через API, мгновенные рельсы, стандарты, переводы счёт-счёт и рекуррентные разрешения.',
            tr: 'API tabanlı bankacılık erişimi, anlık ödeme rayları, standartlar, hesaptan hesaba ödemeler ve yinelenen izinler.',
        },
        hero: {
            en: 'Map the vocabulary of open finance, modern payment messaging, and regulated API access.',
            ru: 'Соберите лексику open finance, современных платёжных сообщений и регулируемого API-доступа.',
            tr: 'Açık finans, modern ödeme mesajlaşması ve düzenlenmiş API erişimi söz varlığını haritalayın.',
        },
        relatedTopicIds: ['cards-payments', 'regtech-compliance'],
        sourceIds: ['open-banking-uk-standard', 'eba-sca', 'swift-iso-20022'],
        priorityTermSlugs: priorityClusters['open-banking'].slugs,
        sections: [
            section(
                'Rails and permissions',
                'Платёжные рельсы и разрешения',
                'Ödeme rayları ve izinler',
                'Open banking vocabulary sits at the intersection of regulated API access, account permissions, and payment messaging standards. This hub focuses on how terms such as PSD2, SCA, ISO 20022, and variable recurring payments connect user consent with bank-to-bank execution.',
                'Лексика open banking находится на пересечении регулируемого API-доступа, разрешений на счёт и стандартов платёжных сообщений. Этот hub показывает, как PSD2, SCA, ISO 20022 и variable recurring payments связывают пользовательское согласие с bank-to-bank исполнением.',
                'Açık bankacılık söz varlığı; düzenlenmiş API erişimi, hesap izinleri ve ödeme mesajlaşma standartlarının kesişimindedir. Bu hub, PSD2, SCA, ISO 20022 ve variable recurring payments gibi terimlerin kullanıcı onayını bankadan bankaya ödeme icrasıyla nasıl bağladığını gösterir.'
            ),
            section(
                'Messaging standards',
                'Стандарты сообщений',
                'Mesajlaşma standartları',
                'Standards such as SWIFT, SEPA, BACS, and ISO 20022 shape how payment data is structured, validated, and routed. They are essential for understanding why some payment products scale cleanly across jurisdictions while others remain market-specific.',
                'Стандарты вроде SWIFT, SEPA, BACS и ISO 20022 определяют, как структурируются, валидируются и маршрутизируются платёжные данные. Они критичны для понимания того, почему одни платёжные продукты масштабируются между юрисдикциями, а другие остаются market-specific.',
                'SWIFT, SEPA, BACS ve ISO 20022 gibi standartlar ödeme verisinin nasıl yapılandırıldığını, doğrulandığını ve yönlendirildiğini belirler. Bazı ödeme ürünlerinin neden farklı yargı alanlarında temiz ölçeklendiğini, bazılarının ise pazara özgü kaldığını anlamak için kritiktir.'
            ),
            section(
                'Product strategy impact',
                'Влияние на продуктовую стратегию',
                'Ürün stratejisine etkisi',
                'For fintech teams, this topic is not just about compliance. It influences onboarding design, recurring payment architecture, treasury operations, and the boundaries between banking-as-a-service, account-to-account payments, and embedded finance.',
                'Для финтех-команд это не только тема комплаенса. Она влияет на дизайн онбординга, архитектуру рекуррентных платежей, treasury operations и границы между banking-as-a-service, account-to-account payments и embedded finance.',
                'Fintek ekipleri için bu konu yalnızca uyumla ilgili değildir. Onboarding tasarımını, yinelenen ödeme mimarisini, treasury operasyonlarını ve banking-as-a-service, hesaptan hesaba ödemeler ile embedded finance arasındaki sınırları etkiler.'
            ),
        ],
    },
    {
        id: 'regtech-compliance',
        slug: 'regtech-compliance',
        updated_at: '2026-03-15T00:00:00.000Z',
        title: {
            en: 'RegTech and compliance controls',
            ru: 'RegTech и комплаенс-контроль',
            tr: 'RegTech ve uyum kontrolleri',
        },
        description: {
            en: 'KYC, AML, reporting, authentication, regulatory sandboxes, and digital compliance infrastructure.',
            ru: 'KYC, AML, отчётность, аутентификация, регуляторные песочницы и цифровая инфраструктура комплаенса.',
            tr: 'KYC, AML, raporlama, kimlik doğrulama, düzenleyici sandbox’lar ve dijital uyum altyapısı.',
        },
        hero: {
            en: 'Learn the language of regulatory controls that shape fintech product design and market access.',
            ru: 'Освойте язык регуляторных контролей, которые формируют дизайн финтех-продукта и доступ к рынкам.',
            tr: 'Fintek ürün tasarımını ve pazara erişimi şekillendiren düzenleyici kontrol dilini öğrenin.',
        },
        relatedTopicIds: ['open-banking', 'fraud-identity-security', 'cards-payments'],
        sourceIds: ['eba-sca', 'european-commission-mica', 'google-helpful-content'],
        priorityTermSlugs: priorityClusters['regtech-compliance'].slugs,
        sections: [
            section(
                'Control vocabulary',
                'Лексика контроля',
                'Kontrol söz varlığı',
                'RegTech and compliance terms explain how fintech firms interpret legal duties as system requirements. This hub connects operational controls such as KYC, AML, SCA, and sandbox participation with the language of product access, monitoring, and auditability.',
                'Термины RegTech и комплаенса объясняют, как финтех-компании переводят юридические обязанности в системные требования. Этот hub связывает операционные контроли вроде KYC, AML, SCA и sandbox-participation с языком продуктового доступа, мониторинга и аудируемости.',
                'RegTech ve uyum terimleri, fintek şirketlerinin yasal yükümlülükleri sistem gereksinimlerine nasıl çevirdiğini açıklar. Bu hub; KYC, AML, SCA ve sandbox katılımı gibi operasyonel kontrolleri ürün erişimi, izleme ve denetlenebilirlik diliyle birleştirir.'
            ),
            section(
                'Policy meets product',
                'Политика встречается с продуктом',
                'Politika ile ürünün kesişimi',
                'Compliance terminology matters because product scope, onboarding friction, identity checks, and transaction monitoring all change when a firm crosses from simple software into regulated financial activity.',
                'Терминология комплаенса важна, потому что scope продукта, трение онбординга, identity checks и transaction monitoring меняются, когда компания переходит от простого software к регулируемой финансовой деятельности.',
                'Uyum terminolojisi önemlidir; çünkü bir şirket basit yazılımdan düzenlenmiş finansal faaliyete geçtiğinde ürün kapsamı, onboarding sürtünmesi, kimlik kontrolleri ve işlem izleme tamamen değişir.'
            ),
            section(
                'Jurisdictional differences',
                'Юрисдикционные различия',
                'Yargı farkları',
                'BIST, MOEX, and broader global markets may use overlapping compliance language while applying different thresholds, documentation standards, and supervisory expectations. This hub treats that difference as part of the glossary itself.',
                'BIST, MOEX и более широкий global market могут использовать похожий язык комплаенса, но применять разные пороги, стандарты документов и supervisory expectations. Этот hub рассматривает такое различие как часть самого глоссария.',
                'BIST, MOEX ve daha geniş global pazarlar benzer uyum dilini kullanabilir; ancak farklı eşikler, belge standartları ve denetim beklentileri uygular. Bu hub bu farkı sözlüğün doğal bir parçası olarak ele alır.'
            ),
        ],
    },
    {
        id: 'crypto-infrastructure',
        slug: 'crypto-infrastructure',
        updated_at: '2026-03-15T00:00:00.000Z',
        title: {
            en: 'Crypto infrastructure',
            ru: 'Криптоинфраструктура',
            tr: 'Kripto altyapısı',
        },
        description: {
            en: 'Blockchain execution, validation, scaling, privacy, account models, and protocol design.',
            ru: 'Исполнение в блокчейне, валидация, масштабирование, приватность, модели аккаунтов и дизайн протоколов.',
            tr: 'Blokzincir yürütme, doğrulama, ölçekleme, gizlilik, hesap modelleri ve protokol tasarımı.',
        },
        hero: {
            en: 'Trace how crypto systems move from base-layer consensus to app-specific scaling and security assumptions.',
            ru: 'Проследите путь криптосистем: от консенсуса базового слоя до специализированного масштабирования и предпосылок безопасности.',
            tr: 'Kripto sistemlerin temel katman uzlaşısından uygulamaya özel ölçekleme ve güvenlik varsayımlarına nasıl geçtiğini izleyin.',
        },
        relatedTopicIds: ['rwa-tokenization', 'fraud-identity-security', 'ai-data-finance'],
        sourceIds: ['coinbase-crypto-glossary', 'european-commission-mica', 'google-helpful-content'],
        priorityTermSlugs: priorityClusters['crypto-infrastructure'].slugs,
        sections: [
            section(
                'Execution layers',
                'Слои исполнения',
                'Yürütme katmanları',
                'Crypto infrastructure terms describe how value and state move through base-layer chains, execution environments, validators, sequencers, rollups, and wallet abstractions. This hub is built to connect protocol language with product-level implications.',
                'Термины криптоинфраструктуры описывают, как value и state проходят через базовые цепочки, execution environments, validators, sequencers, rollups и wallet abstractions. Этот hub соединяет язык протокола с продуктовыми последствиями.',
                'Kripto altyapı terimleri; değer ve durumun temel zincirler, yürütme ortamları, doğrulayıcılar, sequencer’lar, rollup’lar ve cüzdan soyutlamaları boyunca nasıl hareket ettiğini açıklar. Bu hub protokol dilini ürün seviyesindeki sonuçlarla birleştirir.'
            ),
            section(
                'Security assumptions',
                'Предпосылки безопасности',
                'Güvenlik varsayımları',
                'Concepts such as MEV, oracle design, proof systems, and blind signing matter because they change trust boundaries. A term may look purely technical while actually determining who can extract value, reorder transactions, or compromise a wallet flow.',
                'Такие понятия, как MEV, oracle design, proof systems и blind signing, важны, потому что меняют границы доверия. Термин может выглядеть чисто техническим, хотя на деле определяет, кто способен извлекать value, reorder transactions или компрометировать wallet flow.',
                'MEV, oracle tasarımı, ispat sistemleri ve kör imzalama gibi kavramlar önemlidir; çünkü güven sınırlarını değiştirir. Bir terim saf teknik görünebilir ama gerçekte kimin değer çıkarabileceğini, işlemleri yeniden sıralayabileceğini veya cüzdan akışını riske atabileceğini belirler.'
            ),
            section(
                'Scaling vocabulary',
                'Лексика масштабирования',
                'Ölçekleme dili',
                'Layer 2, appchains, Bitcoin Layer 2, and account abstraction are not interchangeable labels. This hub exists to prevent that flattening and to show where scaling, programmability, and user experience diverge.',
                'Layer 2, appchains, Bitcoin Layer 2 и account abstraction — не взаимозаменяемые ярлыки. Этот hub нужен, чтобы предотвратить такое уплощение и показать, где расходятся scaling, programmability и user experience.',
                'Layer 2, appchain, Bitcoin Layer 2 ve account abstraction birbirinin yerine geçen etiketler değildir. Bu hub, bu düzleştirmeyi önlemek ve ölçekleme, programlanabilirlik ile kullanıcı deneyiminin nerede ayrıştığını göstermek için vardır.'
            ),
        ],
    },
    {
        id: 'rwa-tokenization',
        slug: 'rwa-tokenization',
        updated_at: '2026-03-15T00:00:00.000Z',
        title: {
            en: 'Tokenization and real-world assets',
            ru: 'Токенизация и активы реального мира',
            tr: 'Tokenizasyon ve gerçek dünya varlıkları',
        },
        description: {
            en: 'Payment tokenization, asset tokenization, stable assets, and infrastructure that bridges on-chain and off-chain value.',
            ru: 'Платёжная токенизация, токенизация активов, стабильные активы и инфраструктура, связывающая on-chain и off-chain стоимость.',
            tr: 'Ödeme tokenizasyonu, varlık tokenizasyonu, istikrarlı varlıklar ve zincir içi ile zincir dışı değeri birleştiren altyapı.',
        },
        hero: {
            en: 'Separate payment tokenization from asset tokenization and understand where real-world value enters digital rails.',
            ru: 'Отделите платёжную токенизацию от токенизации активов и поймите, где реальная стоимость входит в цифровые рельсы.',
            tr: 'Ödeme tokenizasyonunu varlık tokenizasyonundan ayırın ve gerçek dünya değerinin dijital raylara nereden girdiğini anlayın.',
        },
        relatedTopicIds: ['cards-payments', 'crypto-infrastructure'],
        sourceIds: ['stripe-tokenization-101', 'coinbase-crypto-glossary', 'bis-proof-of-reserves'],
        priorityTermSlugs: priorityClusters['rwa-tokenization'].slugs,
        sections: [
            section(
                'Three meanings of tokenization',
                'Три смысла токенизации',
                'Tokenizasyonun üç anlamı',
                'Tokenization can refer to payment credential replacement, on-chain representation of assets, or programmable wrappers around existing value. This hub makes those meanings explicit so that product and market conversations do not collapse them into one vague label.',
                'Токенизация может означать замену платёжного реквизита, on-chain представление активов или программируемые оболочки вокруг существующей стоимости. Этот hub делает эти значения явными, чтобы продуктовые и рыночные обсуждения не сводили их к одному расплывчатому ярлыку.',
                'Tokenizasyon; ödeme bilgisinin ikame edilmesi, varlıkların zincir üstü temsili veya mevcut değerin programlanabilir sarmalları anlamına gelebilir. Bu hub, ürün ve piyasa tartışmalarının bunları tek bir belirsiz etikete indirgememesi için bu anlamları açıkça ayırır.'
            ),
            section(
                'Asset realism',
                'Реализм активов',
                'Varlık gerçekliği',
                'RWA language matters because a token is not automatically equivalent to legal ownership, settlement finality, or reserve quality. This hub connects asset-backed terms with custody, proof, and issuance assumptions.',
                'Язык RWA важен, потому что токен автоматически не равен legal ownership, settlement finality или качеству резервов. Этот hub связывает asset-backed термины с предпосылками custody, proof и issuance.',
                'RWA dili önemlidir; çünkü bir token otomatik olarak yasal mülkiyet, mutabakat kesinliği veya rezerv kalitesi anlamına gelmez. Bu hub, varlık destekli terimleri saklama, ispat ve ihraç varsayımlarıyla ilişkilendirir.'
            ),
            section(
                'Bridge between payments and crypto',
                'Мост между платежами и крипто',
                'Ödemeler ile kripto arasındaki köprü',
                'The same vocabulary increasingly appears in both payments and crypto. Network token, stablecoin, CBDC, and wrapped assets sit at that boundary, which is why this hub is structurally linked to both cards/payments and crypto infrastructure.',
                'Один и тот же словарь всё чаще появляется и в payments, и в crypto. Network token, stablecoin, CBDC и wrapped assets находятся на этой границе, поэтому этот hub структурно связан и с cards/payments, и с crypto infrastructure.',
                'Aynı söz varlığı giderek hem ödemelerde hem kriptoda görünür hale geliyor. Network token, stablecoin, CBDC ve wrapped assets bu sınırda yer alır; bu yüzden bu hub yapısal olarak hem kart/ödeme hem de kripto altyapı kümelerine bağlıdır.'
            ),
        ],
    },
    {
        id: 'market-microstructure',
        slug: 'market-microstructure',
        updated_at: '2026-03-15T00:00:00.000Z',
        title: {
            en: 'Market microstructure and execution',
            ru: 'Рыночная микроструктура и исполнение',
            tr: 'Piyasa mikro yapısı ve işlem icrası',
        },
        description: {
            en: 'Execution quality, spreads, liquidity, order flow, and algorithmic market behaviour.',
            ru: 'Качество исполнения, спреды, ликвидность, поток ордеров и алгоритмическое поведение рынка.',
            tr: 'İşlem kalitesi, spread’ler, likidite, emir akışı ve algoritmik piyasa davranışı.',
        },
        hero: {
            en: 'Build a vocabulary for price formation, execution risk, and algorithmic interaction across exchanges.',
            ru: 'Сформируйте словарь для ценообразования, риска исполнения и алгоритмического взаимодействия между биржами.',
            tr: 'Borsalar arasında fiyat oluşumu, işlem riski ve algoritmik etkileşim için bir söz varlığı oluşturun.',
        },
        relatedTopicIds: ['ai-data-finance', 'cards-payments'],
        sourceIds: ['google-helpful-content', 'google-title-links', 'adyen-payment-glossary'],
        priorityTermSlugs: priorityClusters['market-microstructure'].slugs,
        sections: [
            section(
                'Execution language',
                'Язык исполнения',
                'İcra dili',
                'Microstructure terms explain how orders become trades, how liquidity is revealed or hidden, and how execution quality deteriorates under stress. This hub translates market mechanics into a working vocabulary for trading, analytics, and platform strategy.',
                'Термины микроструктуры объясняют, как ордера становятся сделками, как ликвидность раскрывается или скрывается и как качество исполнения ухудшается под стрессом. Этот hub переводит рыночную механику в рабочий словарь для trading, analytics и platform strategy.',
                'Mikro yapı terimleri, emirlerin nasıl işleme dönüştüğünü, likiditenin nasıl görünür veya gizli hale geldiğini ve stres altında işlem kalitesinin nasıl bozulduğunu açıklar. Bu hub, piyasa mekaniğini trading, analitik ve platform stratejisi için çalışan bir söz varlığına çevirir.'
            ),
            section(
                'Latency and liquidity',
                'Задержка и ликвидность',
                'Gecikme ve likidite',
                'Latency, spread, slippage, and order-book depth are tightly connected. A glossary that treats them separately without showing execution tradeoffs fails both education and strategy; this hub is meant to keep them connected.',
                'Latency, spread, slippage и глубина стакана тесно связаны. Глоссарий, который рассматривает их по отдельности и не показывает execution tradeoffs, проваливает и образование, и стратегию; этот hub нужен, чтобы удерживать их в одной логике.',
                'Latency, spread, slippage ve order-book derinliği sıkı biçimde bağlantılıdır. Bunları icra dengelerini göstermeden ayrı ayrı ele alan bir sözlük hem eğitimde hem stratejide yetersiz kalır; bu hub onları aynı mantıkta tutmak için vardır.'
            ),
            section(
                'From exchanges to products',
                'От биржи к продукту',
                'Borsadan ürüne',
                'Execution vocabulary is not relevant only to prop desks. Fintech products using brokerage, treasury, token swaps, or AI-driven signals all depend on the same underlying language of price formation and market impact.',
                'Лексика исполнения важна не только для prop desks. Финтех-продукты с brokerage, treasury, token swaps или AI-driven signals зависят от того же базового языка price formation и market impact.',
                'İcra söz varlığı yalnızca prop desk’ler için önemli değildir. Aracılık, treasury, token swap veya yapay zeka destekli sinyaller kullanan fintek ürünleri aynı temel fiyat oluşumu ve piyasa etkisi diline bağlıdır.'
            ),
        ],
    },
    {
        id: 'fraud-identity-security',
        slug: 'fraud-identity-security',
        updated_at: '2026-03-15T00:00:00.000Z',
        title: {
            en: 'Fraud, identity, and security',
            ru: 'Мошенничество, идентичность и безопасность',
            tr: 'Dolandırıcılık, kimlik ve güvenlik',
        },
        description: {
            en: 'Authentication, wallet security, phishing, transaction approval risk, and user protection controls.',
            ru: 'Аутентификация, безопасность кошельков, фишинг, риск подтверждения транзакций и защитные механизмы для пользователя.',
            tr: 'Kimlik doğrulama, cüzdan güvenliği, oltalama, işlem onay riski ve kullanıcı koruma kontrolleri.',
        },
        hero: {
            en: 'Understand the vocabulary of trust and failure points in payment and wallet security flows.',
            ru: 'Поймите лексику доверия и точек отказа в платёжных сценариях и безопасности кошельков.',
            tr: 'Ödeme ve cüzdan güvenliği akışlarında güven ve hata noktalarının dilini anlayın.',
        },
        relatedTopicIds: ['cards-payments', 'regtech-compliance', 'crypto-infrastructure'],
        sourceIds: ['emv-3ds', 'eba-sca', 'coinbase-crypto-glossary'],
        priorityTermSlugs: priorityClusters['fraud-identity-security'].slugs,
        sections: [
            section(
                'Trust boundary terms',
                'Термины границ доверия',
                'Güven sınırı terimleri',
                'Fraud and wallet security vocabulary explains where users delegate trust, where controls intervene, and where approval flows fail. This hub unifies payments authentication language with crypto wallet risk language.',
                'Лексика мошенничества и безопасности кошельков объясняет, где пользователь делегирует доверие, где вмешиваются контроли и где ломаются approval flows. Этот hub объединяет язык payment authentication с языком риска crypto wallet.',
                'Dolandırıcılık ve cüzdan güvenliği söz varlığı; kullanıcının güveni nerede devrettiğini, kontrollerin nerede devreye girdiğini ve onay akışlarının nerede kırıldığını açıklar. Bu hub, ödeme kimlik doğrulama dilini kripto cüzdan risk diliyle birleştirir.'
            ),
            section(
                'Identity vs possession',
                'Идентичность против владения',
                'Kimlik ve zilyetlik',
                'Some terms verify the user, others protect the credential, and others govern signing behavior. Without separating identity, possession, and authorization language, fintech security analysis becomes sloppy.',
                'Одни термины подтверждают пользователя, другие защищают credential, третьи управляют signing behavior. Без разделения языка identity, possession и authorization анализ финтех-безопасности становится расплывчатым.',
                'Bazı terimler kullanıcıyı doğrular, bazıları credential’ı korur, bazıları ise imzalama davranışını yönetir. Kimlik, zilyetlik ve yetkilendirme dilini ayırmadan yapılan fintek güvenlik analizi dağınık kalır.'
            ),
            section(
                'Operational relevance',
                'Операционная релевантность',
                'Operasyonel önem',
                'This hub is designed for teams that manage fraud rates, wallet UX, recovery flows, and approval risk. The point is not to define security in the abstract, but to connect terms to failure modes that affect real products.',
                'Этот hub предназначен для команд, которые управляют fraud rates, wallet UX, recovery flows и approval risk. Его цель — не абстрактно определять безопасность, а связывать термины с failure modes, влияющими на реальные продукты.',
                'Bu hub; fraud oranlarını, cüzdan UX’ini, kurtarma akışlarını ve onay riskini yöneten ekipler için tasarlanmıştır. Amaç güvenliği soyut biçimde tanımlamak değil, terimleri gerçek ürünleri etkileyen hata modlarıyla bağlamaktır.'
            ),
        ],
    },
    {
        id: 'ai-data-finance',
        slug: 'ai-data-finance',
        updated_at: '2026-03-15T00:00:00.000Z',
        title: {
            en: 'AI and data in finance',
            ru: 'ИИ и данные в финансах',
            tr: 'Finansta yapay zeka ve veri',
        },
        description: {
            en: 'AI, analytics, predictive systems, and data infrastructure used in financial decision-making.',
            ru: 'ИИ, аналитика, предиктивные системы и инфраструктура данных, используемые в финансовом принятии решений.',
            tr: 'Finansal karar alma süreçlerinde kullanılan yapay zeka, analitik, tahmin sistemleri ve veri altyapısı.',
        },
        hero: {
            en: 'Connect machine intelligence, analytics, and financial interpretation with a shared working vocabulary.',
            ru: 'Свяжите машинный интеллект, аналитику и финансовую интерпретацию общим рабочим словарём.',
            tr: 'Makine zekası, analitik ve finansal yorumu ortak bir çalışma söz varlığıyla birleştirin.',
        },
        relatedTopicIds: ['market-microstructure', 'crypto-infrastructure'],
        sourceIds: ['google-helpful-content', 'google-title-links', 'coinbase-crypto-glossary'],
        priorityTermSlugs: priorityClusters['ai-data-finance'].slugs,
        sections: [
            section(
                'Analytical systems',
                'Аналитические системы',
                'Analitik sistemler',
                'AI and data vocabulary becomes valuable when it is anchored in financial use cases: forecasting, anomaly detection, ranking, recommendation, and execution support. This hub ties general technical terms to those financial outcomes.',
                'Лексика ИИ и данных становится ценной, когда привязана к финансовым use cases: forecasting, anomaly detection, ranking, recommendation и execution support. Этот hub связывает общие технические термины с такими финансовыми результатами.',
                'Yapay zeka ve veri söz varlığı; tahminleme, anomali tespiti, sıralama, öneri ve işlem desteği gibi finansal kullanım senaryolarına bağlandığında değer kazanır. Bu hub genel teknik terimleri bu finansal sonuçlarla ilişkilendirir.'
            ),
            section(
                'Model language',
                'Язык моделей',
                'Model dili',
                'Terms such as machine learning, NLP, and predictive analytics are often used loosely in fintech marketing. This hub separates the actual technical meaning of each term from broad branding language.',
                'Термины вроде machine learning, NLP и predictive analytics часто используются слишком свободно в финтех-маркетинге. Этот hub отделяет реальный технический смысл каждого термина от широкого брендового языка.',
                'Machine learning, NLP ve predictive analytics gibi terimler fintek pazarlamasında çoğu zaman gevşek kullanılır. Bu hub, her terimin gerçek teknik anlamını geniş marka dilinden ayırır.'
            ),
            section(
                'Data dependence',
                'Зависимость от данных',
                'Veri bağımlılığı',
                'Financial AI is only as strong as the data and market framing behind it. This topic therefore sits next to market microstructure and crypto infrastructure, where the quality and timing of data shape the validity of analytics.',
                'Финансовый ИИ настолько силён, насколько сильны данные и рыночная рамка, стоящие за ним. Поэтому тема находится рядом с market microstructure и crypto infrastructure, где качество и время данных определяют валидность аналитики.',
                'Finansal yapay zeka, ancak arkasındaki veri ve piyasa çerçevesi kadar güçlüdür. Bu nedenle konu, verinin kalitesi ve zamanlamasının analitiğin geçerliliğini belirlediği piyasa mikro yapısı ve kripto altyapısı kümelerinin yanında konumlanır.'
            ),
        ],
    },
];
