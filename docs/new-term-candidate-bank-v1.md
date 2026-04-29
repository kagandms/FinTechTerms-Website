# New Term Candidate Bank v1
Generated: 2026-04-23
Status: first sourcing pass
Scope: official-source term candidates not currently present in the repo catalog

## Selection Rule
- Official or primary source only
- Durable concept, not coin/project encyclopedia drift
- Not currently present in repo catalog
- Strong fit for fintech, payments infrastructure, open banking, or financial messaging

## Source Map
- `PAY-1`: [Adyen Payment Methods Glossary](https://www.adyen.com/payment-methods-glossary/)
- `PAY-2`: [Adyen: What’s a payment processor?](https://www.adyen.com/knowledge-hub/payment-processor)
- `PAY-3`: [Adyen: Sales day payout terms](https://www.adyen.com/legal/sales-day-payout/)
- `AUTH-1`: [EMVCo: EMV 3-D Secure whitepaper introduction](https://www.emvco.com/whitepapers/emv-3-d-secure-whitepaper/introduction/)
- `AUTH-2`: [EMVCo: Challenge Flow](https://www.emvco.com/dynamic/emv-3-d-secure-whitepaper-v2/challenge-flow/)
- `AUTH-3`: [EMVCo: Out-of-Band Authentication](https://www.emvco.com/whitepapers/emv-3-d-secure-whitepaper-v2/out-of-band-oob-authentication/business-overview/)
- `AUTH-4`: [EMVCo: Optimising Online Payment Authentication with EMV 3DS](https://www.emvco.com/knowledge-hub/optimising-online-payment-authentication-with-emv-3-d-secure/)
- `AUTH-5`: [EMVCo: Enhancing the EMV 3-D Secure Specifications](https://www.emvco.com/knowledge-hub/enhancing-the-emv-3-d-secure-specifications/)
- `AUTH-6`: [EMVCo: Decoupled Authentication](https://www.emvco.com/dynamic/emv-3-d-secure-whitepaper-v2/challenge-flow/decoupled-authentication/)
- `OB-1`: [PSD2 definitions on EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?qid=1707230959960&uri=CELEX%3A02015L2366-20151223)
- `OB-2`: [Open Banking UK: Confirmation of Funds API Profile](https://openbankinguk.github.io/read-write-api-site2/standards/v3.1.2/profiles/confirmation-of-funds-api-profile)
- `OB-3`: [Open Banking UK: Funds Confirmation Consent](https://openbankinguk.github.io/read-write-api-site3/v3.1.9/resources-and-data-models/cbpii/funds-confirmation-consent.html)
- `OB-4`: [Open Banking UK: Funds Confirmation](https://openbankinguk.github.io/read-write-api-site3/v3.1.6/resources-and-data-models/cbpii/funds-confirmation.html)
- `OB-5`: [Open Banking UK: File Payments API Profile](https://openbankinguk.github.io/read-write-api-site3/v3.1.4/profiles/file-payments-api-profile.html)
- `OB-6`: [RTS: Obligations for a dedicated interface](https://eur-lex.europa.eu/eli/reg_del/2018/389/2023-07-25/eng)
- `SW-1`: [SWIFT: ISO 20022 Adoption - CBPR+](https://www.swift.com/es/node/309021)
- `SW-2`: [SWIFT: Updated ISO 20022 usage guidelines for cross-border payments](https://www.swift.com/news-events/news/updated-iso-20022-usage-guidelines-cross-border-payments-released)

## High Priority Candidates

| Term | Proposed Category | Topic | Sources | Why It Belongs |
|---|---|---|---|---|
| Payment Processor | Fintech | cards-payments | `PAY-2` | Distinct from payment gateway; core merchant infrastructure term. |
| Authorization | Fintech | cards-payments | `PAY-1` | Core card lifecycle term; currently missing from the catalog. |
| Capture | Fintech | cards-payments | `PAY-1` | Core settlement lifecycle term; pairs naturally with authorization. |
| Separate Capture | Fintech | cards-payments | `PAY-1` | Operationally important for delayed fulfillment and risk control. |
| Partial Refund | Fintech | cards-payments | `PAY-1` | Merchant operations term with direct payment workflow value. |
| Multiple Partial Refunds | Fintech | cards-payments | `PAY-1` | Useful for ecommerce and split-return scenarios. |
| Settlement Delay | Fintech | cards-payments | `PAY-1` `PAY-3` | High-value payout and reconciliation term. |
| Settlement Currency | Fintech | cards-payments | `PAY-1` | Important for cross-border acceptance and treasury language. |
| Processing Currency | Fintech | cards-payments | `PAY-1` | Useful for explaining shopper currency versus settlement flows. |
| Sales Day Payout | Fintech | cards-payments | `PAY-1` `PAY-3` | Strong merchant settlement and cash-flow operations term. |
| Local Entity Required | Fintech | cards-payments | `PAY-1` | Important for international payment-method availability. |
| Card-not-present (CNP) | Fintech | cards-payments | `PAY-1` | Core fraud and ecommerce acceptance term. |
| Frictionless Flow | Fintech | fraud-identity-security | `AUTH-1` `AUTH-4` | Important 3DS authentication path with conversion impact. |
| Challenge Flow | Fintech | fraud-identity-security | `AUTH-2` | Important 3DS term for authentication UX and approval tradeoffs. |
| Out-of-Band Authentication | Fintech | fraud-identity-security | `AUTH-3` `AUTH-5` | Strong risk/authentication term, especially for browser-based flows. |
| Decoupled Authentication | Fintech | fraud-identity-security | `AUTH-2` `AUTH-6` | Important fallback/issuer-driven authentication concept. |
| Secure Payment Confirmation (SPC) | Fintech | fraud-identity-security | `AUTH-2` `AUTH-5` | High-signal modern payments auth term. |
| WebAuthn | Fintech | fraud-identity-security | `AUTH-2` | Strong identity/authentication term in payments context. |
| Payment Initiation Service (PIS) | Fintech | open-banking | `OB-1` | Core PSD2/open banking concept. |
| Payment Initiation Service Provider (PISP) | Fintech | open-banking | `OB-1` | Foundational regulated actor in open banking. |
| Account Information Service (AIS) | Fintech | open-banking | `OB-1` | Core PSD2/open banking concept. |
| Account Information Service Provider (AISP) | Fintech | open-banking | `OB-1` | Foundational regulated actor in open banking. |
| Account Servicing Payment Service Provider (ASPSP) | Fintech | open-banking | `OB-1` `OB-6` | Critical infrastructure role term across PSD2 flows. |
| Card-Based Payment Instrument Issuer (CBPII) | Fintech | open-banking | `OB-2` `OB-3` | Useful and still missing in current catalog. |
| Confirmation of Funds (CoF) | Fintech | open-banking | `OB-2` `OB-4` | Important account-to-card funding and availability concept. |
| Funds Confirmation Consent | Fintech | open-banking | `OB-2` `OB-3` | Distinct consent artifact; high-value operational term. |
| File Payments | Fintech | open-banking | `OB-5` | Useful for business banking and bulk-payment rails. |
| Dynamic Linking | Fintech | regtech-compliance | `OB-6` | Important PSD2/SCA control concept. |
| Dedicated Interface | Fintech | regtech-compliance | `OB-6` | Important API-access and compliance architecture term. |
| Explicit Consent | Fintech | regtech-compliance | `OB-2` | Strong consent-governance term in open banking. |

## Medium Priority Candidates

| Term | Proposed Category | Topic | Sources | Why It Belongs |
|---|---|---|---|---|
| CBPR+ | Fintech | open-banking | `SW-1` `SW-2` | Important cross-border ISO 20022 implementation layer. |
| pacs.008 | Fintech | open-banking | `SW-1` `SW-2` | Important ISO 20022 message family for customer credit transfers. |
| pacs.009 | Fintech | open-banking | `SW-1` `SW-2` | Important FI-to-FI transfer message family. |
| pacs.002 | Fintech | open-banking | `SW-1` `SW-2` | Payment status reporting term with clear operational value. |
| pacs.004 | Fintech | open-banking | `SW-1` `SW-2` | Payment return message term. |
| camt.053 | Fintech | open-banking | `SW-1` `SW-2` | End-of-day account reporting term. |
| camt.054 | Fintech | open-banking | `SW-1` `SW-2` | Debit/credit notification term. |
| camt.056 | Fintech | open-banking | `SW-2` | Payment cancellation request term with real operational value. |

## Suggested Add Order
1. Cards & payments lifecycle terms (`Authorization`, `Capture`, `Settlement Delay`, `Settlement Currency`, `Processing Currency`)
2. 3DS / authentication terms (`Frictionless Flow`, `Challenge Flow`, `Out-of-Band Authentication`, `Decoupled Authentication`)
3. Open banking roles and consent terms (`PISP`, `AISP`, `ASPSP`, `CBPII`, `Confirmation of Funds`, `Funds Confirmation Consent`)
4. SWIFT / ISO 20022 message-family terms (`CBPR+`, `pacs.*`, `camt.*`)

## Notes
- Cross-check completed against the current repo catalog on 2026-04-23: these candidates are not currently present.
- The next step should be to convert these into a smaller, editorially ranked import list, not to add all of them blindly.
- Best first implementation batch size: `12-18` terms.
