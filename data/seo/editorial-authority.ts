import type { Language, LocalizedText, Term } from '@/types';

type AuthorityContentBlock = Pick<
    Term,
    | 'expanded_definition'
    | 'why_it_matters'
    | 'how_it_works'
    | 'risks_and_pitfalls'
    | 'regional_notes'
    | 'seo_title'
    | 'seo_description'
>;

export interface EditorialAuthorityOverride {
    readonly sourceIds: readonly string[];
    readonly searchIntent: LocalizedText;
    readonly authorityRationale: LocalizedText;
    readonly content: AuthorityContentBlock;
}

const text = (en: string, ru: string, tr: string): LocalizedText => ({
    en,
    ru,
    tr,
});

const buildContentBlock = (
    expandedDefinition: LocalizedText,
    whyItMatters: LocalizedText,
    howItWorks: LocalizedText,
    risksAndPitfalls: LocalizedText,
    regionalNotes: LocalizedText,
    seoTitle: LocalizedText,
    seoDescription: LocalizedText
): AuthorityContentBlock => ({
    expanded_definition: expandedDefinition,
    why_it_matters: whyItMatters,
    how_it_works: howItWorks,
    risks_and_pitfalls: risksAndPitfalls,
    regional_notes: regionalNotes,
    seo_title: seoTitle,
    seo_description: seoDescription,
});

export const editorialAuthorityPilotSlugs = [
    'tokenization',
    'merchant-of-record',
    'payment-facilitator',
    'network-token',
    'open-banking',
    'sca',
    '3d-secure',
    'payment-gateway',
    'chargeback',
    'authorization',
    'capture',
    'acquirer',
    'issuer',
    'stablecoin',
    'proof-of-reserves',
    'seed-phrase',
    'blind-signing',
    'iso-20022',
    'psd2',
    'buy-now-pay-later',
] as const;

export type EditorialAuthorityPilotSlug = typeof editorialAuthorityPilotSlugs[number];

