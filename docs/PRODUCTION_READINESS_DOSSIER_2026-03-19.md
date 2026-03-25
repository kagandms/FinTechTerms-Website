# FinTechTerms Production Readiness Dossier

> Historical snapshot.
> This dossier records the production-readiness position on 2026-03-19.
> It may reference older command names such as `npm run validate:release-env`.
> For active operator guidance, prefer [`README.md`](/Users/kagansmtdms/Downloads/Проекты/FinTechTerms-Website/README.md)
> and [`docs/OPERATIONS.md`](/Users/kagansmtdms/Downloads/Проекты/FinTechTerms-Website/docs/OPERATIONS.md).

Tarih: 2026-03-19

## 1. Yönetici Özeti

Bu belge, repo içindeki üç ayrı kaynağı tek bir production-readiness görünümünde birleştirir:

- beş fazlı teknik audit
- `docs/RELEASE_EVIDENCE_2026-03-19.md`
- `docs/internal/FINTECHTERMS_ELITE_AUDIT_REPORT.md`

Bugünkü remediation turunda repo tarafında doğrudan kapatılabilen kritik runtime blocker’lar işlendi:

- `/public/sw.js` artık commit edilen ve testlenen bir runtime asset
- `/api/record-quiz` ve `/api/favorites` duplicate retry senaryolarında replay-first davranır
- admin simulation dashboard artık kırık `session_id` varsayımına bağımlı değildir
- guest local term cache sürüm yükseltmesinde uyumlu SRS alanlarını korur
- favorite mutation auth-expiry senaryosu generic failure yerine ayrıştırılmış kullanıcı akışına sahiptir
- legacy `/term/:id` redirect map’i `mockTerms` yerine canonical term corpus’tan türetilir
- shared schema source-of-truth ve release gate dokümantasyonu netleştirildi

Sonuç:

- **Lokal repo kalitesi:** release adayı seviyesinde
- **Staging / production sign-off:** henüz verilemez

Neden henüz verilemez:

- gerçek staging secret/env seti mevcut shell ortamında eksik veya placeholder durumda
- staging DB verify, guest/auth E2E, staging smoke ve Sentry smoke kanıtı bu ortamda tamamlanamıyor

Bu yüzden repo tarafındaki blocker’ların büyük bölümü kapatılmış olsa da, **nihai production-ready kararı** ancak staging evidence zinciri tamamlandığında verilebilir.

## 2. Güncel Durum Kararı

### Repo-side karar

`Go to staging verification`

Kod, migration zinciri, route semantiği ve release dokümantasyonu tarafında kritik açık bırakılmadı. Bundan sonraki temel riskler dış ortam doğrulamasına bağlıdır.

### Production sign-off kararı

`No-Go`

Aşağıdaki dış bağımlı kabul kapıları tamamlanmadan production-ready imzası verilmemeli:

- geçerli `NEXT_PUBLIC_SITE_URL`
- geçerli `NEXT_PUBLIC_SUPABASE_URL`
- geçerli `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- geçerli `SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_BASE_URL`
- `ADMIN_USER_IDS`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`
- `SENTRY_SMOKE_EMAIL`, `SENTRY_SMOKE_PASSWORD`

## 3. Blokaj Matrisi

| Durum | Seviye | Alan | Bulgu | Kanıt | Düzeltme | Kabul kriteri |
|---|---|---|---|---|---|---|
| Kapandı | Kritik | PWA | `/sw.js` runtime’da register ediliyor ama ignore edildiği için temiz deploy’da kaybolabiliyordu | `components/ServiceWorkerRegistrar.tsx`, `.gitignore`, `public/sw.js` | `public/sw.js` commit edilen asset haline getirildi, ignore kaldırıldı, contract testi eklendi | Temiz clone + build sonrası `/sw.js` var ve service worker registration başarısız olmuyor |
| Kapandı | Kritik | Mutation routes | Duplicate retry istekleri rate-limitten önce replay edilmediği için `429` alabiliyordu | `/api/record-quiz`, `/api/favorites` | Durable idempotency inspection rate-limitten önce çalışacak şekilde route sırası değiştirildi | Aynı idempotency key ile duplicate success retry, cached response döndürür |
| Kapandı | Kritik | Admin analytics | Dashboard fatigue analizi `session_id` beklediği için kırılıyordu | `app/(app)/admin/dashboard/page.tsx`, `components/DashboardClient.tsx` | Panel user/day run aggregation modeline taşındı | Mevcut quiz_attempts verisiyle fatigue/distribution panelleri migration fallback göstermeden çalışır |
| Kapandı | Uyarı | Guest state | Term cache version bump, lokal SRS durumunu overwrite ediyordu | `utils/storage.ts` | Selective migration ile uyumlu term-level study state korunur | Versiyon değişse de aynı term ID için SRS alanları korunur |
| Kapandı | Uyarı | Favorites UX | Favorite auth expiry generic failure gibi görünüyordu | `lib/supabaseStorage.ts`, `contexts/SRSContext.tsx`, `components/SmartCard.tsx` | Final `401` ayrı branch olarak ele alınır ve warning akışı döner | Session düşerse kullanıcı auth-expired mesajı görür |
| Kapandı | Uyarı | Legacy redirects | `/term/:id` redirect lookup `mockTerms` üzerinden gidiyordu | `lib/legacy-public-routes.ts` | Redirect map canonical term corpus’tan türetilir | Geçerli eski term ID’leri canonical glossary path’e gider |
| Açık | Kritik | Release evidence | Staging doğrulama zinciri tamamlanamadı | `docs/RELEASE_EVIDENCE_2026-03-19.md` | Gerçek secret/env ile release gate’ler yeniden çalıştırılmalı | `verify:release-db`, guest/auth E2E, smoke ve Sentry smoke yeşil |
| Açık | Yüksek | Release config | Bu shell’de gerçek runtime secret seti yok | `docs/RELEASE_EVIDENCE_2026-03-19.md` | Secret provisioning tamamlanmalı | `validate:release-env` gerçek hedef ortam için tam geçer |
| Kısmen çözüldü | Orta | Legacy SQL hygiene | Tarihsel bot SQL dosyaları yanlışlıkla uygulanırsa regresyon üretebilir | `telegram-bot/migrations/*.sql`, `docs/DATABASE.md`, `docs/SECURITY.md` | Canonical source-of-truth dokümante edildi; deploy tarafında süreç disiplini şart | Shared ortamda sadece `supabase/migrations/` kullanıldığı operasyonel olarak kanıtlanır |

## 4. Sistem Bazlı Durum

### Web app

Durum: **lokal olarak sağlıklı**

- TypeScript, lint ve hedefli regression testler temiz
- route mutation semantiği netleşti
- admin dashboard üretim verisiyle hesaplanabilir hale geldi

Açık dış bağımlı konu:

- staging E2E ve smoke kanıtı eksik

### PWA

Durum: **repo-side blocker kapandı**

- service worker artık versioned runtime asset
- repo düzeyinde `/sw.js` sözleşmesini koruyan test var

Açık dış bağımlı konu:

- build + start + browser smoke ile gerçek deploy doğrulaması

### Auth / session / mutation

Durum: **ana açıklar kapandı**

- duplicate retry davranışı düzeltildi
- favorite auth-expiry ayrıştırıldı

Açık dış bağımlı konu:

- gerçek session token / preview ortamı ile smoke doğrulaması

### Supabase / data contract

Durum: **shared schema sınırları net**

- canonical shared schema `supabase/migrations/`
- docs, tarihsel SQL dosyalarının deploy kaynağı olmadığını açıkça söylüyor

Açık dış bağımlı konu:

- staging DB üzerinde canonical chain ve release readiness tekrar doğrulanmalı

### Admin analytics

Durum: **lokal blocker kapandı**

- fatigue/distribution hesapları artık zorunlu `session_id` bağımlılığı taşımıyor

Açık dış bağımlı konu:

- real staging dataset ile panel smoke

### Telegram bot

Durum: **dokümantasyon ve runtime yüzeyi netleştirildi**

- bot stack dokümantasyonu `edge-tts` ile hizalandı
- tarihsel migration dosyalarının canonical shared schema olmadığı belgelerde açık

Açık konu:

- bot tarafı hâlâ ayrı runtime yüzey olarak staging/ops doğrulaması ister

### Ops / release

Durum: **runbook güçlendirildi**

- canonical migration boundary, service worker asset check ve final sign-off kuralları operasyon belgesine işlendi

Açık konu:

- gerçek staging execution evidence

### Security

Durum: **dokümantasyon current-state ile hizalandı**

- service-role mutation modeli açıkça tanımlandı
- “her authenticated client her şeyi yazar” varsayımı kaldırıldı

## 5. Tarihsel Audit Bulgularının Yeniden Doğrulanması