export const editorialAuthorityOverrides: Record<EditorialAuthorityPilotSlug, EditorialAuthorityOverride> = {
    tokenization: {
        sourceIds: ['stripe-tokenization-101', 'adyen-payment-glossary', 'emv-3ds'],
        searchIntent: text(
            'Understand payment tokenization, network tokens, data-security impact, and the difference between card-token and asset-token use cases.',
            'Понять payment tokenization, network tokens, влияние на безопасность данных и различие между card-token и asset-token сценариями.',
            'Payment tokenization, ağ tokenları, veri güvenliği etkisi ve kart-token ile varlık-token kullanımları arasındaki farkı anlamak.'
        ),
        authorityRationale: text(
            'Uses payment infrastructure sources and separates payment tokenization from broader asset tokenization to reduce search-intent ambiguity.',
            'Опирается на источники платёжной инфраструктуры и отделяет payment tokenization от asset tokenization, чтобы снизить неоднозначность search intent.',
            'Ödeme altyapısı kaynaklarına dayanır ve arama niyeti belirsizliğini azaltmak için payment tokenization ile asset tokenization ayrımını netleştirir.'
        ),
        content: buildContentBlock(
            text(
                'Tokenization replaces sensitive payment or asset identifiers with a token that can be used in a controlled workflow without exposing the original value. In payments, the important distinction is whether the token protects a card credential, represents a network-issued credential, or describes a broader asset-tokenization model.',
                'Токенизация заменяет чувствительный платёжный или имущественный идентификатор токеном, который можно использовать в контролируемом процессе без раскрытия исходного значения. В платежах важно различать защиту карточного реквизита, network-issued credential и более широкую модель asset tokenization.',
                'Tokenizasyon, hassas ödeme veya varlık tanımlayıcılarını, orijinal değeri açığa çıkarmadan kontrollü bir akışta kullanılabilen token ile değiştirir. Ödemelerde kritik ayrım; tokenın kart bilgisini mi koruduğu, kart ağı tarafından mı verildiği yoksa daha geniş bir varlık-tokenizasyon modelini mi anlattığıdır.'
            ),
            text(
                'Tokenization matters because it directly affects payment security, data minimization, authorization reliability, PCI scope, and how teams explain the boundary between card infrastructure and digital-asset infrastructure.',
                'Токенизация важна, потому что напрямую влияет на безопасность платежей, минимизацию данных, надёжность авторизации, PCI scope и объяснение границы между карточной инфраструктурой и digital-asset infrastructure.',
                'Tokenizasyon; ödeme güvenliği, veri minimizasyonu, yetkilendirme güvenilirliği, PCI kapsamı ve kart altyapısı ile dijital varlık altyapısı arasındaki sınırın açıklanması üzerinde doğrudan etkilidir.'
            ),
            text(
                'Operationally, the original credential is collected, exchanged for a token, stored or transmitted as the safer reference, and mapped back only by the authorized token service or payment infrastructure when the transaction requires it.',
                'Операционно исходный реквизит собирается, заменяется токеном, хранится или передаётся как более безопасная ссылка и раскрывается обратно только авторизованным token service или платёжной инфраструктурой, когда этого требует транзакция.',
                'Operasyonel olarak gerçek kimlik bilgisi alınır, token ile değiştirilir, daha güvenli referans olarak saklanır veya iletilir ve yalnızca işlem gerektiğinde yetkili token servisi ya da ödeme altyapısı tarafından eşleştirilir.'
            ),
            text(
                'The main risk is using tokenization as a generic security label while ignoring who issues the token, what domain it is valid in, how detokenization is controlled, and whether the token reduces or merely relocates operational risk.',
                'Главный риск — использовать tokenization как общий security label, игнорируя эмитента токена, область его действия, контроль detokenization и вопрос о том, снижает ли токен риск или просто переносит его.',
                'Ana risk, tokenizasyonu genel bir güvenlik etiketi gibi kullanıp tokenı kimin verdiğini, hangi alanda geçerli olduğunu, detokenization kontrolünü ve riskin gerçekten azalıp azalmadığını göz ardı etmektir.'
            ),
            text(
                'Across BIST, MOEX, and global contexts, terminology should separate card-payment tokenization from capital-market tokenization and crypto asset representation, because regulatory duties, custody assumptions, and settlement flows differ.',
                'В контекстах BIST, MOEX и global нужно отделять card-payment tokenization от capital-market tokenization и представления crypto assets, потому что regulatory duties, custody assumptions и settlement flows различаются.',
                'BIST, MOEX ve global bağlamlarda kart ödemesi tokenizasyonu; sermaye piyasası tokenizasyonu ve kripto varlık temsilinden ayrılmalıdır çünkü regülasyon yükümlülükleri, saklama varsayımları ve mutabakat akışları farklıdır.'
            ),
            text(
                'Tokenization meaning in payments, fintech, and digital assets',
                'Токенизация: значение в платежах, финтехе и digital assets',
                'Tokenizasyon nedir: ödemeler, fintek ve dijital varlıklar'
            ),
            text(
                'Learn tokenization with payment-security context, network-token distinction, operational flow, risks, and BIST/MOEX/global terminology notes.',
                'Разберите tokenization через payment-security контекст, отличие network token, операционный процесс, риски и заметки для BIST/MOEX/global.',
                'Tokenizasyonu ödeme güvenliği, ağ token farkı, operasyonel akış, riskler ve BIST/MOEX/global terminoloji notlarıyla öğrenin.'
            )
        ),
    },
    'merchant-of-record': {
        sourceIds: ['stripe-connect-merchant-of-record', 'stripe-merchant-of-record', 'stripe-payment-facilitator'],
        searchIntent: text(
            'Clarify who legally sells to the customer, who carries tax/payment/compliance responsibility, and how MoR differs from payment facilitator.',
            'Понять, кто юридически продаёт клиенту, кто несёт налоговую, платёжную и compliance responsibility, и чем MoR отличается от payment facilitator.',
            'Müşteriye hukuken kimin satış yaptığı, vergi/ödeme/uyum sorumluluğunu kimin taşıdığı ve MoR ile payment facilitator farkını netleştirmek.'
        ),
        authorityRationale: text(
            'Anchors MoR in liability and operating responsibility rather than treating it as a generic payments vendor label.',
            'Закрепляет MoR через liability и операционную ответственность, а не как общий ярлык payments vendor.',
            'MoR kavramını genel bir ödeme sağlayıcı etiketi yerine sorumluluk ve operasyon sahipliği üzerinden konumlandırır.'
        ),
        content: buildContentBlock(
            text(
                'A merchant of record is the legal seller responsible for the payment transaction and the commercial obligations attached to it. In platform commerce, the term matters because the entity shown to the customer, the entity handling refunds and disputes, and the entity responsible for tax or compliance may not be the same as the software platform.',
                'Merchant of record — это юридический продавец, отвечающий за платёжную транзакцию и связанные коммерческие обязательства. В platform commerce термин важен, потому что entity, видимая клиенту, entity, управляющая refunds и disputes, и entity, отвечающая за налоги или compliance, может отличаться от software platform.',
                'Merchant of Record, ödeme işleminden ve ona bağlı ticari yükümlülüklerden sorumlu yasal satıcıdır. Platform ticaretinde müşteriye görünen taraf, iade/itiraz süreçlerini yürüten taraf ve vergi ya da uyumdan sorumlu taraf yazılım platformuyla aynı olmayabilir.'
            ),
            text(
                'MoR matters because it changes revenue operations, chargeback ownership, tax collection, customer receipts, refund handling, and the compliance boundary between marketplace, seller, and payment provider.',
                'MoR важен, потому что меняет revenue operations, ownership по chargeback, сбор налогов, customer receipts, refunds и compliance boundary между marketplace, seller и payment provider.',
                'MoR; gelir operasyonları, chargeback sahipliği, vergi tahsilatı, müşteri makbuzları, iade yönetimi ve marketplace-satıcı-ödeme sağlayıcı uyum sınırı üzerinde belirleyicidir.'
            ),
            text(
                'In practice, the MoR appears in the checkout and back-office chain as the party that processes or sponsors the sale, manages transaction evidence, handles refunds and disputes, and keeps the financial record aligned with the commercial sale.',
                'На практике MoR проявляется в checkout и back-office цепочке как сторона, которая processes или sponsors sale, управляет transaction evidence, refunds и disputes и связывает финансовую запись с коммерческой продажей.',
                'Pratikte MoR, checkout ve back-office zincirinde satışı işleyen veya üstlenen, işlem kanıtını yöneten, iade/itiraz süreçlerini taşıyan ve finansal kaydı ticari satışla hizalayan taraf olarak görünür.'
            ),
            text(
                'The common mistake is to confuse MoR with a payment facilitator or gateway. A gateway can move messages, and a payfac can onboard sub-merchants, but MoR language is about legal seller responsibility and transaction liability.',
                'Типичная ошибка — смешивать MoR с payment facilitator или gateway. Gateway передаёт сообщения, payfac может подключать sub-merchants, но MoR относится к ответственности legal seller и transaction liability.',
                'Yaygın hata MoR’u payment facilitator veya gateway ile karıştırmaktır. Gateway mesaj taşır, payfac alt işletmeleri sisteme alabilir; MoR dili ise yasal satıcı sorumluluğu ve işlem yükümlülüğüyle ilgilidir.'
            ),
            text(
                'In cross-border BIST/MOEX/global commerce, MoR analysis should be separated from local acquiring, FX settlement, tax invoicing, and consumer-protection duties because each can sit with a different counterparty.',
                'В cross-border контекстах BIST/MOEX/global анализ MoR нужно отделять от local acquiring, FX settlement, tax invoicing и consumer-protection duties, потому что каждая функция может находиться у разного контрагента.',
                'BIST/MOEX/global sınır ötesi ticarette MoR analizi; yerel acquiring, kur mutabakatı, vergi faturalaması ve tüketici koruma yükümlülüklerinden ayrılmalıdır çünkü her biri farklı karşı tarafta olabilir.'
            ),
            text(
                'Merchant of Record meaning, liability, and payfac comparison',
                'Merchant of Record: значение, liability и сравнение с payfac',
                'Merchant of Record nedir: sorumluluk ve payfac karşılaştırması'
            ),
            text(
                'Understand merchant of record responsibility, payment liability, refunds, disputes, tax context, and MoR vs payment facilitator differences.',
                'Разберите merchant of record: responsibility, payment liability, refunds, disputes, tax context и отличие от payment facilitator.',
                'Merchant of Record sorumluluğunu; ödeme yükümlülüğü, iadeler, itirazlar, vergi bağlamı ve payment facilitator farkıyla öğrenin.'
            )
        ),
    },
    'payment-facilitator': {
        sourceIds: ['visa-payment-facilitator-model', 'stripe-payment-facilitator', 'stripe-connect-merchant-of-record'],
        searchIntent: text(
            'Explain the payfac model, master merchant account structure, sub-merchant onboarding, and MoR/payfac distinction.',
            'Объяснить payfac model, структуру master merchant account, onboarding sub-merchants и различие MoR/payfac.',
            'Payfac modelini, ana merchant hesabı yapısını, alt işletme onboarding sürecini ve MoR/payfac ayrımını açıklamak.'
        ),
        authorityRationale: text(
            'Treats payfac as an onboarding and acceptance model with risk controls, not as a synonym for gateway or MoR.',
            'Рассматривает payfac как модель onboarding и acceptance с risk controls, а не как синоним gateway или MoR.',
            'Payfac kavramını gateway veya MoR eş anlamlısı değil, risk kontrolleri olan onboarding ve kabul modeli olarak ele alır.'
        ),
        content: buildContentBlock(
            text(
                'A payment facilitator enables sub-merchants to accept payments under a broader acquiring or master merchant structure. The model is useful when a platform needs faster onboarding and centralized payment operations, but it also concentrates underwriting, monitoring, settlement, and dispute responsibilities.',
                'Payment facilitator позволяет sub-merchants принимать платежи в рамках более широкой acquiring или master merchant structure. Модель полезна для быстрого onboarding и централизованных payment operations, но концентрирует underwriting, monitoring, settlement и dispute responsibilities.',
                'Payment facilitator, alt işletmelerin daha geniş bir acquiring veya master merchant yapısı altında ödeme almasını sağlar. Model hızlı onboarding ve merkezi ödeme operasyonu için yararlıdır; ancak underwriting, izleme, mutabakat ve itiraz sorumluluklarını da yoğunlaştırır.'
            ),
            text(
                'Payfac matters because it changes how platforms evaluate merchant risk, KYC depth, payout timing, fraud monitoring, chargeback exposure, and the operational split between platform and payment provider.',
                'Payfac важен, потому что меняет оценку merchant risk, глубину KYC, payout timing, fraud monitoring, chargeback exposure и операционное разделение между platform и payment provider.',
                'Payfac; platformların üye işyeri riskini, KYC derinliğini, ödeme zamanlamasını, dolandırıcılık izlemeyi, chargeback maruziyetini ve platform-ödeme sağlayıcı ayrımını nasıl yönettiğini değiştirir.'
            ),
            text(
                'Operationally, the platform gathers merchant information, routes it through the payfac model, monitors activity, and coordinates acceptance, payout, and dispute workflows while the acquiring relationship supports the underlying card acceptance.',
                'Операционно платформа собирает merchant information, проводит её через payfac model, мониторит activity и координирует acceptance, payout и dispute workflows, пока acquiring relationship поддерживает карточный приём.',
                'Operasyonel olarak platform üye işyeri bilgisini toplar, payfac modeli üzerinden işler, faaliyeti izler ve kabul, ödeme aktarımı ve itiraz akışlarını koordine eder; acquiring ilişkisi ise kart kabulünü destekler.'
            ),
            text(
                'The main pitfall is assuming faster onboarding means lower responsibility. Poor sub-merchant controls can turn a payfac model into a concentrated fraud, compliance, or chargeback problem.',
                'Главная ошибка — считать, что быстрый onboarding означает меньшую ответственность. Слабые sub-merchant controls превращают payfac model в концентрированный fraud, compliance или chargeback problem.',
                'Ana hata hızlı onboarding’in daha az sorumluluk anlamına geldiğini varsaymaktır. Zayıf alt işletme kontrolleri payfac modelini yoğunlaşmış dolandırıcılık, uyum veya chargeback problemine dönüştürebilir.'
            ),
            text(
                'In BIST/MOEX/global contexts, payfac language should be checked against local payment-institution rules, marketplace structure, merchant settlement rights, and whether the platform is also acting as MoR.',
                'В контекстах BIST/MOEX/global термин payfac нужно сверять с local payment-institution rules, marketplace structure, merchant settlement rights и вопросом, выступает ли platform также как MoR.',
                'BIST/MOEX/global bağlamlarda payfac dili; yerel ödeme kuruluşu kuralları, marketplace yapısı, üye işyeri mutabakat hakları ve platformun aynı zamanda MoR olup olmadığı üzerinden kontrol edilmelidir.'
            ),
            text(
                'Payment Facilitator meaning, model, and merchant risk controls',
                'Payment Facilitator: значение, модель и merchant risk controls',
                'Payment Facilitator nedir: model ve üye işyeri risk kontrolleri'
            ),
            text(
                'Learn payment facilitator meaning with sub-merchant onboarding, master merchant structure, risk controls, and MoR comparison.',
                'Разберите payment facilitator через sub-merchant onboarding, master merchant structure, risk controls и сравнение с MoR.',
                'Payment facilitator kavramını alt işletme onboarding, ana merchant yapısı, risk kontrolleri ve MoR karşılaştırmasıyla öğrenin.'
            )
        ),
    },
    'network-token': {
        sourceIds: ['stripe-tokenization-101', 'adyen-payment-glossary', 'emv-3ds'],
        searchIntent: text(
            'Understand how card network tokens differ from stored PAN tokens and why they affect authorization, lifecycle updates, and security.',
            'Понять, чем network tokens отличаются от stored PAN tokens и почему они влияют на authorization, lifecycle updates и security.',
            'Kart ağı tokenlarının saklanan PAN tokenlarından farkını ve yetkilendirme, yaşam döngüsü güncellemeleri ile güvenliği nasıl etkilediğini anlamak.'
        ),
        authorityRationale: text(
            'Separates network-issued credentials from generic tokenization to avoid conflating vault tokens, card-network tokens, and crypto tokens.',
            'Отделяет network-issued credentials от generic tokenization, чтобы не смешивать vault tokens, card-network tokens и crypto tokens.',
            'Vault token, kart ağı tokenı ve kripto tokenların karışmaması için ağ tarafından verilen kimlik bilgisini genel tokenizasyondan ayırır.'
        ),
        content: buildContentBlock(
            text(
                'A network token is a card-network-issued payment credential that can replace the primary account number in eligible transactions. Unlike a basic vault token, it is tied to card-network lifecycle controls and can support updated credentials when a card expires, is replaced, or changes state.',
                'Network token — это платёжный credential, выпускаемый карточной сетью и заменяющий primary account number в подходящих транзакциях. В отличие от basic vault token, он связан с lifecycle controls карточной сети и может поддерживать обновление реквизитов при истечении, перевыпуске или изменении статуса карты.',
                'Ağ tokenı, uygun işlemlerde primary account number yerine kullanılabilen ve kart ağı tarafından verilen ödeme kimlik bilgisidir. Basit vault token’dan farklı olarak kart ağı yaşam döngüsü kontrollerine bağlıdır ve kart süresi dolduğunda, yeniden basıldığında veya durumu değiştiğinde güncel kimlik bilgilerini destekleyebilir.'
            ),
            text(
                'Network tokens matter because they can improve credential freshness, reduce exposed card data, support recurring commerce, and influence authorization outcomes without treating every token as the same object.',
                'Network tokens важны, потому что улучшают свежесть реквизитов, снижают exposed card data, поддерживают recurring commerce и влияют на authorization outcomes без смешения всех token types.',
                'Ağ tokenları; kimlik bilgisinin güncelliğini artırabildiği, açıkta kalan kart verisini azaltabildiği, yinelenen ticareti desteklediği ve yetkilendirme sonuçlarını etkileyebildiği için önemlidir.'
            ),
            text(
                'In a typical flow, the merchant or provider requests tokenization, the network issues or provisions the network token, the token is used for transaction processing, and lifecycle events keep the credential aligned with the underlying card account.',
                'В типичном flow merchant или provider запрашивает tokenization, сеть выпускает или provisions network token, токен используется для transaction processing, а lifecycle events синхронизируют credential с базовым card account.',
                'Tipik akışta işletme veya sağlayıcı tokenizasyon ister, ağ network tokenı oluşturur veya sağlar, token işlem işleme için kullanılır ve yaşam döngüsü olayları kimlik bilgisini alttaki kart hesabıyla hizalar.'
            ),
            text(
                'The risk is assuming a network token is automatically accepted everywhere or that it removes all fraud and compliance duties. Issuer support, transaction context, merchant setup, and fallback handling still matter.',
                'Риск — считать, что network token автоматически принимается везде или снимает все fraud и compliance duties. Issuer support, transaction context, merchant setup и fallback handling всё ещё важны.',
                'Risk, ağ tokenının her yerde otomatik kabul edildiğini veya tüm dolandırıcılık ve uyum sorumluluklarını kaldırdığını varsaymaktır. Issuer desteği, işlem bağlamı, işletme kurulumu ve fallback yönetimi hâlâ önemlidir.'
            ),
            text(
                'For BIST/MOEX/global analysis, network token should be treated as payments infrastructure vocabulary, not crypto vocabulary; the regulatory and operational questions sit around card acceptance, data handling, and cross-border processing.',
                'Для анализа BIST/MOEX/global network token следует считать термином payments infrastructure, а не crypto vocabulary; regulatory и operational вопросы касаются card acceptance, data handling и cross-border processing.',
                'BIST/MOEX/global analizinde ağ tokenı kripto terimi değil ödeme altyapısı terimi olarak ele alınmalıdır; düzenleyici ve operasyonel sorular kart kabulü, veri işleme ve sınır ötesi işleme etrafında oluşur.'
            ),
            text(
                'Network Token meaning in card payments and tokenization',
                'Network Token: значение в card payments и tokenization',
                'Ağ Tokenı nedir: kart ödemeleri ve tokenizasyon'
            ),
            text(
                'Understand network tokens, card credential lifecycle, authorization impact, security boundaries, and network token vs tokenization differences.',
                'Разберите network tokens, lifecycle карточных реквизитов, authorization impact, security boundaries и отличие network token от tokenization.',
                'Ağ tokenlarını; kart kimlik bilgisi yaşam döngüsü, yetkilendirme etkisi, güvenlik sınırları ve tokenization farkıyla öğrenin.'
            )
        ),
    },
    'open-banking': {
        sourceIds: ['open-banking-uk-standard', 'eba-sca', 'swift-iso-20022'],
        searchIntent: text(
            'Understand consent-based account access, regulated APIs, TPP/ASPSP roles, and open banking payment or data workflows.',
            'Понять consent-based account access, regulated APIs, роли TPP/ASPSP и open banking workflows для платежей или данных.',
            'Rızaya dayalı hesap erişimi, regüle API’ler, TPP/ASPSP rolleri ve açık bankacılık ödeme ya da veri akışlarını anlamak.'
        ),
        authorityRationale: text(
            'Frames open banking through consent, regulated roles, API standards, and security expectations instead of treating it as generic bank-data sharing.',
            'Описывает open banking через consent, regulated roles, API standards и security expectations, а не как обычный bank-data sharing.',
            'Açık bankacılığı genel banka verisi paylaşımı gibi değil; rıza, regüle roller, API standartları ve güvenlik beklentileri üzerinden açıklar.'
        ),
        content: buildContentBlock(
            text(
                'Open banking is a regulated model for accessing account data or initiating payments through APIs with user consent. The core actors are the account-holding institution, the third party provider, and the consent or permission that defines what can be accessed and for how long.',
                'Open banking — это регулируемая модель доступа к account data или инициации платежей через API с consent пользователя. Ключевые участники — account-holding institution, third party provider и consent или permission, определяющие доступ и срок действия.',
                'Açık bankacılık, kullanıcı rızasıyla API’ler üzerinden hesap verisine erişme veya ödeme başlatma modelidir. Temel aktörler hesabı tutan kurum, üçüncü taraf sağlayıcı ve hangi veriye ne kadar süre erişileceğini belirleyen rıza ya da izindir.'
            ),
            text(
                'Open banking matters because it moves bank connectivity from screen scraping and bilateral integrations toward standardized consent, stronger security controls, auditable data access, and new account-to-account payment flows.',
                'Open banking важен, потому что переводит bank connectivity от screen scraping и bilateral integrations к standardized consent, stronger security controls, auditable data access и новым account-to-account payment flows.',
                'Açık bankacılık; banka bağlantısını screen scraping ve ikili entegrasyonlardan standart rıza, daha güçlü güvenlik kontrolleri, denetlenebilir veri erişimi ve yeni hesaptan hesaba ödeme akışlarına taşıdığı için önemlidir.'
            ),
            text(
                'In practice, the user grants consent, the third party authenticates and requests access through the standard interface, the account provider validates the request, and data or payment instructions move within the agreed permission scope.',
                'На практике пользователь даёт consent, third party authenticates и запрашивает доступ через standard interface, account provider проверяет запрос, а данные или платёжные инструкции передаются в рамках согласованного scope.',
                'Pratikte kullanıcı rıza verir, üçüncü taraf standart arayüz üzerinden kimlik doğrular ve erişim ister, hesap sağlayıcı isteği doğrular, veri veya ödeme talimatları kararlaştırılan kapsam içinde ilerler.'
            ),
            text(
                'The main error is to ignore consent scope or role boundaries. Account information, payment initiation, confirmation of funds, and recurring permission models carry different risks and should not be described as one generic API access pattern.',
                'Главная ошибка — игнорировать consent scope и role boundaries. Account information, payment initiation, confirmation of funds и recurring permission models несут разные риски и не должны описываться как один generic API access pattern.',
                'Ana hata, rıza kapsamını ve rol sınırlarını göz ardı etmektir. Hesap bilgisi, ödeme başlatma, fon doğrulama ve yinelenen izin modelleri farklı riskler taşır; tek bir genel API erişim kalıbı gibi anlatılmamalıdır.'
            ),
            text(
                'For BIST and MOEX comparisons, open banking should be mapped to local payment-services regulation, bank API maturity, customer-authentication norms, and whether account-to-account payments have a reliable commercial rail.',
                'Для сравнений BIST и MOEX open banking нужно связывать с local payment-services regulation, зрелостью bank API, customer-authentication norms и наличием коммерчески надёжного account-to-account payment rail.',
                'BIST ve MOEX karşılaştırmalarında açık bankacılık; yerel ödeme hizmetleri düzenlemesi, banka API olgunluğu, müşteri kimlik doğrulama normları ve güvenilir hesaptan hesaba ödeme altyapısı ile eşleştirilmelidir.'
            ),
            text(
                'Open Banking meaning, API roles, consent, and payment flows',
                'Open Banking: значение, API roles, consent и payment flows',
                'Açık Bankacılık nedir: API rolleri, rıza ve ödeme akışları'
            ),
            text(
                'Learn open banking through consent, TPP and ASPSP roles, account data, payment initiation, risk controls, and regional implementation notes.',
                'Разберите open banking через consent, роли TPP и ASPSP, account data, payment initiation, risk controls и региональные заметки.',
                'Açık bankacılığı rıza, TPP ve ASPSP rolleri, hesap verisi, ödeme başlatma, risk kontrolleri ve bölgesel uygulama notlarıyla öğrenin.'
            )
        ),
    },
    sca: {
        sourceIds: ['eba-sca', 'emv-3ds', 'open-banking-uk-standard'],
        searchIntent: text(
            'Explain strong customer authentication, two-factor authentication context, PSD2 relevance, and how SCA affects checkout or open banking flows.',
            'Объяснить strong customer authentication, контекст two-factor authentication, связь с PSD2 и влияние SCA на checkout или open banking flows.',
            'Güçlü müşteri kimlik doğrulamayı, iki faktörlü doğrulama bağlamını, PSD2 ilişkisini ve SCA’nın checkout ya da açık bankacılık akışlarına etkisini açıklamak.'
        ),
        authorityRationale: text(
            'Connects SCA to regulation and authentication design without reducing it to a generic one-time-password step.',
            'Связывает SCA с regulation и authentication design, не сводя его к generic one-time-password step.',
            'SCA’yı genel tek kullanımlık şifre adımına indirgemeden regülasyon ve kimlik doğrulama tasarımıyla bağlar.'
        ),
        content: buildContentBlock(
            text(
                'Strong Customer Authentication is a security requirement and design pattern that asks payment or account-access flows to authenticate the customer with stronger evidence than a single weak signal. In fintech content, SCA should be explained as a control framework, not merely as an SMS code.',
                'Strong Customer Authentication — это security requirement и design pattern, требующий в payment или account-access flows более сильного подтверждения клиента, чем один слабый сигнал. В финтех-контенте SCA нужно объяснять как control framework, а не просто SMS code.',
                'Güçlü Müşteri Kimlik Doğrulama, ödeme veya hesap erişimi akışlarında müşterinin tek zayıf sinyalden daha güçlü kanıtla doğrulanmasını isteyen güvenlik gereksinimi ve tasarım kalıbıdır. Fintek içeriğinde SCA yalnızca SMS kodu değil, kontrol çerçevesi olarak anlatılmalıdır.'
            ),
            text(
                'SCA matters because it changes fraud prevention, checkout friction, regulatory compliance, payment exemptions, issuer decisioning, and the user experience of account access.',
                'SCA важна, потому что меняет fraud prevention, checkout friction, regulatory compliance, payment exemptions, issuer decisioning и user experience для account access.',
                'SCA; dolandırıcılık önleme, checkout sürtünmesi, düzenleyici uyum, ödeme istisnaları, ihraççı kararları ve hesap erişimi kullanıcı deneyimini değiştirdiği için önemlidir.'
            ),
            text(
                'Operationally, a payment or account-access request is assessed for authentication need, the customer is challenged or passed through a lower-friction path, and the result becomes part of the risk and approval decision.',
                'Операционно payment или account-access request оценивается на необходимость authentication, клиент проходит challenge или lower-friction path, а результат становится частью risk и approval decision.',
                'Operasyonel olarak ödeme veya hesap erişimi isteği kimlik doğrulama ihtiyacı açısından değerlendirilir, müşteri challenge ya da düşük sürtünmeli akıştan geçer ve sonuç risk/onay kararının parçası olur.'
            ),
            text(
                'The common pitfall is to treat SCA as always required and always identical. Exemptions, transaction risk analysis, channel design, issuer behavior, and local regulation can change the authentication path.',
                'Типичная ошибка — считать SCA всегда обязательной и одинаковой. Exemptions, transaction risk analysis, channel design, issuer behavior и local regulation могут менять authentication path.',
                'Yaygın hata SCA’yı her zaman zorunlu ve her zaman aynı sanmaktır. İstisnalar, işlem riski analizi, kanal tasarımı, ihraççı davranışı ve yerel düzenleme kimlik doğrulama yolunu değiştirebilir.'
            ),
            text(
                'In BIST/MOEX/global contexts, SCA language should be linked to the local legal payment-service perimeter, the available authentication rails, and whether the flow is card payment, open banking, or account access.',
                'В контекстах BIST/MOEX/global термин SCA нужно связывать с local legal payment-service perimeter, доступными authentication rails и типом flow: card payment, open banking или account access.',
                'BIST/MOEX/global bağlamlarda SCA dili; yerel ödeme hizmetleri hukuki sınırı, mevcut kimlik doğrulama altyapısı ve akışın kart ödemesi, açık bankacılık ya da hesap erişimi olup olmadığıyla ilişkilendirilmelidir.'
            ),
            text(
                'SCA meaning in PSD2, checkout, and open banking',
                'SCA: значение в PSD2, checkout и open banking',
                'SCA nedir: PSD2, checkout ve açık bankacılık bağlamı'
            ),
            text(
                'Learn Strong Customer Authentication with PSD2 context, checkout friction, fraud controls, 3-D Secure links, and regional implementation notes.',
                'Разберите Strong Customer Authentication через PSD2, checkout friction, fraud controls, 3-D Secure и региональные implementation notes.',
                'Güçlü Müşteri Kimlik Doğrulamayı PSD2 bağlamı, checkout sürtünmesi, dolandırıcılık kontrolleri, 3-D Secure ilişkisi ve bölgesel uygulama notlarıyla öğrenin.'
            )
        ),
    },
    '3d-secure': {
        sourceIds: ['emv-3ds', 'eba-sca', 'adyen-payment-glossary'],
        searchIntent: text(
            'Explain EMV 3-D Secure, issuer authentication, frictionless/challenge flows, CNP fraud control, and PSD2/SCA relevance.',
            'Объяснить EMV 3-D Secure, issuer authentication, frictionless/challenge flows, CNP fraud control и связь с PSD2/SCA.',
            'EMV 3-D Secure, ihraççı kimlik doğrulaması, frictionless/challenge akışları, CNP dolandırıcılık kontrolü ve PSD2/SCA ilişkisini açıklamak.'
        ),
        authorityRationale: text(
            'Grounds 3DS in the EMVCo protocol and issuer decisioning rather than treating it as a generic card password screen.',
            'Закрепляет 3DS в протоколе EMVCo и issuer decisioning, а не как generic card password screen.',
            '3DS’i genel kart şifresi ekranı gibi değil, EMVCo protokolü ve ihraççı karar süreci üzerinden açıklar.'
        ),
        content: buildContentBlock(
            text(
                '3D Secure is an e-commerce card authentication protocol that lets merchants, issuers, and card networks exchange transaction, payment-method, and device data to assess whether the customer should be authenticated before approval.',
                '3D Secure — это протокол аутентификации e-commerce card payments, позволяющий merchants, issuers и card networks обмениваться transaction, payment-method и device data для оценки необходимости customer authentication перед approval.',
                '3D Secure, e-ticaret kart ödemelerinde işletme, ihraççı ve kart ağlarının işlem, ödeme yöntemi ve cihaz verisini paylaşarak onay öncesi müşterinin doğrulanıp doğrulanmayacağını değerlendirmesini sağlayan protokoldür.'
            ),
            text(
                '3DS matters because it sits at the trade-off between fraud prevention, approval rate, checkout conversion, issuer liability, and SCA compliance for card-not-present transactions.',
                '3DS важен, потому что находится на границе fraud prevention, approval rate, checkout conversion, issuer liability и SCA compliance для card-not-present transactions.',
                '3DS; card-not-present işlemlerde dolandırıcılık önleme, onay oranı, checkout dönüşümü, ihraççı sorumluluğu ve SCA uyumu arasındaki dengede yer aldığı için önemlidir.'
            ),
            text(
                'In practice, the merchant initiates the authentication request, transaction data is passed to the issuer through the 3DS rails, and the issuer either approves frictionlessly or requires a challenge such as a one-time code, biometric step, or other authentication method.',
                'На практике merchant инициирует authentication request, transaction data передаётся issuer через 3DS rails, а issuer либо одобряет frictionless, либо требует challenge: one-time code, biometric step или другой authentication method.',
                'Pratikte işletme kimlik doğrulama isteğini başlatır, işlem verisi 3DS altyapısı üzerinden ihraççıya gider ve ihraççı işlemi frictionless onaylar ya da tek kullanımlık kod, biyometrik adım veya başka bir doğrulama yöntemi ister.'
            ),
            text(
                'The risk is overusing challenges and damaging conversion, or underusing authentication and increasing fraud exposure. Correct 3DS analysis separates protocol support, issuer behavior, exemption logic, and merchant UX.',
                'Риск — чрезмерно использовать challenges и снижать conversion или недоиспользовать authentication и повышать fraud exposure. Корректный анализ 3DS разделяет protocol support, issuer behavior, exemption logic и merchant UX.',
                'Risk, challenge adımlarını fazla kullanıp dönüşümü düşürmek veya kimlik doğrulamayı yetersiz kullanıp dolandırıcılık maruziyetini artırmaktır. Doğru 3DS analizi protokol desteğini, ihraççı davranışını, istisna mantığını ve işletme UX’ini ayırır.'
            ),
            text(
                'For BIST/MOEX/global commerce, 3DS should be interpreted through local issuer support, card-not-present fraud patterns, SCA-like requirements, and the merchant category’s tolerance for checkout friction.',
                'Для BIST/MOEX/global commerce 3DS следует интерпретировать через local issuer support, card-not-present fraud patterns, SCA-like requirements и tolerance merchant category к checkout friction.',
                'BIST/MOEX/global ticarette 3DS; yerel ihraççı desteği, card-not-present dolandırıcılık kalıpları, SCA benzeri gereklilikler ve merchant kategorisinin checkout sürtünmesine toleransı üzerinden yorumlanmalıdır.'
            ),
            text(
                '3D Secure meaning, frictionless flow, and SCA context',
                '3D Secure: значение, frictionless flow и SCA context',
                '3D Secure nedir: frictionless akış ve SCA bağlamı'
            ),
            text(
                'Learn 3D Secure with EMV 3DS protocol context, CNP fraud prevention, challenge flow, frictionless approval, and PSD2/SCA notes.',
                'Разберите 3D Secure через EMV 3DS, CNP fraud prevention, challenge flow, frictionless approval и PSD2/SCA notes.',
                '3D Secure’ü EMV 3DS protokolü, CNP dolandırıcılık önleme, challenge akışı, frictionless onay ve PSD2/SCA notlarıyla öğrenin.'
            )
        ),
    },
    'payment-gateway': {
        sourceIds: ['visa-cybersource-payments', 'adyen-payment-glossary', 'stripe-authorization-capture'],
        searchIntent: text(
            'Explain payment gateway meaning, authorization routing, merchant integration, gateway vs processor distinction, and checkout risk.',
            'Объяснить payment gateway, authorization routing, merchant integration, отличие gateway от processor и checkout risk.',
            'Ödeme geçidini; authorization routing, merchant entegrasyonu, gateway-processor farkı ve checkout riskiyle açıklamak.'
        ),
        authorityRationale: text(
            'Positions the gateway as a payment-message and integration layer instead of using it as a vague synonym for every payment provider.',
            'Позиционирует gateway как слой payment messages и integration, а не как расплывчатый синоним любого payment provider.',
            'Gateway’i her ödeme sağlayıcının eş anlamlısı gibi değil, ödeme mesajı ve entegrasyon katmanı olarak konumlandırır.'
        ),
        content: buildContentBlock(
            text(
                'A payment gateway is the checkout and integration layer that securely collects payment data and sends transaction messages toward processors, acquirers, networks, and issuers. It does not automatically own acquiring, settlement, merchant risk, or legal seller responsibility.',
                'Payment gateway — это checkout и integration layer, который безопасно собирает payment data и отправляет transaction messages к processors, acquirers, networks и issuers. Он не обязательно владеет acquiring, settlement, merchant risk или legal seller responsibility.',
                'Ödeme geçidi, ödeme verisini güvenli şekilde toplayıp işlem mesajlarını processor, acquirer, ağ ve issuer tarafına gönderen checkout ve entegrasyon katmanıdır. Acquiring, settlement, merchant riski veya yasal satıcı sorumluluğu otomatik olarak gateway’e ait değildir.'
            ),
            text(
                'Payment gateways matter because they influence authorization routing, fraud checks, payment-method presentation, retry behavior, observability, and the reliability of the merchant checkout experience.',
                'Payment gateways важны, потому что влияют на authorization routing, fraud checks, payment-method presentation, retry behavior, observability и надёжность merchant checkout experience.',
                'Ödeme geçitleri; yetkilendirme yönlendirmesini, fraud kontrollerini, ödeme yöntemi sunumunu, tekrar deneme davranışını, gözlemlenebilirliği ve merchant checkout deneyiminin güvenilirliğini etkiler.'
            ),
            text(
                'Operationally, the gateway accepts payment details or tokens, applies configuration and risk signals, routes the authorization request, returns the issuer response to the merchant, and may coordinate capture or refund requests depending on the integration.',
                'Операционно gateway принимает payment details или tokens, применяет configuration и risk signals, routes authorization request, возвращает issuer response merchant и может координировать capture или refund requests в зависимости от integration.',
                'Operasyonel olarak gateway ödeme detaylarını veya tokenları alır, konfigürasyon ve risk sinyallerini uygular, authorization isteğini yönlendirir, issuer yanıtını merchant’a döndürür ve entegrasyona göre capture veya refund isteklerini koordine edebilir.'
            ),
            text(
                'The common pitfall is to assume the gateway is the same as processor, acquirer, payment facilitator, or MoR. That confusion hides who owns funds flow, underwriting, disputes, compliance, and customer-facing liability.',
                'Типичная ошибка — считать gateway тем же самым, что processor, acquirer, payment facilitator или MoR. Это скрывает владельца funds flow, underwriting, disputes, compliance и customer-facing liability.',
                'Yaygın hata gateway’i processor, acquirer, payment facilitator veya MoR ile aynı sanmaktır. Bu karışıklık fon akışı, underwriting, itirazlar, uyum ve müşteriye dönük sorumluluğun kime ait olduğunu gizler.'
            ),
            text(
                'In BIST/MOEX/global payment analysis, gateway choice should be separated from local acquiring coverage, currency handling, scheme support, issuer behavior, and regional fraud tooling.',
                'В BIST/MOEX/global payment analysis выбор gateway нужно отделять от local acquiring coverage, currency handling, scheme support, issuer behavior и regional fraud tooling.',
                'BIST/MOEX/global ödeme analizinde gateway seçimi; yerel acquiring kapsamı, para birimi işleme, şema desteği, issuer davranışı ve bölgesel fraud araçlarından ayrıştırılmalıdır.'
            ),
            text(
                'Payment Gateway meaning, authorization routing, and processor difference',
                'Payment Gateway: значение, authorization routing и отличие от processor',
                'Ödeme Geçidi nedir: authorization routing ve processor farkı'
            ),
            text(
                'Learn payment gateway meaning with checkout integration, authorization routing, gateway vs processor boundaries, fraud checks, and regional payment context.',
                'Разберите payment gateway через checkout integration, authorization routing, границы gateway vs processor, fraud checks и regional payment context.',
                'Ödeme geçidini checkout entegrasyonu, authorization routing, gateway-processor sınırları, fraud kontrolleri ve bölgesel ödeme bağlamıyla öğrenin.'
            )
        ),
    },
    chargeback: {
        sourceIds: ['adyen-payment-glossary', 'stripe-merchant-of-record', 'emv-3ds'],
        searchIntent: text(
            'Understand chargeback meaning, dispute lifecycle, merchant liability, evidence, fraud distinction, and payment-operations impact.',
            'Понять chargeback, dispute lifecycle, merchant liability, evidence, отличие от fraud и влияние на payment operations.',
            'Chargeback anlamını, itiraz yaşam döngüsünü, üye işyeri sorumluluğunu, kanıtı, dolandırıcılıktan farkını ve ödeme operasyonu etkisini anlamak.'
        ),
        authorityRationale: text(
            'Connects chargebacks to dispute evidence and operating risk instead of reducing the term to a simple refund.',
            'Связывает chargeback с dispute evidence и operating risk, а не сводит термин к обычному refund.',
            'Chargeback’i basit iade gibi değil; itiraz kanıtı ve operasyonel risk bağlamında açıklar.'
        ),
        content: buildContentBlock(
            text(
                'A chargeback is a cardholder-initiated dispute that can reverse a card transaction through the card network process. It differs from a merchant refund because the issuer and scheme rules control the evidence timeline, reason code, liability outcome, and financial reversal.',
                'Chargeback — это инициированный cardholder dispute, который может отменить карточную транзакцию через card network process. Он отличается от merchant refund тем, что issuer и scheme rules задают evidence timeline, reason code, liability outcome и financial reversal.',
                'Chargeback, kart sahibinin başlattığı ve kart ağı süreci üzerinden kart işlemini tersine çevirebilen itirazdır. Merchant refund’dan farklıdır çünkü kanıt takvimi, reason code, sorumluluk sonucu ve finansal ters kayıt issuer ve şema kurallarıyla yönetilir.'
            ),
            text(
                'Chargebacks matter because they affect merchant margin, fraud monitoring, customer support, fulfillment evidence, platform risk, and the way a marketplace assigns dispute responsibility.',
                'Chargebacks важны, потому что влияют на merchant margin, fraud monitoring, customer support, fulfillment evidence, platform risk и распределение dispute responsibility в marketplace.',
                'Chargeback’ler; üye işyeri marjını, dolandırıcılık izlemeyi, müşteri desteğini, teslimat kanıtını, platform riskini ve marketplace içinde itiraz sorumluluğunun nasıl paylaşıldığını etkiler.'
            ),
            text(
                'Operationally, the cardholder disputes the transaction, the issuer opens the case, the merchant or platform submits evidence, and the acquirer/card network process determines whether liability remains with the merchant or is reversed.',
                'Операционно cardholder оспаривает транзакцию, issuer открывает case, merchant или platform подаёт evidence, а acquirer/card network process определяет, остаётся ли liability у merchant или reverses.',
                'Operasyonel olarak kart sahibi işleme itiraz eder, issuer dosyayı açar, işletme veya platform kanıt sunar ve acquirer/kart ağı süreci sorumluluğun işletmede kalıp kalmayacağını belirler.'
            ),
            text(
                'The common pitfall is treating every chargeback as fraud or every refund as a chargeback. Reason codes, evidence quality, delivery model, authentication status, and customer communication change the correct response.',
                'Типичная ошибка — считать каждый chargeback fraud или каждый refund chargeback. Reason codes, evidence quality, delivery model, authentication status и customer communication меняют правильный response.',
                'Yaygın hata her chargeback’i dolandırıcılık veya her iadeyi chargeback sanmaktır. Reason code, kanıt kalitesi, teslimat modeli, doğrulama durumu ve müşteri iletişimi doğru yanıtı değiştirir.'
            ),
            text(
                'In BIST/MOEX/global contexts, chargeback analysis should consider local card scheme rules, consumer protection norms, acquirer evidence requirements, and whether the seller, platform, MoR, or payfac owns the dispute workflow.',
                'В контекстах BIST/MOEX/global анализ chargeback должен учитывать local card scheme rules, consumer protection norms, evidence requirements acquirer и владельца dispute workflow: seller, platform, MoR или payfac.',
                'BIST/MOEX/global bağlamlarda chargeback analizi; yerel kart şeması kurallarını, tüketici koruma normlarını, acquirer kanıt gereksinimlerini ve itiraz akışının satıcı, platform, MoR ya da payfac tarafından mı yönetildiğini dikkate almalıdır.'
            ),
            text(
                'Chargeback meaning, dispute flow, and merchant liability',
                'Chargeback: значение, dispute flow и merchant liability',
                'Chargeback nedir: itiraz akışı ve üye işyeri sorumluluğu'
            ),
            text(
                'Learn chargeback meaning with dispute lifecycle, evidence, fraud distinction, merchant liability, and BIST/MOEX/global payment-risk context.',
                'Разберите chargeback через dispute lifecycle, evidence, отличие от fraud, merchant liability и BIST/MOEX/global payment-risk context.',
                'Chargeback’i itiraz yaşam döngüsü, kanıt, dolandırıcılık ayrımı, üye işyeri sorumluluğu ve BIST/MOEX/global ödeme riski bağlamıyla öğrenin.'
            )
        ),
    },
    authorization: {
        sourceIds: ['stripe-authorization-capture', 'adyen-capture-docs', 'visa-visanet-acceptance'],
        searchIntent: text(
            'Explain card authorization, approval/decline logic, authorization rate, capture distinction, and checkout conversion impact.',
            'Объяснить card authorization, approval/decline logic, authorization rate, отличие от capture и влияние на checkout conversion.',
            'Kart yetkilendirmeyi, onay/ret mantığını, authorization rate kavramını, capture farkını ve checkout dönüşümü etkisini açıklamak.'
        ),
        authorityRationale: text(
            'Separates authorization from capture, settlement, and final fund movement, which prevents operational ambiguity in payments content.',
            'Отделяет authorization от capture, settlement и финального движения средств, предотвращая operational ambiguity в payments content.',
            'Yetkilendirmeyi capture, settlement ve nihai fon hareketinden ayırarak ödeme içeriğinde operasyonel belirsizliği azaltır.'
        ),
        content: buildContentBlock(
            text(
                'Authorization is the payment step where the issuer or payment network checks whether a card transaction can be approved before funds are captured. It is not the same as settlement: authorization answers whether the payment may proceed, while capture and settlement determine how money is finalized and moved.',
                'Authorization — это этап платежа, на котором issuer или payment network проверяет, может ли карточная транзакция быть approved до capture средств. Это не settlement: authorization отвечает, может ли payment proceed, а capture и settlement определяют финализацию и движение денег.',
                'Yetkilendirme, fonlar tahsil edilmeden önce kart işleminin onaylanıp onaylanamayacağını issuer veya ödeme ağının kontrol ettiği adımdır. Settlement ile aynı değildir: authorization ödemenin ilerleyip ilerlemeyeceğini söyler, capture ve settlement paranın nasıl kesinleşip hareket edeceğini belirler.'
            ),
            text(
                'Authorization matters because approval rate, decline reason, issuer decisioning, token quality, 3DS outcome, fraud controls, and retry logic all affect checkout revenue and customer experience.',
                'Authorization важна, потому что approval rate, decline reason, issuer decisioning, token quality, 3DS outcome, fraud controls и retry logic влияют на checkout revenue и customer experience.',
                'Yetkilendirme; approval rate, ret nedeni, issuer kararı, token kalitesi, 3DS sonucu, dolandırıcılık kontrolleri ve tekrar deneme mantığı checkout geliri ile müşteri deneyimini etkilediği için önemlidir.'
            ),
            text(
                'In practice, transaction details are sent through the payment processor and card network, the issuer evaluates account status and risk signals, and the response returns as an approval, decline, or condition that affects the next payment step.',
                'На практике transaction details проходят через payment processor и card network, issuer оценивает account status и risk signals, а response возвращается как approval, decline или condition, влияющее на следующий payment step.',
                'Pratikte işlem detayları ödeme işleyicisi ve kart ağı üzerinden gider, issuer hesap durumunu ve risk sinyallerini değerlendirir, yanıt onay, ret veya bir sonraki ödeme adımını etkileyen koşul olarak döner.'
            ),
            text(
                'The main pitfall is optimizing authorization rate without controlling fraud, cost, or customer eligibility. A higher approval rate is not automatically better if bad traffic, weak authentication, or poor retry logic increases losses.',
                'Главная ошибка — оптимизировать authorization rate без контроля fraud, cost или customer eligibility. Более высокий approval rate не всегда лучше, если bad traffic, слабая authentication или poor retry logic увеличивают losses.',
                'Ana risk, fraud, maliyet veya müşteri uygunluğunu kontrol etmeden authorization rate’i optimize etmektir. Kötü trafik, zayıf kimlik doğrulama veya hatalı retry mantığı kayıpları artırıyorsa daha yüksek onay oranı otomatik olarak iyi değildir.'
            ),
            text(
                'In BIST/MOEX/global payment analysis, authorization should be separated from local acquiring performance, cross-border routing, issuer behavior, currency handling, and the merchant’s capture policy.',
                'В BIST/MOEX/global payment analysis authorization нужно отделять от local acquiring performance, cross-border routing, issuer behavior, currency handling и capture policy merchant.',
                'BIST/MOEX/global ödeme analizinde yetkilendirme; yerel acquiring performansı, sınır ötesi yönlendirme, issuer davranışı, para birimi işleme ve merchant capture politikasından ayrılmalıdır.'
            ),
            text(
                'Authorization meaning, approval rate, and card payment flow',
                'Authorization: значение, approval rate и card payment flow',
                'Yetkilendirme nedir: approval rate ve kart ödeme akışı'
            ),
            text(
                'Learn payment authorization with approval rate, issuer decisioning, capture distinction, decline logic, and payment optimization risks.',
                'Разберите payment authorization через approval rate, issuer decisioning, отличие от capture, decline logic и risks payment optimization.',
                'Ödeme yetkilendirmesini approval rate, issuer kararı, capture farkı, ret mantığı ve ödeme optimizasyon riskleriyle öğrenin.'
            )
        ),
    },
    capture: {
        sourceIds: ['stripe-authorization-capture', 'adyen-capture-docs', 'visa-visanet-acceptance'],
        searchIntent: text(
            'Explain capture after authorization, manual vs automatic capture, settlement impact, and why capture is different from authorization.',
            'Объяснить capture после authorization, manual vs automatic capture, влияние на settlement и отличие capture от authorization.',
            'Authorization sonrası capture işlemini, manuel/otomatik capture farkını, settlement etkisini ve authorization’dan farkını açıklamak.'
        ),
        authorityRationale: text(
            'Separates the money-finalization step from issuer approval, which prevents lifecycle errors in payment operations and glossary content.',
            'Отделяет шаг финализации денег от issuer approval, предотвращая lifecycle errors в payment operations и glossary content.',
            'Para kesinleştirme adımını issuer onayından ayırarak ödeme operasyonu ve sözlük içeriğinde yaşam döngüsü hatalarını önler.'
        ),
        content: buildContentBlock(
            text(
                'Capture is the payment step that finalizes a previously authorized transaction and submits it for settlement. Authorization confirms that the payment may proceed; capture tells the payment system to claim the authorized amount within the allowed window.',
                'Capture — это payment step, который финализирует ранее authorized transaction и отправляет её на settlement. Authorization подтверждает, что payment may proceed; capture instructs payment system to claim authorized amount within allowed window.',
                'Capture, daha önce yetkilendirilmiş işlemi kesinleştirip settlement için gönderen ödeme adımıdır. Authorization ödemenin ilerleyebileceğini doğrular; capture ise izin verilen süre içinde yetkilendirilmiş tutarın tahsil edilmesini söyler.'
            ),
            text(
                'Capture matters because delayed fulfillment, hotel deposits, travel bookings, partial shipments, cancellations, and fraud review workflows often need authorization first and capture later.',
                'Capture важен, потому что delayed fulfillment, hotel deposits, travel bookings, partial shipments, cancellations и fraud review workflows часто требуют сначала authorization, а затем capture.',
                'Capture; gecikmeli teslimat, otel depozitoları, seyahat rezervasyonları, kısmi gönderimler, iptaller ve fraud inceleme akışlarında önce authorization sonra capture gerektiği için önemlidir.'
            ),
            text(
                'Operationally, the merchant receives an authorization, decides whether the order should be fulfilled, sends a capture request for the full or partial amount, and the acquiring or processor chain moves the transaction toward clearing and settlement.',
                'Операционно merchant получает authorization, решает, должен ли order be fulfilled, sends capture request for full or partial amount, а acquiring или processor chain ведёт транзакцию к clearing и settlement.',
                'Operasyonel olarak merchant authorization alır, siparişin karşılanıp karşılanmayacağına karar verir, tam veya kısmi tutar için capture isteği gönderir ve acquiring/processor zinciri işlemi clearing ve settlement yönüne taşır.'
            ),
            text(
                'The main pitfall is missing the capture window or capturing the wrong amount. Weak capture logic can cause expired authorizations, duplicate customer friction, reconciliation gaps, and avoidable support disputes.',
                'Главная ошибка — пропустить capture window или capture wrong amount. Слабая capture logic приводит к expired authorizations, duplicate customer friction, reconciliation gaps и avoidable support disputes.',
                'Ana hata capture penceresini kaçırmak veya yanlış tutarı capture etmektir. Zayıf capture mantığı süresi dolmuş authorization, gereksiz müşteri sürtünmesi, mutabakat açıkları ve önlenebilir destek itirazları yaratabilir.'
            ),
            text(
                'In BIST/MOEX/global payment analysis, capture behavior should be mapped to merchant category, fulfillment timing, local acquiring configuration, FX handling, and scheme rules around authorization validity.',
                'В BIST/MOEX/global payment analysis capture behavior нужно связывать с merchant category, fulfillment timing, local acquiring configuration, FX handling и scheme rules around authorization validity.',
                'BIST/MOEX/global ödeme analizinde capture davranışı; merchant kategorisi, fulfillment zamanlaması, yerel acquiring konfigürasyonu, FX işleme ve authorization geçerliliğine ilişkin şema kurallarıyla eşleştirilmelidir.'
            ),
            text(
                'Capture meaning in card payments, authorization, and settlement',
                'Capture: значение в card payments, authorization и settlement',
                'Capture nedir: kart ödemeleri, authorization ve settlement'
            ),
            text(
                'Learn capture with authorization distinction, manual capture, settlement impact, partial capture risk, and payment lifecycle context.',
                'Разберите capture через отличие от authorization, manual capture, settlement impact, partial capture risk и payment lifecycle context.',
                'Capture kavramını authorization farkı, manuel capture, settlement etkisi, kısmi capture riski ve ödeme yaşam döngüsü bağlamıyla öğrenin.'
            )
        ),
    },
    acquirer: {
        sourceIds: ['visa-developer-glossary', 'visa-visanet-acceptance', 'adyen-payment-glossary'],
        searchIntent: text(
            'Explain acquirer meaning, merchant acquiring role, card acceptance flow, acquirer vs issuer distinction, and settlement responsibility.',
            'Объяснить acquirer, merchant acquiring role, card acceptance flow, отличие acquirer от issuer и settlement responsibility.',
            'Acquirer kavramını, merchant acquiring rolünü, kart kabul akışını, acquirer-issuer farkını ve settlement sorumluluğunu açıklamak.'
        ),
        authorityRationale: text(
            'Anchors the term in the card acceptance chain and prevents confusing merchant-side acquiring with issuer-side cardholder banking.',
            'Закрепляет термин в card acceptance chain и предотвращает смешение merchant-side acquiring с issuer-side cardholder banking.',
            'Terimi kart kabul zincirine bağlar ve merchant taraflı acquiring ile issuer taraflı kart hamili bankacılığının karışmasını önler.'
        ),
        content: buildContentBlock(
            text(
                'An acquirer is the financial institution or acquiring partner that enables a merchant to accept card payments and connects merchant transactions into the card network. It sits on the merchant side of the card ecosystem, opposite the issuer that serves the cardholder.',
                'Acquirer — это financial institution или acquiring partner, который позволяет merchant принимать card payments и подключает merchant transactions к card network. Он находится на merchant side карточной экосистемы, напротив issuer, обслуживающего cardholder.',
                'Acquirer, merchant’ın kart ödemesi kabul etmesini sağlayan ve merchant işlemlerini kart ağına bağlayan finansal kurum veya acquiring ortağıdır. Kart ekosisteminde kart sahibine hizmet veren issuer’ın karşısında, merchant tarafında yer alır.'
            ),
            text(
                'Acquirers matter because they influence merchant onboarding, transaction routing, settlement, dispute evidence, chargeback handling, risk monitoring, and the commercial terms of card acceptance.',
                'Acquirers важны, потому что влияют на merchant onboarding, transaction routing, settlement, dispute evidence, chargeback handling, risk monitoring и commercial terms card acceptance.',
                'Acquirer’lar; merchant onboarding, işlem yönlendirme, settlement, itiraz kanıtı, chargeback yönetimi, risk izleme ve kart kabulünün ticari koşullarını etkiler.'
            ),
            text(
                'Operationally, the merchant sends the transaction through its gateway or processor, the acquiring side forwards the request into the network, the issuer responds, and successful transactions later move through clearing and settlement back toward the merchant.',
                'Операционно merchant отправляет transaction через gateway или processor, acquiring side forwards request into network, issuer responds, а successful transactions later move through clearing and settlement back toward merchant.',
                'Operasyonel olarak merchant işlemi gateway veya processor üzerinden gönderir, acquiring tarafı isteği ağa iletir, issuer yanıt verir ve başarılı işlemler daha sonra clearing ve settlement yoluyla merchant’a doğru ilerler.'
            ),
            text(
                'The common pitfall is to treat the acquirer as just another processor. The acquirer relationship usually carries merchant acceptance risk, scheme obligations, settlement responsibilities, and dispute obligations.',
                'Типичная ошибка — считать acquirer просто another processor. Acquirer relationship обычно несёт merchant acceptance risk, scheme obligations, settlement responsibilities и dispute obligations.',
                'Yaygın hata acquirer’ı yalnızca başka bir processor gibi görmektir. Acquirer ilişkisi çoğu zaman merchant kabul riskini, şema yükümlülüklerini, settlement sorumluluklarını ve itiraz yükümlülüklerini taşır.'
            ),
            text(
                'In BIST/MOEX/global analysis, acquiring should be separated from local bank licensing, cross-border acquiring, payment facilitator sponsorship, FX settlement, and the merchant’s regional card mix.',
                'В BIST/MOEX/global analysis acquiring нужно отделять от local bank licensing, cross-border acquiring, payment facilitator sponsorship, FX settlement и regional card mix merchant.',
                'BIST/MOEX/global analizinde acquiring; yerel banka lisansı, sınır ötesi acquiring, payment facilitator sponsorluğu, FX settlement ve merchant’ın bölgesel kart karmasından ayrıştırılmalıdır.'
            ),
            text(
                'Acquirer meaning in card payments and merchant acquiring',
                'Acquirer: значение в card payments и merchant acquiring',
                'Acquirer nedir: kart ödemeleri ve merchant acquiring'
            ),
            text(
                'Learn acquirer meaning with merchant onboarding, authorization routing, settlement, chargeback responsibility, and acquirer vs issuer distinction.',
                'Разберите acquirer через merchant onboarding, authorization routing, settlement, chargeback responsibility и отличие acquirer vs issuer.',
                'Acquirer kavramını merchant onboarding, authorization routing, settlement, chargeback sorumluluğu ve acquirer-issuer farkıyla öğrenin.'
            )
        ),
    },
    issuer: {
        sourceIds: ['visa-developer-glossary', 'visa-visanet-acceptance', 'emv-3ds'],
        searchIntent: text(
            'Explain issuer meaning, cardholder-side bank role, approval and decline decisioning, authentication responsibility, and issuer vs acquirer distinction.',
            'Объяснить issuer, cardholder-side bank role, approval and decline decisioning, authentication responsibility и отличие issuer от acquirer.',
            'Issuer kavramını, kart hamili tarafındaki banka rolünü, onay/ret kararını, kimlik doğrulama sorumluluğunu ve issuer-acquirer farkını açıklamak.'
        ),
        authorityRationale: text(
            'Connects issuer language to cardholder authorization and authentication decisions rather than treating issuer as a generic bank label.',
            'Связывает issuer language с cardholder authorization и authentication decisions, а не как общий bank label.',
            'Issuer dilini genel banka etiketi gibi değil, kart hamili authorization ve authentication kararlarıyla bağlar.'
        ),
        content: buildContentBlock(
            text(
                'An issuer is the bank or institution that provides the card or payment credential to the customer and evaluates whether a transaction should be approved. In card payments, the issuer is on the cardholder side, while the acquirer is on the merchant side.',
                'Issuer — это банк или institution, предоставляющий card или payment credential клиенту и оценивающий, should transaction be approved. В card payments issuer находится на cardholder side, а acquirer — на merchant side.',
                'Issuer, müşteriye kart veya ödeme kimlik bilgisini sağlayan ve işlemin onaylanıp onaylanmayacağını değerlendiren banka ya da kurumdur. Kart ödemelerinde issuer kart hamili tarafındadır, acquirer ise merchant tarafındadır.'
            ),
            text(
                'Issuers matter because they control approval decisions, decline reasons, authentication challenges, card limits, account status, token lifecycle support, and a large part of the checkout conversion outcome.',
                'Issuers важны, потому что контролируют approval decisions, decline reasons, authentication challenges, card limits, account status, token lifecycle support и значительную часть checkout conversion outcome.',
                'Issuer’lar; onay kararlarını, ret nedenlerini, authentication challenge’larını, kart limitlerini, hesap durumunu, token yaşam döngüsü desteğini ve checkout dönüşüm sonucunun büyük kısmını kontrol eder.'
            ),
            text(
                'Operationally, the issuer receives an authorization or authentication request through the card network, checks account and risk signals, returns approval or decline, and may participate in 3DS or dispute processes after the transaction.',
                'Операционно issuer receives authorization или authentication request через card network, checks account and risk signals, returns approval or decline и может участвовать в 3DS или dispute processes after transaction.',
                'Operasyonel olarak issuer kart ağı üzerinden authorization veya authentication isteği alır, hesap ve risk sinyallerini kontrol eder, onay ya da ret döner ve işlem sonrasında 3DS veya itiraz süreçlerine katılabilir.'
            ),
            text(
                'The common pitfall is blaming the merchant gateway for every decline. Issuer risk models, card status, insufficient funds, authentication policy, token support, and regional rules can all determine the response.',
                'Типичная ошибка — blaming merchant gateway for every decline. Issuer risk models, card status, insufficient funds, authentication policy, token support и regional rules могут определять response.',
                'Yaygın hata her reti merchant gateway’e yüklemektir. Issuer risk modelleri, kart durumu, yetersiz bakiye, authentication politikası, token desteği ve bölgesel kurallar yanıtı belirleyebilir.'
            ),
            text(
                'In BIST/MOEX/global contexts, issuer behavior should be analyzed with domestic card rules, cross-border risk appetite, authentication regulation, currency handling, and cardholder protection norms.',
                'В BIST/MOEX/global contexts issuer behavior следует анализировать через domestic card rules, cross-border risk appetite, authentication regulation, currency handling и cardholder protection norms.',
                'BIST/MOEX/global bağlamlarda issuer davranışı; yerel kart kuralları, sınır ötesi risk iştahı, authentication düzenlemesi, para birimi işleme ve kart hamili koruma normlarıyla analiz edilmelidir.'
            ),
            text(
                'Issuer meaning in card payments, approval, and authentication',
                'Issuer: значение в card payments, approval и authentication',
                'Issuer nedir: kart ödemeleri, onay ve authentication'
            ),
            text(
                'Learn issuer meaning with cardholder-side decisioning, authorization approval, decline causes, 3DS role, and issuer vs acquirer distinction.',
                'Разберите issuer через cardholder-side decisioning, authorization approval, decline causes, 3DS role и отличие issuer vs acquirer.',
                'Issuer kavramını kart hamili taraflı karar, authorization onayı, ret nedenleri, 3DS rolü ve issuer-acquirer farkıyla öğrenin.'
            )
        ),
    },
    stablecoin: {
        sourceIds: ['european-commission-mica', 'coinbase-crypto-glossary', 'bis-proof-of-reserves'],
        searchIntent: text(
            'Explain stablecoin meaning, reserve and redemption assumptions, payment use cases, and regulatory risk without implying price safety.',
            'Объяснить stablecoin, reserve и redemption assumptions, payment use cases и regulatory risk без намёка на guaranteed price safety.',
            'Stablecoin kavramını, rezerv ve itfa varsayımlarını, ödeme kullanımını ve düzenleyici riski fiyat güvenliği ima etmeden açıklamak.'
        ),
        authorityRationale: text(
            'Frames stablecoins through backing, redemption, transparency, and regulation, which is necessary for YMYL-sensitive crypto-finance content.',
            'Описывает stablecoins через backing, redemption, transparency и regulation — это необходимо для YMYL-sensitive crypto-finance content.',
            'Stablecoin’leri backing, itfa, şeffaflık ve regülasyon üzerinden ele alır; bu YMYL hassasiyetindeki kripto-finans içeriği için gereklidir.'
        ),
        content: buildContentBlock(
            text(
                'A stablecoin is a crypto asset designed to track a reference value such as a fiat currency, but the mechanism can differ: reserves, collateral, algorithmic incentives, issuer promises, and redemption rules are not interchangeable.',
                'Stablecoin — это crypto asset, designed to track reference value, например fiat currency, но механизм может различаться: reserves, collateral, algorithmic incentives, issuer promises и redemption rules не взаимозаменяемы.',
                'Stablecoin, fiat para gibi bir referans değeri takip etmek üzere tasarlanan kripto varlıktır; ancak mekanizma değişebilir: rezervler, teminat, algoritmik teşvikler, issuer taahhütleri ve itfa kuralları birbirinin yerine geçmez.'
            ),
            text(
                'Stablecoins matter because they sit between payments, crypto custody, reserve transparency, market liquidity, and regulation. A definition that ignores backing and redemption can mislead users about risk.',
                'Stablecoins важны, потому что находятся между payments, crypto custody, reserve transparency, market liquidity и regulation. Определение без backing и redemption может вводить пользователей в заблуждение о risk.',
                'Stablecoin’ler; ödemeler, kripto saklama, rezerv şeffaflığı, piyasa likiditesi ve regülasyon arasında yer aldığı için önemlidir. Backing ve itfa dikkate alınmayan tanım kullanıcıları risk konusunda yanıltabilir.'
            ),
            text(
                'In practice, the issuer or protocol creates tokens, users transfer them on supported rails, and market participants rely on reserve disclosure, redemption mechanics, liquidity, and counterparty controls to judge whether the peg is credible.',
                'На практике issuer или protocol выпускает tokens, пользователи переводят их по supported rails, а market participants оценивают peg через reserve disclosure, redemption mechanics, liquidity и counterparty controls.',
                'Pratikte issuer veya protokol tokenları oluşturur, kullanıcılar desteklenen altyapılarda transfer eder ve piyasa katılımcıları peg güvenilirliğini rezerv açıklaması, itfa mekanikleri, likidite ve karşı taraf kontrolleriyle değerlendirir.'
            ),
            text(
                'The main pitfall is to equate stablecoin with risk-free money. Depeg risk, reserve opacity, redemption limits, custody failure, sanctions exposure, and regulatory changes can all affect usability.',
                'Главная ошибка — приравнивать stablecoin к risk-free money. Depeg risk, reserve opacity, redemption limits, custody failure, sanctions exposure и regulatory changes могут влиять на usability.',
                'Ana hata stablecoin’i risksiz para gibi görmektir. Depeg riski, rezerv opaklığı, itfa sınırları, saklama hatası, yaptırım maruziyeti ve düzenleyici değişiklikler kullanılabilirliği etkileyebilir.'
            ),
            text(
                'For BIST/MOEX/global contexts, stablecoin terminology should distinguish payment settlement, crypto trading collateral, reserve governance, and whether local rules recognize the issuer or the instrument.',
                'В контекстах BIST/MOEX/global термин stablecoin должен различать payment settlement, crypto trading collateral, reserve governance и признание issuer или instrument local rules.',
                'BIST/MOEX/global bağlamlarda stablecoin terminolojisi; ödeme mutabakatı, kripto işlem teminatı, rezerv yönetişimi ve yerel kuralların issuer ya da aracı tanıyıp tanımadığını ayırmalıdır.'
            ),
            text(
                'Stablecoin meaning, reserve risk, and payment context',
                'Stablecoin: значение, reserve risk и payment context',
                'Stablecoin nedir: rezerv riski ve ödeme bağlamı'
            ),
            text(
                'Learn stablecoins with reserve backing, redemption mechanics, payment use cases, regulation, depeg risk, and global crypto-finance context.',
                'Разберите stablecoins через reserve backing, redemption mechanics, payment use cases, regulation, depeg risk и global crypto-finance context.',
                'Stablecoin’leri rezerv backing, itfa mekanikleri, ödeme kullanımı, regülasyon, depeg riski ve global kripto-finans bağlamıyla öğrenin.'
            )
        ),
    },
    'proof-of-reserves': {
        sourceIds: ['bis-proof-of-reserves', 'coinbase-crypto-glossary', 'european-commission-mica'],
        searchIntent: text(
            'Understand proof of reserves, what it can verify, what it cannot verify, and why liabilities, custody, and audit scope matter.',
            'Понять proof of reserves, что он может и не может подтвердить, и почему liabilities, custody и audit scope важны.',
            'Proof of reserves kavramını, neyi doğrulayıp neyi doğrulamadığını ve liabilities, saklama ile audit kapsamının neden önemli olduğunu anlamak.'
        ),
        authorityRationale: text(
            'Positions PoR as partial transparency evidence, not a full solvency guarantee.',
            'Позиционирует PoR как частичное transparency evidence, а не full solvency guarantee.',
            'PoR’u tam ödeme gücü garantisi değil, kısmi şeffaflık kanıtı olarak konumlandırır.'
        ),
        content: buildContentBlock(
            text(
                'Proof of reserves is a verification approach that tries to show whether an exchange, custodian, or issuer controls assets backing customer balances or token claims. It is only meaningful when the asset proof is matched with liabilities, custody controls, and a clear audit scope.',
                'Proof of reserves — это verification approach, показывающий, контролирует ли exchange, custodian или issuer активы, поддерживающие customer balances или token claims. Он meaningful только при сопоставлении asset proof с liabilities, custody controls и clear audit scope.',
                'Proof of reserves, bir borsa, saklayıcı veya issuer’ın müşteri bakiyelerini ya da token taleplerini destekleyen varlıkları kontrol edip etmediğini göstermeye çalışan doğrulama yaklaşımıdır. Ancak varlık kanıtı liabilities, saklama kontrolleri ve açık audit kapsamıyla eşleştiğinde anlamlıdır.'
            ),
            text(
                'PoR matters because reserve transparency affects trust in exchanges, stablecoins, custodians, and tokenized assets, but incomplete PoR can create false confidence.',
                'PoR важен, потому что reserve transparency влияет на доверие к exchanges, stablecoins, custodians и tokenized assets, но incomplete PoR создаёт false confidence.',
                'PoR; borsalara, stablecoin’lere, saklayıcılara ve tokenized assets’e güveni etkilediği için önemlidir; ancak eksik PoR yanlış güven yaratabilir.'
            ),
            text(
                'In practice, the institution identifies wallets or accounts, proves control over assets, publishes or shares a verification method, and ideally reconciles those assets against customer liabilities at a specific point in time.',
                'На практике institution identifies wallets или accounts, доказывает контроль над assets, публикует или shares verification method и в идеале reconciles эти assets с customer liabilities на конкретный момент времени.',
                'Pratikte kurum cüzdanları veya hesapları belirler, varlıklar üzerindeki kontrolü kanıtlar, doğrulama yöntemini paylaşır ve ideal olarak bu varlıkları belirli bir andaki müşteri liabilities ile mutabık hale getirir.'
            ),
            text(
                'The major pitfall is to read proof of reserves as proof of solvency. PoR may miss undisclosed liabilities, borrowed assets, timing manipulation, legal encumbrances, or weak custody governance.',
                'Главная ошибка — читать proof of reserves как proof of solvency. PoR может не учитывать undisclosed liabilities, borrowed assets, timing manipulation, legal encumbrances или weak custody governance.',
                'En büyük hata proof of reserves’i ödeme gücü kanıtı sanmaktır. PoR; açıklanmamış liabilities, ödünç varlıklar, zamanlama manipülasyonu, hukuki kısıtlar veya zayıf saklama yönetişimini kaçırabilir.'
            ),
            text(
                'In BIST/MOEX/global analysis, PoR should be framed as crypto-market transparency vocabulary and separated from statutory audit, bank capital adequacy, and regulated securities custody.',
                'В BIST/MOEX/global analysis PoR нужно описывать как crypto-market transparency vocabulary и отделять от statutory audit, bank capital adequacy и regulated securities custody.',
                'BIST/MOEX/global analizinde PoR, kripto piyasa şeffaflığı terimi olarak ele alınmalı; statutory audit, banka sermaye yeterliliği ve regüle menkul kıymet saklamasından ayrılmalıdır.'
            ),
            text(
                'Proof of Reserves meaning, limits, and reserve transparency',
                'Proof of Reserves: значение, limits и reserve transparency',
                'Rezerv Kanıtı nedir: sınırlar ve rezerv şeffaflığı'
            ),
            text(
                'Learn proof of reserves with asset verification, liabilities, custody limits, stablecoin/exchange context, and false-confidence risks.',
                'Разберите proof of reserves через asset verification, liabilities, custody limits, stablecoin/exchange context и risks of false confidence.',
                'Rezerv kanıtını varlık doğrulama, liabilities, saklama sınırları, stablecoin/borsa bağlamı ve yanlış güven riskleriyle öğrenin.'
            )
        ),
    },
    'seed-phrase': {
        sourceIds: ['coinbase-crypto-glossary', 'google-helpful-content', 'google-title-links'],
        searchIntent: text(
            'Explain seed phrase meaning, wallet recovery, private-key control, custody responsibility, and user-security risk.',
            'Объяснить seed phrase, wallet recovery, private-key control, custody responsibility и user-security risk.',
            'Seed phrase anlamını, cüzdan kurtarmayı, private-key kontrolünü, saklama sorumluluğunu ve kullanıcı güvenliği riskini açıklamak.'
        ),
        authorityRationale: text(
            'Treats seed phrase as a custody and recovery control, not as a login password or exchange account credential.',
            'Рассматривает seed phrase как custody и recovery control, а не как login password или exchange account credential.',
            'Seed phrase’i giriş şifresi veya borsa hesabı bilgisi değil, saklama ve kurtarma kontrolü olarak ele alır.'
        ),
        content: buildContentBlock(
            text(
                'A seed phrase is a human-readable recovery phrase that can restore access to a crypto wallet and the private keys derived from it. Whoever controls the seed phrase can often control the assets, so the term belongs to custody, security, and user-risk education.',
                'Seed phrase — это human-readable recovery phrase, восстанавливающая доступ к crypto wallet и derived private keys. Тот, кто контролирует seed phrase, часто контролирует assets, поэтому термин относится к custody, security и user-risk education.',
                'Seed phrase, bir kripto cüzdana ve ondan türeyen private key’lere erişimi geri getirebilen insan tarafından okunabilir kurtarma ifadesidir. Seed phrase’i kontrol eden taraf çoğu zaman varlıkları da kontrol edebilir; bu yüzden terim saklama, güvenlik ve kullanıcı riski eğitimine aittir.'
            ),
            text(
                'Seed phrases matter because they define the practical boundary between self-custody and account-based access. Losing the phrase can mean losing recovery, while exposing it can mean losing the assets.',
                'Seed phrases важны, потому что определяют практическую границу между self-custody и account-based access. Потеря phrase может означать loss of recovery, а раскрытие — loss of assets.',
                'Seed phrase’ler self-custody ile hesap temelli erişim arasındaki pratik sınırı belirler. İfadeyi kaybetmek kurtarma imkanını, ifşa etmek ise varlıkları kaybetmek anlamına gelebilir.'
            ),
            text(
                'In practice, the wallet generates the phrase during setup, the user stores it offline or in another protected form, and the phrase is used only when restoring the wallet or migrating custody to a new device.',
                'На практике wallet генерирует phrase при setup, пользователь хранит её offline или в другой protected form, а phrase используется только для restoring wallet или migrating custody на новое устройство.',
                'Pratikte cüzdan kurulum sırasında ifadeyi üretir, kullanıcı bunu offline veya başka korumalı biçimde saklar ve ifade yalnızca cüzdanı geri yüklerken ya da saklamayı yeni cihaza taşırken kullanılır.'
            ),
            text(
                'The main pitfall is entering a seed phrase into websites, support chats, screenshots, cloud notes, or wallet prompts that have not been verified. No legitimate support flow should need the phrase to troubleshoot an account.',
                'Главная ошибка — вводить seed phrase на websites, support chats, screenshots, cloud notes или wallet prompts, которые не проверены. Legitimate support flow не должен требовать phrase для troubleshooting account.',
                'Ana hata seed phrase’i doğrulanmamış web sitelerine, destek sohbetlerine, ekran görüntülerine, bulut notlarına veya cüzdan istemlerine girmektir. Meşru destek akışı hesap sorununu çözmek için seed phrase istememelidir.'
            ),
            text(
                'In global fintech education, seed phrase should be separated from bank passwords, exchange credentials, and regulated custody records because the recovery and liability model is materially different.',
                'В global fintech education seed phrase нужно отделять от bank passwords, exchange credentials и regulated custody records, потому что recovery и liability model существенно отличаются.',
                'Global fintek eğitiminde seed phrase; banka şifrelerinden, borsa kimlik bilgilerinden ve regüle saklama kayıtlarından ayrılmalıdır çünkü kurtarma ve sorumluluk modeli ciddi biçimde farklıdır.'
            ),
            text(
                'Seed Phrase meaning, wallet recovery, and custody risk',
                'Seed Phrase: значение, wallet recovery и custody risk',
                'Seed Phrase nedir: cüzdan kurtarma ve saklama riski'
            ),
            text(
                'Learn seed phrase meaning with wallet recovery, private-key control, self-custody risk, phishing warnings, and user-security boundaries.',
                'Разберите seed phrase через wallet recovery, private-key control, self-custody risk, phishing warnings и user-security boundaries.',
                'Seed phrase’i cüzdan kurtarma, private-key kontrolü, self-custody riski, phishing uyarıları ve kullanıcı güvenliği sınırlarıyla öğrenin.'
            )
        ),
    },
    'blind-signing': {
        sourceIds: ['coinbase-crypto-glossary', 'google-helpful-content', 'google-title-links'],
        searchIntent: text(
            'Explain blind signing, unreadable transaction approval, wallet risk, malicious contract exposure, and user education needs.',
            'Объяснить blind signing, approval нечитаемой транзакции, wallet risk, malicious contract exposure и user education needs.',
            'Blind signing, okunamayan işlem onayı, cüzdan riski, kötü amaçlı sözleşme maruziyeti ve kullanıcı eğitimi ihtiyacını açıklamak.'
        ),
        authorityRationale: text(
            'Positions blind signing as a transaction-intent risk, which is more precise than presenting it as a generic wallet mistake.',
            'Позиционирует blind signing как transaction-intent risk, точнее чем общий wallet mistake.',
            'Blind signing’i genel cüzdan hatası yerine işlem niyeti riski olarak konumlandırır.'
        ),
        content: buildContentBlock(
            text(
                'Blind signing happens when a user approves a crypto transaction or smart-contract interaction without being able to review the human-readable meaning of what is being signed. The risk is not only the signature itself; it is the mismatch between user intent and machine-readable transaction payload.',
                'Blind signing происходит, когда пользователь approves crypto transaction или smart-contract interaction без возможности проверить human-readable meaning подписываемого действия. Риск не только в signature, а в mismatch между user intent и machine-readable transaction payload.',
                'Blind signing, kullanıcının neyi imzaladığının insan tarafından okunabilir anlamını göremeden kripto işlemini veya smart contract etkileşimini onaylamasıdır. Risk yalnızca imza değil; kullanıcı niyeti ile makine tarafından okunabilir işlem payload’u arasındaki uyumsuzluktur.'
            ),
            text(
                'Blind signing matters because malicious approvals can transfer assets, grant token permissions, or authorize actions that the user did not understand at the moment of signing.',
                'Blind signing важен, потому что malicious approvals могут transfer assets, grant token permissions или authorize actions, которые пользователь не понял в момент подписи.',
                'Blind signing önemlidir çünkü kötü niyetli onaylar varlık transfer edebilir, token izinleri verebilir veya kullanıcının imza anında anlamadığı işlemleri yetkilendirebilir.'
            ),
            text(
                'In practice, the wallet displays limited or encoded transaction data, the user signs the request, and the blockchain or smart contract executes what the payload specifies rather than what the user assumed.',
                'На практике wallet показывает limited или encoded transaction data, пользователь подписывает request, а blockchain или smart contract исполняет то, что указано в payload, а не то, что предполагал пользователь.',
                'Pratikte cüzdan sınırlı veya kodlanmış işlem verisi gösterir, kullanıcı isteği imzalar ve blockchain ya da smart contract kullanıcının varsaydığını değil payload’da belirtileni yürütür.'
            ),
            text(
                'The main pitfall is trusting brand, UI, or urgency instead of verifying transaction intent. Wallet warnings, decoded previews, allowance limits, and hardware-device confirmation can reduce but not remove the risk.',
                'Главная ошибка — доверять brand, UI или urgency вместо проверки transaction intent. Wallet warnings, decoded previews, allowance limits и hardware-device confirmation могут снизить, но не устранить риск.',
                'Ana hata işlem niyetini doğrulamak yerine marka, arayüz veya aciliyet hissine güvenmektir. Cüzdan uyarıları, çözülmüş önizleme, allowance limitleri ve donanım cihazı onayı riski azaltabilir ama yok etmez.'
            ),
            text(
                'For global fintech/security education, blind signing should be connected to phishing, approval management, self-custody responsibility, and the difference between authentication and authorization.',
                'Для global fintech/security education blind signing нужно связывать с phishing, approval management, self-custody responsibility и различием между authentication и authorization.',
                'Global fintek/güvenlik eğitiminde blind signing; phishing, approval yönetimi, self-custody sorumluluğu ve authentication ile authorization farkıyla ilişkilendirilmelidir.'
            ),
            text(
                'Blind Signing meaning, wallet approval risk, and transaction intent',
                'Blind Signing: значение, wallet approval risk и transaction intent',
                'Blind Signing nedir: cüzdan onay riski ve işlem niyeti'
            ),
            text(
                'Learn blind signing with transaction-intent risk, smart-contract approvals, wallet warnings, phishing exposure, and self-custody controls.',
                'Разберите blind signing через transaction-intent risk, smart-contract approvals, wallet warnings, phishing exposure и self-custody controls.',
                'Blind signing’i işlem niyeti riski, smart contract onayları, cüzdan uyarıları, phishing maruziyeti ve self-custody kontrolleriyle öğrenin.'
            )
        ),
    },
    'iso-20022': {
        sourceIds: ['swift-iso-20022', 'open-banking-uk-standard', 'google-helpful-content'],
        searchIntent: text(
            'Explain ISO 20022 as a financial messaging standard, migration context, richer data model, and payment operations impact.',
            'Объяснить ISO 20022 как financial messaging standard, migration context, richer data model и влияние на payment operations.',
            'ISO 20022’yi finansal mesajlaşma standardı, geçiş bağlamı, zengin veri modeli ve ödeme operasyonu etkisiyle açıklamak.'
        ),
        authorityRationale: text(
            'Connects ISO 20022 to payment-message structure and migration risk instead of treating it as just a bank technology acronym.',
            'Связывает ISO 20022 со структурой payment messages и migration risk, а не как простой bank technology acronym.',
            'ISO 20022’yi yalnızca banka teknoloji kısaltması değil, ödeme mesaj yapısı ve geçiş riskiyle ilişkilendirir.'
        ),
        content: buildContentBlock(
            text(
                'ISO 20022 is a financial messaging standard used to structure payment and cash-management messages with richer, more consistent data. The value is not the acronym itself but the common data model that banks, market infrastructures, and payment providers can map across systems.',
                'ISO 20022 — это financial messaging standard для структурирования payment и cash-management messages с более rich и consistent data. Ценность не в acronyme, а в common data model, который banks, market infrastructures и payment providers сопоставляют между системами.',
                'ISO 20022, ödeme ve nakit yönetimi mesajlarını daha zengin ve tutarlı veriyle yapılandırmak için kullanılan finansal mesajlaşma standardıdır. Değer kısaltmanın kendisinde değil; bankalar, piyasa altyapıları ve ödeme sağlayıcılarının sistemler arasında eşleştirebildiği ortak veri modelindedir.'
            ),
            text(
                'ISO 20022 matters because message quality affects reconciliation, compliance screening, cross-border payments, operational automation, and the ability to carry structured remittance or party data.',
                'ISO 20022 важен, потому что message quality влияет на reconciliation, compliance screening, cross-border payments, operational automation и перенос structured remittance или party data.',
                'ISO 20022; mesaj kalitesi mutabakatı, uyum taramasını, sınır ötesi ödemeleri, operasyonel otomasyonu ve yapılandırılmış remittance ya da taraf verisini taşıma becerisini etkilediği için önemlidir.'
            ),
            text(
                'Operationally, institutions map legacy messages to ISO 20022 schemas, validate required fields, adjust downstream systems, and monitor whether richer data survives through correspondent, clearing, and reporting chains.',
                'Операционно institutions map legacy messages to ISO 20022 schemas, validate required fields, adjust downstream systems и monitor, сохраняется ли richer data в correspondent, clearing и reporting chains.',
                'Operasyonel olarak kurumlar eski mesajları ISO 20022 şemalarına eşler, gerekli alanları doğrular, downstream sistemleri uyarlar ve zengin verinin muhabir, clearing ve raporlama zincirlerinde korunup korunmadığını izler.'
            ),
            text(
                'The pitfall is to treat migration as only a file-format change. Poor field mapping, truncation, weak validation, or partial adoption can preserve old reconciliation and screening problems under a new standard.',
                'Ошибка — считать migration только file-format change. Poor field mapping, truncation, weak validation или partial adoption могут сохранить старые reconciliation и screening problems под новым стандартом.',
                'Hata, geçişi yalnızca dosya formatı değişimi sanmaktır. Zayıf alan eşleme, kırpma, zayıf doğrulama veya kısmi benimseme eski mutabakat ve tarama sorunlarını yeni standart altında sürdürebilir.'
            ),
            text(
                'For BIST/MOEX/global analysis, ISO 20022 should be linked to cross-border payment modernization, local clearing adoption, bank readiness, and how structured data changes reporting and compliance workflows.',
                'Для BIST/MOEX/global analysis ISO 20022 нужно связывать с cross-border payment modernization, local clearing adoption, bank readiness и тем, как structured data меняет reporting и compliance workflows.',
                'BIST/MOEX/global analizinde ISO 20022; sınır ötesi ödeme modernizasyonu, yerel clearing benimsemesi, banka hazırlığı ve yapılandırılmış verinin raporlama/uyum akışlarını nasıl değiştirdiğiyle ilişkilendirilmelidir.'
            ),
            text(
                'ISO 20022 meaning, payment messages, and migration risk',
                'ISO 20022: значение, payment messages и migration risk',
                'ISO 20022 nedir: ödeme mesajları ve geçiş riski'
            ),
            text(
                'Learn ISO 20022 with financial-message structure, richer data, migration risk, reconciliation, compliance, and cross-border payment context.',
                'Разберите ISO 20022 через financial-message structure, richer data, migration risk, reconciliation, compliance и cross-border payment context.',
                'ISO 20022’yi finansal mesaj yapısı, zengin veri, geçiş riski, mutabakat, uyum ve sınır ötesi ödeme bağlamıyla öğrenin.'
            )
        ),
    },
    psd2: {
        sourceIds: ['eba-sca', 'open-banking-uk-standard', 'google-helpful-content'],
        searchIntent: text(
            'Explain PSD2 meaning, open banking role, SCA requirement, account access permissions, and payment initiation context.',
            'Объяснить PSD2, роль в open banking, SCA requirement, account access permissions и payment initiation context.',
            'PSD2’yi; açık bankacılık rolü, SCA gereksinimi, hesap erişim izinleri ve ödeme başlatma bağlamıyla açıklamak.'
        ),
        authorityRationale: text(
            'Frames PSD2 as a regulatory and product architecture boundary for open banking, not merely as a European payments acronym.',
            'Описывает PSD2 как regulatory и product architecture boundary для open banking, а не просто European payments acronym.',
            'PSD2’yi yalnızca Avrupa ödeme kısaltması değil, açık bankacılık için düzenleyici ve ürün mimarisi sınırı olarak çerçeveler.'
        ),
        content: buildContentBlock(
            text(
                'PSD2 is the European payments regulation that shaped open banking access, payment initiation, account information services, and strong customer authentication. In fintech terminology, PSD2 defines role boundaries and security expectations for regulated account-access workflows.',
                'PSD2 — это European payments regulation, сформировавший open banking access, payment initiation, account information services и strong customer authentication. В fintech terminology PSD2 задаёт role boundaries и security expectations для regulated account-access workflows.',
                'PSD2; açık bankacılık erişimini, ödeme başlatmayı, hesap bilgisi hizmetlerini ve güçlü müşteri kimlik doğrulamayı şekillendiren Avrupa ödeme düzenlemesidir. Fintek terminolojisinde PSD2, regüle hesap erişimi akışları için rol sınırlarını ve güvenlik beklentilerini belirler.'
            ),
            text(
                'PSD2 matters because it changed how banks expose account interfaces, how third parties request consented access, how payment initiation is governed, and how authentication risk is handled in digital payments.',
                'PSD2 важна, потому что изменила bank account interfaces, consented access для third parties, governance payment initiation и authentication risk в digital payments.',
                'PSD2; bankaların hesap arayüzlerini nasıl sunduğunu, üçüncü tarafların rızalı erişimi nasıl istediğini, ödeme başlatmanın nasıl yönetildiğini ve dijital ödemelerde authentication riskinin nasıl ele alındığını değiştirdiği için önemlidir.'
            ),
            text(
                'Operationally, PSD2 separates account servicing providers, third party providers, account information services, payment initiation services, customer consent, and authentication duties into a regulated workflow rather than a private screen-scraping arrangement.',
                'Операционно PSD2 разделяет account servicing providers, third party providers, account information services, payment initiation services, customer consent и authentication duties в regulated workflow, а не private screen-scraping arrangement.',
                'Operasyonel olarak PSD2; hesap hizmet sağlayıcılarını, üçüncü taraf sağlayıcıları, hesap bilgisi hizmetlerini, ödeme başlatma hizmetlerini, müşteri rızasını ve authentication yükümlülüklerini özel screen scraping düzeni yerine regüle bir akışa ayırır.'
            ),
            text(
                'The common pitfall is to use PSD2 as a synonym for all open banking. PSD2 is a legal and regional framework; API standards, local implementation, exemption handling, and commercial adoption can differ by market.',
                'Типичная ошибка — использовать PSD2 как синоним всего open banking. PSD2 — legal and regional framework; API standards, local implementation, exemption handling и commercial adoption могут отличаться по рынкам.',
                'Yaygın hata PSD2’yi tüm açık bankacılığın eş anlamlısı olarak kullanmaktır. PSD2 hukuki ve bölgesel bir çerçevedir; API standartları, yerel uygulama, istisna yönetimi ve ticari benimseme pazara göre değişebilir.'
            ),
            text(
                'In BIST/MOEX/global comparisons, PSD2 should be used as an EU benchmark while checking local payment-services law, bank API mandates, SCA-like controls, and whether payment initiation has usable rails.',
                'В BIST/MOEX/global comparisons PSD2 следует использовать как EU benchmark, проверяя local payment-services law, bank API mandates, SCA-like controls и наличие usable rails для payment initiation.',
                'BIST/MOEX/global karşılaştırmalarında PSD2, AB referansı olarak kullanılmalı; yerel ödeme hizmetleri hukuku, banka API zorunlulukları, SCA benzeri kontroller ve ödeme başlatma için kullanılabilir altyapı ayrıca kontrol edilmelidir.'
            ),
            text(
                'PSD2 meaning, open banking roles, and SCA requirements',
                'PSD2: значение, open banking roles и SCA requirements',
                'PSD2 nedir: açık bankacılık rolleri ve SCA gereksinimleri'
            ),
            text(
                'Learn PSD2 through open banking roles, account information, payment initiation, strong customer authentication, consent, and regional implementation limits.',
                'Разберите PSD2 через open banking roles, account information, payment initiation, strong customer authentication, consent и regional implementation limits.',
                'PSD2’yi açık bankacılık rolleri, hesap bilgisi, ödeme başlatma, güçlü müşteri kimlik doğrulama, rıza ve bölgesel uygulama sınırlarıyla öğrenin.'
            )
        ),
    },
    'buy-now-pay-later': {
        sourceIds: ['adyen-payment-glossary', 'stripe-payment-facilitator', 'google-helpful-content'],
        searchIntent: text(
            'Explain BNPL as a checkout-credit model, merchant conversion tool, consumer-credit risk, and regulatory-sensitive payment method.',
            'Объяснить BNPL как checkout-credit model, merchant conversion tool, consumer-credit risk и regulatory-sensitive payment method.',
            'BNPL’yi checkout kredi modeli, merchant dönüşüm aracı, tüketici kredisi riski ve regülasyon hassasiyetindeki ödeme yöntemi olarak açıklamak.'
        ),
        authorityRationale: text(
            'Balances merchant conversion language with consumer-credit and regulatory risk, which is necessary for YMYL payment content.',
            'Балансирует merchant conversion language с consumer-credit и regulatory risk, что необходимо для YMYL payment content.',
            'Merchant dönüşüm dili ile tüketici kredisi ve regülasyon riskini dengeler; bu YMYL ödeme içeriği için gereklidir.'
        ),
        content: buildContentBlock(
            text(
                'Buy Now Pay Later is a checkout financing model that lets a customer receive goods or services now and pay later, often in installments. For merchants it can behave like a payment method; for users and regulators it often behaves like consumer credit.',
                'Buy Now Pay Later — это checkout financing model, позволяющая клиенту получить goods или services сейчас и заплатить позже, часто installments. Для merchants это может выглядеть как payment method; для users и regulators часто как consumer credit.',
                'Buy Now Pay Later, müşterinin ürün veya hizmeti şimdi alıp çoğu zaman taksitlerle sonra ödemesini sağlayan checkout finansman modelidir. İşletmeler için ödeme yöntemi gibi davranabilir; kullanıcılar ve düzenleyiciler için çoğu zaman tüketici kredisi niteliği taşır.'
            ),
            text(
                'BNPL matters because it can increase conversion and average order value while changing underwriting, affordability checks, refunds, disputes, late-fee exposure, and consumer-debt risk.',
                'BNPL важен, потому что может повышать conversion и average order value, одновременно меняя underwriting, affordability checks, refunds, disputes, late-fee exposure и consumer-debt risk.',
                'BNPL; dönüşüm ve ortalama sepet değerini artırabilirken underwriting, ödeme gücü kontrolleri, iadeler, itirazlar, gecikme ücreti maruziyeti ve tüketici borç riskini değiştirdiği için önemlidir.'
            ),
            text(
                'Operationally, the BNPL provider assesses the customer, pays or settles with the merchant under agreed terms, collects installments from the customer, and manages refund or dispute reversals according to the BNPL contract.',
                'Операционно BNPL provider оценивает customer, pays или settles with merchant по согласованным условиям, collects installments от customer и управляет refund или dispute reversals по BNPL contract.',
                'Operasyonel olarak BNPL sağlayıcısı müşteriyi değerlendirir, işletmeyle kararlaştırılan koşullarda ödeme/mutabakat yapar, müşteriden taksitleri tahsil eder ve iade veya itiraz ters kayıtlarını BNPL sözleşmesine göre yönetir.'
            ),
            text(
                'The pitfall is to describe BNPL only as a convenient checkout feature. Affordability, disclosure, missed payments, refund synchronization, merchant fees, and local credit regulation are central to the model.',
                'Ошибка — описывать BNPL только как convenient checkout feature. Affordability, disclosure, missed payments, refund synchronization, merchant fees и local credit regulation являются центральными для модели.',
                'Hata, BNPL’yi yalnızca kullanışlı checkout özelliği olarak anlatmaktır. Ödeme gücü, bilgilendirme, geciken ödemeler, iade senkronizasyonu, merchant ücretleri ve yerel kredi düzenlemesi modelin merkezindedir.'
            ),
            text(
                'In BIST/MOEX/global contexts, BNPL should be mapped to consumer-credit law, payment-institution rules, merchant category, refund obligations, and whether the provider or merchant owns credit risk.',
                'В BIST/MOEX/global контекстах BNPL нужно сопоставлять с consumer-credit law, payment-institution rules, merchant category, refund obligations и тем, кто owns credit risk: provider или merchant.',
                'BIST/MOEX/global bağlamlarda BNPL; tüketici kredisi hukuku, ödeme kuruluşu kuralları, merchant kategorisi, iade yükümlülükleri ve kredi riskini sağlayıcının mı işletmenin mi taşıdığıyla eşleştirilmelidir.'
            ),
            text(
                'Buy Now Pay Later meaning, checkout credit, and consumer risk',
                'Buy Now Pay Later: значение, checkout credit и consumer risk',
                'Buy Now Pay Later nedir: checkout kredisi ve tüketici riski'
            ),
            text(
                'Learn BNPL with checkout financing, merchant conversion, consumer-credit risk, refunds, disputes, and regulatory context.',
                'Разберите BNPL через checkout financing, merchant conversion, consumer-credit risk, refunds, disputes и regulatory context.',
                'BNPL’yi checkout finansmanı, merchant dönüşümü, tüketici kredisi riski, iadeler, itirazlar ve regülasyon bağlamıyla öğrenin.'
            )
        ),
    },
};

export const getEditorialAuthorityOverride = (slug: string): EditorialAuthorityOverride | null => (
    editorialAuthorityOverrides[slug as EditorialAuthorityPilotSlug] ?? null
);

export const hasEditorialAuthorityOverride = (slug: string): boolean => (
    getEditorialAuthorityOverride(slug) !== null
);

export const EDITORIAL_AUTHORITY_LANGUAGES: readonly Language[] = ['en', 'ru', 'tr'];