Aşağıdaki maddeler `docs/internal/FINTECHTERMS_ELITE_AUDIT_REPORT.md` içindeki yüksek etkili tarihsel bulguların current-state sınıflandırmasıdır.

### Hâlâ açık olmayan / kapanmış bulgular

- **Gamification tabloları client tarafından yazılabiliyor**  
  Durum: `kapanmış`  
  Gerekçe: current shared schema zincirinde authenticated direct write izinleri daraltılmış; canonical write path trusted route/RPC üstünden akıyor.

- **Anonymous session RLS pratikte açıktı**  
  Durum: `kapanmış`  
  Gerekçe: current `study_sessions` modeli service-role write path ve authenticated self-read sınırı üzerinden ilerliyor.

- **`/api/record-quiz` body içindeki `user_id` ile spoof edilebilirdi / broken trust modeldi**  
  Durum: `kapanmış`  
  Gerekçe: route current authenticated user’ı server-side çözüyor ve RPC’ye onu geçiriyor.

### Kısmen çözülen veya süreç disiplini gerektiren bulgular

- **Legacy Telegram SQL dosyaları yanlış uygulanırsa sertleşmiş şemayı bozabilir**  
  Durum: `kısmen çözüldü`  
  Gerekçe: canonical source-of-truth artık belgelerde net; ama dosyalar repo içinde tarihsel referans olarak duruyor. Operasyon disiplini hâlâ şart.

### Kapsam değişikliği ile kapanan tarihsel bulgular

- **Bot ve web tek bir hesap-birleştirme/tek-truth learning-state modeli kullanmıyordu**  
  Durum: `kapsam değişikliği ile kapanmış`  
  Gerekçe: phase-5 sonrası Telegram link/account-merge artefact’ları shared schema’dan çıkarıldı. Bugünkü üretim hedefinde bot ayrı runtime yüzey olarak değerlendirilmelidir; eski “shared account merge” iddiası artık release hedefi değildir.

## 6. Test ve Doğrulama Sonuçları

Bugünkü remediation sonrası lokal doğrulanan adımlar:

- `npm test -- --runInBand`
- `npm test -- --runInBand __tests__/api/record-quiz.test.ts __tests__/api/favorites.route.test.ts __tests__/lib/supabaseStorage.test.ts __tests__/utils/storage.test.ts __tests__/contexts/SRSContext.test.tsx __tests__/app/pwa-runtime-contract.test.ts`
- `npx tsc --noEmit`
- `npm run lint`
- `python3 -m pytest telegram-bot/tests/test_bot.py -q`
- `NEXT_PUBLIC_SITE_URL=https://preview.fintechterms.app npm run build`

Bu turda özellikle sabitlenen regression senaryoları:

- record-quiz replay-before-rate-limit
- favorites replay-before-rate-limit
- favorite final `401` auth-expired branch
- guest term-cache version migration state preservation
- committed service worker asset contract

Bu shell ortamında yeniden doğrulanan dış blocker:

- `npm run validate:release-env` şu anda başarısız
  - `STAGING_BASE_URL`
  - `NEXT_PUBLIC_SITE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `ADMIN_USER_IDS`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `E2E_AUTH_EMAIL`
  - `E2E_AUTH_PASSWORD`
  - `SENTRY_SMOKE_EMAIL`
  - `SENTRY_SMOKE_PASSWORD`

## 7. Release Sign-off Sayfası

### Go / No-Go

- **Repo-side Go:** Evet
- **Production Go:** Hayır

### Production Go için zorunlu acceptance gate listesi

1. `npm run validate:release-env`
2. `npm run verify:bootstrap-db`
3. `npm run verify:release-db`
4. `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:guest`
5. `PLAYWRIGHT_BASE_URL="$STAGING_BASE_URL" npm run test:e2e:auth`
6. `STAGING_BASE_URL="$STAGING_BASE_URL" npm run smoke:staging`
7. Admin Sentry smoke event doğrulaması
8. Admin analytics sayfası smoke doğrulaması
9. `/sw.js` deploy sonrası runtime doğrulaması

### Final karar kuralı

Production-ready imzası ancak şu dört koşul birlikte sağlanınca verilir:

- local quality gates yeşil
- canonical migration chain yeşil
- staging evidence zinciri tamam
- kritik backlog sıfır

Bu belge itibarıyla ilk iki koşul repo tarafında sağlandı; son iki koşul staging secrets ve dış ortam doğrulaması bekliyor.
