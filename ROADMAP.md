# RUA Native — Phased Build Roadmap (React Native / iOS)

32 phases · 7 stages · ~105 solo-dev days. Every phase is shippable and has its own verification gate.

## Stack decisions

- App framework — Expo SDK 55+ managed workflow + expo-dev-client + EAS Build/Submit/Update; solo-dev iOS App Store shipping is Expo's sweet spot, config plugins cover every native need (SQLCipher, Vision module, print), and New Architecture is native from day one.
- Language & validation — TypeScript strict everywhere + Zod at every trust boundary (OCR output, LLM output, imported docs), Jest on the pure core, Maestro for E2E; Zod is the enforcement mechanism for 'the LLM only proposes, never writes'.
- Navigation — Expo Router v7 file-based routes; typed routes and automatic deep links come free for the future care-circle invite and respite-mode links.
- Database — expo-sqlite with SQLCipher (256-bit key in Keychain via expo-secure-store) + Drizzle ORM with migrations and useLiveQuery; the only relational stack maintained in lockstep with each Expo SDK, with PHI encrypted at rest by construction.
- State — Drizzle live queries are the only domain-data layer (the DB row is the single truth, never mirrored into a JS store), Zustand + MMKV for non-PHI UI/session state, TanStack Query added later for network state (RxNorm, sync, LLM proxy).
- OCR — still-photo Apple Vision via a ~150-line Swift Expo Module + deterministic TS parser + RxNorm normalization; on-device means zero-retention by construction, free, and best-in-class for printed pharmacy labels.
- Charts — victory-native (Skia rewrite) behind one RuaChart wrapper; GPU-rendered with gestures on the UI thread, its unstyled defaults fit the hairline editorial aesthetic, and Skia/Reanimated are already peer deps of the workflow canvas.
- PDFs — expo-print HTML-to-PDF (WKWebView, fully offline) + expo-sharing, templates living in a shared packages/print; the web MVP's one-pager HTML ports almost verbatim, and generated PHI PDFs live in cache and are deleted after share.
- Notifications — write-time pre-scheduled local notifications: the runway is pure arithmetic so every future alert is knowable now; recompute and reconcile on every med write and foreground, nearest-first within iOS's 64-pending cap; background tasks are opportunistic freshness only, never load-bearing.
- Backend & repo — Supabase (Postgres + RLS keyed to care-circle membership, Sign in with Apple, BAA path) + PowerSync so the phase-1 local SQLite schema becomes the synced schema; pnpm monorepo with a pure-TS packages/core that never imports React Native keeps the safety-critical math testable in milliseconds and portable to server/Android.

## Compliance musts

- Never compute or suggest a dose (Guideline 1.4.2 + the FDA device line): runway math is inventory arithmetic and framed that way in all copy; the assistant's dose refusal is scripted and deterministic, not LLM-improvised; marketing says 'helps you stay organized', never 'prevents medication errors'.
- Nov-2025 Guideline 5.1.2(i) — any cloud AI feature must name the actual provider (Anthropic Claude), obtain explicit opt-in consent BEFORE the first transmission, and the app must work with AI off; keeping scan OCR on-device (Apple Vision) takes the signature feature out of this rule's scope entirely.
- Accounts and in-app account deletion ship in the SAME phase (5.1.1(v) is checked on the first build with a sign-up screen), Sign in with Apple from day one of auth (4.8), and the app never forces registration for non-account features (5.1.1) — local-only stays fully functional forever.
- Privacy manifests + purpose strings — the aggregated PrivacyInfo.xcprivacy is audited (Xcode archive privacy report) at every phase that adds a native module, and specific user-benefit NSCamera/NSPhotoLibrary strings land with the documents vault (phase 13), before any external build; missing manifests reject at upload, not review.
- Privacy nutrition labels honestly declare 'Data Not Collected' through the local-first releases (a marketable trust signal) and flip to Health & Fitness linked-to-identity in the backend/AI phases; never write 'HIPAA compliant' anywhere — a D2C caregiver app is not a covered entity and the FTC treats false compliance claims as deceptive.
- Washington MHMD and California CMIA attach at roughly the first WA/CA tester, not at scale: standalone consumer-health privacy policy linked from the marketing site homepage, caregiver-authority attestation in add-patient (CMIA 56.06 'provider of health care'), per-category consent + access logging built locally from phase 1, and deletion that propagates to backups and processors once a server exists.
- External TestFlight Beta App Review enforces the full guidelines three phases before most teams expect — so phase 19 is an explicit compliance gate: in-context 1.4.1 disclaimers, demo-family seed, bundled sample-label image so a reviewer can exercise the scan flow without a pill bottle, privacy policy URL live, and one page of review notes.
- Side-channel PHI hygiene from day one: ITSAppUsesNonExemptEncryption=false in app.json at phase 1, lock-screen notification previews content-hidden (no PHI in payloads), privacy overlay on backgrounding (app-switcher snapshots), Sentry beforeSend scrubbing, no PHI in URLs/deep links/MMKV — all grepped and checked at the phase-18 hardening gate and every submission.

## Plan rationale

- Merged shape: Draft B's risk-first spikes, compressed, plus Draft A's fast lovable core. Stack research already made the stack decisions, so the data-layer spike collapses into phase 1 as a durability gate (migration harness + SQLCipher key-lifecycle proof are phase-1 exit criteria, not later work), while OCR and the other-person-health-data question keep dedicated spikes. The retention loop (patients -> meds -> deterministic runway -> digest -> refill notifications) reaches internal TestFlight at phase 9, roughly day 20.
- Risk retirement: the four architecture-invalidating risks are retired before their subsystems are built. Label OCR is spiked at phase 3 on a 30-50 real-bottle corpus and its per-field scorecard dictates the phase-22 confirm-UI design; offline data durability is proven inside phase 1 before any feature schema exists; the legal/consent reality of holding another person's health data is spiked at phase 4 and implemented at phases 5 (attestation), 19 (compliance gate), and 31 (respite); the workflow runner is spiked headless at phase 25 — the first phase of its own subsystem, pure TypeScript over the already-proven data layer, before a single workflow screen exists, so its go/no-go cannot invalidate anything already shipped.
- Release positioning: v1.0 submission is phase 20 of 32 (62.5% through), after explicit design-system (2), accessibility (17), error-state/backup (18), and external-beta/compliance-gate (19) phases. Everything after ships as staged App Store updates: scan v1.1 (23), appointments + transport v1.2 (24), workflow library v1.3 (28), connected care v2.0 (32). Internal TestFlight at phase 9; external TestFlight at phase 19 is treated as the real compliance deadline.
- Local-first is permanent, not a phase: SQLCipher-encrypted SQLite is the only store until phase 29, accounts are opt-in additions for sync/sharing (never required to use the app, satisfying the 5.1.1 no-login-wall rule), and phase 1's change_log + UUIDv7 + UTC-with-tz groundwork makes the phase-30 PowerSync migration mechanical instead of a rewrite.
- Workflow engine decomposed value-before-visual: frozen declarative schema + headless resumable runner (25) -> stepper run UI proving the simplest real workflow, HIPAA records release (26) -> Skia canvas viewer + claim denial appeal (27) -> remaining four workflows as template configuration + library + versioning (28). Workflows are data interpreted by shipped node types (guideline 2.5.2-safe). v1 templates are fully deterministic; the LLM-draft node type exists in the schema (hard-gated: any path to document-render must pass a human-confirm node) but activates only after the phase-29/32 proxy exists — so no LLM feature anywhere precedes the server proxy.
- Draft B's notification and PDF spikes are folded into their feature phases as hard verification gates rather than standalone phases (phase 8's multi-day force-killed delivery soak; phase 14's printed-physical-page fidelity check) because neither risk shapes the architecture the way OCR, data durability, and consent do — write-time local-notification scheduling and expo-print were already de-risked calls from stack research.
- Effort: ~105 solo-dev days (~5 months full-time). No phase exceeds ~4 days, every phase ends installable on a device or with a written go/no-go decision, and the hospital-basement airplane-mode checklist becomes a permanent release gate from phase 18 onward.

---

## Stage 1 — Foundation & Risk Retirement

*Stand up the encrypted local-first skeleton and the Ivory Editorial design system, and retire the architecture-shaping unknowns — on-device data durability, label OCR feasibility, and the legal reality of holding another person's health data — before any feature depends on them.*

### Phase 1: Monorepo scaffold, encrypted data layer & durability gate  (4 days)

**Delivers:** A running Expo iOS dev-client app on a pnpm monorepo with an encrypted, migration-safe SQLite data layer proven durable on device before any feature schema exists.

- pnpm workspace monorepo — apps/mobile (Expo SDK 55+, TypeScript strict, expo-router) plus packages/core, packages/schema, packages/print; ESLint/Prettier; GitHub Actions CI (typecheck + unit tests); EAS dev-client/preview/production profiles
- expo-sqlite with SQLCipher (256-bit key generated on first launch, stored in Keychain via expo-secure-store) + Drizzle ORM with migration runner; UUIDv7 IDs, UTC timestamps with separate tz fields, change_log and access_log tables from day one
- Durability gate: migration test harness in CI, on-device v1-to-v2 migration with pre-migration DB file copy and rollback, explicit boot handling for key-without-DB and DB-without-key states
- Compliance plumbing: ITSAppUsesNonExemptEncryption=false in app.json, iOS Data Protection (CompleteUntilFirstUserAuthentication), demo-family seed fixtures that double as dev data and future App Review demo

**Verify:** Seeded data survives force-quit, a v1-to-v2 upgrade build, and a deliberately failed migration (auto-rollback restores the copy); the DB file is unreadable without the Keychain key; both key/DB mismatch states show a recovery path instead of crash-looping; CI green.

### Phase 2: Ivory Editorial design system  (3 days)
*Depends on: P1*

**Delivers:** The reusable token and component kit every later screen is built from, matching the validated web MVP design language.

- Tokens: pure-white surfaces, ink text, semantic status-dot colors, spacing, 0.5px hairline rules, radii; editorial type scale with bundled fonts via expo-font
- Core components: Screen, SectionHeader, ListRow, Card, black PillButton, StatusDot, EmptyState, FormField, and a DisclaimerFootnote component for health-adjacent screens
- Lucide line icons wired; lint rule banning emoji in UI strings
- Dev-only gallery screen rendering every component in every state as the living style reference

**Verify:** Gallery screen compared side by side against the web MVP reference; component snapshot tests pass; the disclaimer component exists before any meds screen does.

### Phase 3: SPIKE: label OCR on a real-bottle corpus  (3 days)
*Depends on: P1*

**Delivers:** A written go/no-go decision with a per-field accuracy scorecard proving the scan-a-label flow is feasible and dictating the confirm-UI design.

- Collect 30-50 photos of real Rx bottles/labels across pharmacies (CVS, Walgreens, mail-order) covering curvature, glare, and small type
- ~150-line Swift Expo Module running Apple Vision VNRecognizeTextRequest (accurate mode, language correction off for drug names), image in, text lines + boxes out, nothing persisted
- Deterministic TS parser heuristics for drug name, strength, sig, fill date, quantity, day supply, refills, pharmacy phone — per-field accuracy measured against the corpus; RxNorm approximateTerm API probed for name normalization
- DECISION OUTPUT: per-field scorecard + which fields need low-confidence flagging in the future confirm UI

**Verify:** Scorecard document exists; go decision requires drug name + fill date + day supply extract well enough that field-by-field confirmation is a correction flow, not manual re-entry; filesystem inspection confirms zero retention.

### Phase 4: SPIKE: consent & compliance framework for other-person health data  (2 days)

**Delivers:** A decision document defining RUA's legal posture and the consent framework that phases 5, 19, and 31 implement.

- Document the posture: not a HIPAA covered entity (and never claim compliance), FTC Health Breach Notification Rule applies, WA MHMD applies at the first WA tester, CA CMIA 56.06 makes RUA a 'provider of health care'
- Design the consent framework: caregiver-authority attestation copy for add-patient, per-category consent scopes, access-log schema, respite-mode time-boxing rules
- Draft the medical disclaimer set and a one-page intended-use statement (organizational tool; no dosing, diagnosis, or triage) that every future feature and all store metadata is checked against
- Draft the standalone consumer-health privacy policy and a written incident-response plan (60-day clock)

**Verify:** Framework doc answers every Guideline 5.1.3 checklist item; attestation, disclaimer, and policy copy are final enough to implement verbatim in phases 5 and 19.

---

## Stage 2 — The Lovable Core

*Ship the smallest thing a caregiver would miss if deleted — a multi-elder care circle with medications, deterministic refill runways, the Today's Digest, and reliable refill alerts — fully local, on real iPhones via internal TestFlight by phase 9.*

### Phase 5: Care circle & medication records  (4 days)
*Depends on: P1, P2, P4*

**Delivers:** Caregivers manage multiple elders with complete medication lists — exactly the data the runway engine needs.

- Patient CRUD: name, photo, DOB, relationship, conditions, allergies, emergency contacts — with the phase-4 caregiver-authority attestation captured in the add-patient flow
- Care-circle home screen listing all patients with per-patient status dots (placeholder status)
- Medication CRUD: name, strength, form, sig/schedule, prescriber, pharmacy, notes, active/archived — plus fill tracking (last fill date, day supply, refills remaining)
- Bundled high-alert reference list (insulin, anticoagulants, opioids) with visible badges
- All med changes append to the local change/audit log for the future timeline and sync

**Verify:** Three patients with realistic 8-med regimens round-trip every field, survive force-quit and a schema-upgrade build; high-alert meds visibly badged; attestation recorded per patient.

### Phase 6: Deterministic medication runway engine  (2 days)
*Depends on: P5*

**Delivers:** A fully tested pure-TypeScript library computing refill runways — the product's deterministic heart, with zero React imports.

- daysRemaining / runOutDate from fill date + day supply + doses per day, in packages/core
- Status thresholds in code: ok, soon (<=10d), urgent (<=3d), overdue
- Med-sync calculator: suggested alignment date and short-fill quantities across a regimen
- Exhaustive golden tests: DST boundaries, cross-timezone caregiver/elder, leap day, PRN meds, zero supply, future fill dates

**Verify:** Golden suite 100% green; a fixture table of meds matches hand-computed run-out dates exactly; no LLM or network anywhere in the code path.

### Phase 7: Today's Digest & home dashboard  (3 days)
*Depends on: P6*

**Delivers:** Opening the app answers 'what is the one thing to do today?' across all patients, driven entirely by the engine.

- Deterministic digest selector: ranks refill urgency, upcoming items, and data staleness across every patient into one action + quiet context lines ('Everyone else is covered through Friday')
- Home dashboard layout: digest card, care-circle strip, real status-dot rollups, runway chips on med rows
- Recompute on app foreground and at day boundary
- Empty, single-patient, and many-patient states; selector unit tests with fixture households

**Verify:** Fixture households produce the pinned expected top action; advancing the device date changes it correctly; selector tests pin the ranking order.

### Phase 8: Refill notifications (write-time scheduling)  (3 days)
*Depends on: P7*

**Delivers:** The core loop works without opening the app — alerts pre-scheduled deterministically, immune to iOS background-execution pathologies.

- Local notifications pre-scheduled from runway output at soon/urgent thresholds; reconcile-diff scheduler runs on every med write and app foreground, nearest-first within the iOS 64-pending cap
- Settings: lead time, quiet hours, per-patient toggles
- Deep link from an alert to the med's detail screen
- Lock-screen previews content-hidden by default — payloads say 'A medication needs attention', never PHI
- expo-background-task as opportunistic top-up only, never load-bearing

**Verify:** 3-day soak on two devices with the app force-killed: every due alert arrives; changing a fill date reschedules its alert; seeding >64 pending alerts prioritizes nearest and tops up on open (this soak retires Draft B's notification spike).

### Phase 9: Internal TestFlight #1  (2 days)
*Depends on: P8*

**Delivers:** The lovable core installed on real caregivers' iPhones with crash reporting and a feedback channel.

- App Store Connect record, bundle ID, new age-rating questionnaire answered honestly (medical/wellness topics), app icon + launch screen in the design language
- EAS Build + Submit pipeline to a 3-5 person internal TestFlight group of real caregivers
- First-run onboarding: create first patient -> first med, guided empty states
- Sentry with beforeSend PII scrubber and no default PII capture
- Privacy-manifest aggregation audit via the Xcode archive privacy report

**Verify:** 3+ internal testers install from TestFlight and enter their own patients/meds unassisted; a deliberate test crash appears symbolicated in Sentry with no PHI in the event; archive privacy report is clean.

---

## Stage 3 — Patient 360 & the Paper Layer

*Deepen each elder into a full 360 record and make it travel on paper — one-pagers, ER sheets, the everyone portfolio, nutrition table, and offline emergency guides — all still working with zero network.*

### Phase 10: Patient 360: overview  (3 days)
*Depends on: P5*

**Delivers:** The per-patient record shell with the always-visible allergy banner, vitals, and care team.

- Tabbed Patient 360 layout: Overview, Activity, Meds, History, Records, Documents (stubs where not yet built)
- Persistent high-contrast allergy banner visible across all tabs
- Manual vitals entry (BP, weight, glucose, O2, temperature) with latest-value cards
- Care team contacts (prescriber, pharmacy, PCP) with one-tap call actions

**Verify:** Allergies and vitals persist across relaunch; the banner shows on every tab; call actions dial correctly.

### Phase 11: Activity charts & observations  (3 days)
*Depends on: P10*

**Delivers:** Vitals trends over selectable time ranges plus a caregiver observation log.

- One RuaChart wrapper over victory-native (Skia) styled to the hairline editorial spec, reused for every chart in the app
- Per-vital time series with 7d/30d/90d/1y range switching
- Observation entries: mood, appetite, sleep, incidents, free notes with timestamps
- Sparse-data and empty chart states

**Verify:** Ten backdated readings render the correct points at each time range; observations list chronologically; charts render offline.

### Phase 12: History timeline & records  (3 days)
*Depends on: P5, P10*

**Delivers:** A unified medical history and structured labs/records per patient, with med changes auto-logged.

- Timeline of diagnoses, hospitalizations, procedures — plus medication changes auto-appended from the phase-5 change log
- Records/labs entries: value, unit, reference range, abnormal flag
- Category filters on the timeline
- Editing a med writes a timeline entry automatically

**Verify:** Mixed events order and filter correctly; a med edit produces a timeline entry; everything survives relaunch.

### Phase 13: Documents vault  (3 days)
*Depends on: P10*

**Delivers:** Insurance cards, POLST forms, and discharge papers stored securely on device — and the app's camera permission moment, handled compliantly.

- Capture/import from camera, Files, and photo library — adding specific user-benefit NSCameraUsageDescription and NSPhotoLibraryUsageDescription strings (written to cover documents and future label scanning)
- iOS Data Protection file storage; category tags, rename, delete, share-sheet export
- Optional Face ID app lock via expo-local-authentication (SecureStore-backed setting)
- Documents linked to patients and browsable from Patient 360

**Verify:** A PDF and a photo added, Face ID lock enabled, relaunch, unlock, view and share both; files are unreadable outside the app sandbox; purpose strings pass a lint check for specificity.

### Phase 14: Print engine & patient one-pager  (3 days)
*Depends on: P5, P10*

**Delivers:** A polished printable one-page summary for any patient, built on the reusable PDF pipeline all later documents share.

- packages/print HTML-to-PDF pipeline via expo-print: inline base64 assets, embedded fonts, US Letter margins, page-break rules, editorial print stylesheet
- One-pager template: demographics, allergy banner, meds table with runway, vitals, contacts
- AirPrint and share-sheet output; PHI PDFs written to cache and deleted after share
- Snapshot tests of generated HTML against fixtures

**Verify:** A printed physical page is visually faithful to the design mock — crisp hairlines, correct typography, no clipping — and matches the record field-for-field (this doubles as the PDF-fidelity gate for every later document, retiring Draft B's PDF spike).

### Phase 15: ER sheet, everyone portfolio & nutrition table  (3 days)
*Depends on: P14*

**Delivers:** The emergency paper layer: per-patient ER sheet, the whole-circle portfolio, and the deterministic daily nutrition needs table.

- ER sheet with critical facts above the fold: allergies, meds, conditions, DNR/POLST flag, contacts — reachable in <=2 taps from home with a pre-rendered snapshot path so it opens instantly
- Everyone portfolio: all patients bundled into one printable pack (the longest document — pagination stress test)
- Daily nutrition needs table computed deterministically from age/sex/weight rules in packages/core, with unit tests
- Print and share from each patient and from home

**Verify:** In airplane mode, the ER sheet and portfolio open instantly and print-preview correctly; nutrition values match rule fixtures; the multi-page portfolio paginates cleanly.

### Phase 16: Illustrated emergency guides  (2 days)
*Depends on: P2, P14*

**Delivers:** A bundled, offline, printable library of static clinician-reviewable emergency guides.

- Static guide set bundled in the binary: falls, choking, stroke (FAST), chest pain, bleeding, sudden confusion — structured content + line illustrations, zero-network by construction
- Guide reader in the design language
- Per-guide review metadata (version, clinician reviewer, date) rendered on each guide, with the review workflow documented
- Printable via the phase-14 pipeline

**Verify:** Every guide opens and prints in airplane mode; review metadata displays; adding a guide requires only a content-bundle change (no remote code, guideline 2.5.2-safe).

---

## Stage 4 — Hardening & App Store 1.0

*Make the offline core accessible, resilient, and provably compliant, run a real-caregiver external beta as the compliance dress rehearsal, and put RUA 1.0 on the App Store at phase 20 of 32 (62.5% through the plan).*

### Phase 17: Accessibility pass  (3 days)
*Depends on: P15, P16*

**Delivers:** The entire 1.0 surface usable with VoiceOver and accessibility-size Dynamic Type.

- VoiceOver labels, traits, and focus order on every screen
- Dynamic Type through accessibility sizes with all clipping and breakage fixed
- 44pt hit targets, contrast audit, reduce-motion support
- Recorded accessibility checklist with all critical issues resolved

**Verify:** Add-med, read-digest, and open-ER-sheet flows completed using VoiceOver only; XL-type screenshots reviewed for every screen.

### Phase 18: Error states, encrypted backup & offline hardening  (3 days)
*Depends on: P17*

**Delivers:** A trustworthy app: no dead ends, data exportable without a server, fast on older phones, and the hospital-basement test codified as a permanent release gate.

- Systematic empty/loading/error state sweep with consistent editorial copy
- Encrypted local backup export/import so pre-backend users can change devices safely (also the SQLCipher key-loss escape hatch)
- Privacy overlay on backgrounding (app-switcher snapshots) plus a CI grep for PHI in logs, URLs, and deep links
- Cold-start and long-list profiling on an older iPhone; fix regressions
- 'Hospital basement' airplane-mode checklist scripted as a release gate run before every future release

**Verify:** Backup exported on device A imports identically on a fresh install; a full caregiver tour in airplane mode (digest, meds, ER sheet, guides) hits zero broken states; killing the app mid-write relaunches cleanly; checklist committed to the repo.

### Phase 19: Compliance gate & external beta  (4 days)
*Depends on: P4, P18*

**Delivers:** The phase-4 framework made real and audited, then hardened by 8-15 real family caregivers through external TestFlight — the true compliance deadline.

- Disclaimers surfaced in context (onboarding, runway, guides) via the design-system component; local access log surfaced in settings; full local data wipe ('delete everything')
- Privacy nutrition labels honestly declaring 'Data Not Collected'; standalone consumer-health privacy policy live at a public URL (MHMD requirement)
- App Review notes drafted: what RUA is, organization-not-medical-advice posture, demo-family seed instructions
- External TestFlight group of 8-15 real caregivers through Beta App Review, with structured feedback capture
- Bug bash and triage: fix release blockers, backlog the rest; Guideline 5.1.3 self-audit against the phase-4 checklist

**Verify:** Beta App Review passes; 5+ external caregivers complete onboarding (first patient -> first med -> digest) unassisted; data wipe leaves no recoverable records under filesystem inspection; every 5.1.3 checklist item has an implemented answer.

### Phase 20: v1.0 App Store submission  (3 days)
*Depends on: P19*

**Delivers:** RUA live on the App Store; everything after this ships as staged updates.

- Listing led by the multi-elder care-circle differentiation (June 2026 guideline 4.3 crackdown) with medical-claim-free copy checked against the intended-use statement
- Screenshots in the design language, keywords, final age rating
- Full physical-device regression plus the hospital-basement gate
- EAS production build + submit, phased release enabled, 48-hour Sentry release-health watch; respond to App Review feedback within the phase

**Verify:** App approved and downloadable from the public App Store; a fresh download completes the core flows on a clean device; crash-free rate above 99.5% during phased rollout.

---

## Stage 5 — Scan & Get Out the Door (v1.1–v1.2)

*Kill manual data entry with the zero-retention scan-to-med flow behind field-by-field confirmation and safety gates, then handle appointment day end to end — prep, booking, transport comparison, and post-visit capture — shipped as App Store updates.*

### Phase 21: Scan-a-label: capture & zero-retention OCR  (3 days)
*Depends on: P3, P5, P13*

**Delivers:** The spike module productized: a camera flow turning a bottle label into structured candidate fields with confidence scores, retaining nothing.

- Camera capture UX with label-framing guide and multi-shot support for curved labels, per the phase-3 decisions
- Apple Vision recognition strictly in memory: image discarded after parse, nothing written to disk, logs, or network
- Deterministic parser productized with per-field confidence thresholds from the spike scorecard
- Dev-only raw-text inspection view for ongoing parser tuning; camera purpose strings revalidated to cover scanning

**Verify:** Ten corpus bottles meet or beat the spike scorecard per field; filesystem inspection confirms no image artifacts persist after the flow.

### Phase 22: Field-by-field confirmation, RxNorm & safety gates  (4 days)
*Depends on: P21*

**Delivers:** The human-confirmation screen where every scanned field is verified before anything is saved, with hard gates on the dangerous paths.

- Confirm screen: every field individually editable, low-confidence fields visually flagged
- RxNorm normalization: bundled offline subset of common generics plus the free NLM API online, pick-from-candidates UI, unmatched names saved as free text with a visible badge
- Patient-match gate: explicit 'this is for [Patient]' confirmation, warning on label-name mismatch
- High-alert gate keyed on RxNorm ingredient class (not string match) with an extra deliberate confirmation step
- Reject/retake flow when a scan is unusable

**Verify:** A misread drug name is correctable in two taps; saving without patient confirmation is impossible; high-alert meds demand the extra step every time; airplane mode still matches from the bundled subset.

### Phase 23: Scan-to-med integration & v1.1 release  (3 days)
*Depends on: P6, P22*

**Delivers:** A confirmed scan creates a real medication feeding the runway engine — shipped as v1.1 with the flow reviewable by Apple.

- Confirmed scan writes a Medication; runway, digest, and notifications update immediately
- Duplicate detection: a refill of an existing med updates the fill date instead of duplicating; a new med creates cleanly
- Local privacy-safe correction telemetry (which fields users fix most) to grow the parser corpus
- Re-benchmark the full pipeline against the phase-3 scorecard and record the delta
- v1.1 submission with a bundled 'try a sample label' image so App Review can exercise scan-confirm-create without a pill bottle

**Verify:** Scanning a refill updates the fill date without duplicating; five never-before-seen bottles go bottle-to-runway end to end; v1.1 approved with scan exercised via the sample label.

### Phase 24: Appointment kit & get-there transport (v1.2)  (4 days)
*Depends on: P7, P11, P12, P14*

**Delivers:** Appointment day handled end to end: deterministic prep sheet, booking script, transport comparison, escalation, and post-visit capture.

- Patient-first appointment list feeding the Today's Digest (appointment surfaces the day before)
- Prep sheet deterministically assembled from last-30-day observations, vitals changes, and open questions — printable via the phase-14 pipeline
- Booking script view with the patient's insurance/provider details ready to read aloud
- Post-visit capture writing follow-ups and med changes to the timeline and med list
- Transport comparison as deterministic cards: drive/transit/rideshare via deep links (Apple Maps, Uber/Lyft universal links) plus paratransit and NEMT info cards with booking phones — embedded map deferred as garnish; no PII ever in URLs
- Emergency escalation: care-circle contacts ranked by saved addresses with one-tap call, no location permission needed in v1

**Verify:** Appointment appears in the digest the day before; prep sheet includes recent observations; a post-visit med change updates the runway; every deep link opens the right app; URL audit shows zero PII; v1.2 approved and live.

---

## Stage 6 — Admin Workflow Engine (v1.3)

*Build the n8n-style paperwork automation system in safe layers — declarative schema and headless runner first, run experience second, canvas visual third — and ship all six prebuilt caregiver workflows as v1.3.*

### Phase 25: SPIKE: workflow schema & headless runner  (4 days)
*Depends on: P1*

**Delivers:** A frozen declarative workflow schema and a tested, resumable DAG runner — the engine proven before any workflow UI exists.

- Declarative JSON schema: workflows as data (nodes, edges, input bindings, document templates) interpreted by shipped node types — never downloadable code (guideline 2.5.2-safe); node types: input/upload, patient-record pull, form-fill, deterministic transform, human-confirm gate, document-render
- Schema validation with generated TypeScript types; definitions and runs persisted to SQLite
- Deterministic topological runner: per-node status, pause/resume surviving app restarts
- LLM-draft node type defined but hard-gated: schema validation rejects any path to document-render that skips a human-confirm node; v1 templates use zero LLM nodes (drafting activates only after the phase-29 proxy)
- Claim-denial-appeal workflow authored as the proving fixture
- DECISION OUTPUT: runner architecture + schema frozen for the library

**Verify:** The fixture runs headless to a finished document model; force-killing mid-run resumes at the paused node with state intact; schema validation rejects an LLM-to-render path without a confirm gate.

### Phase 26: Workflow run UI & first workflow: HIPAA records release  (4 days)
*Depends on: P13, P14, P22, P25*

**Delivers:** The mobile run experience proven on the simplest real workflow, producing a signature-ready document — workflow VALUE ships before the workflow VISUAL.

- Node-by-node stepper run UI with per-node status and a compact progress strip
- Input nodes wired to documents-vault uploads, patient-record field pulls, and form entry
- Human-confirm screens reusing the phase-22 field-confirmation patterns
- HIPAA records-release workflow end to end: provider details in, patient data auto-filled, signature-ready release PDF out via the print engine, saved back into the vault

**Verify:** A tester with no instructions completes a records release for a seeded patient and gets a correct printable PDF; abandoning mid-run and resuming works.

### Phase 27: Workflow canvas viewer & claim denial appeal  (4 days)
*Depends on: P26*

**Delivers:** The n8n-style visual — a pannable Skia node/edge canvas showing live run progress — plus the highest-value paperwork automation.

- Read-mostly canvas on @shopify/react-native-skia: rounded-rect nodes, bezier edges, tiny status dots; gesture-handler + Reanimated pan/zoom with point-in-rect hit-testing; layout precomputed per template
- Per-node status animation driven by run state; tapping a node opens its inputs/outputs inspector; 'run next node' control on the canvas
- Claim denial appeal workflow: upload denial letter + EOB, human-confirmed key facts, deterministic template assembly grounded in the patient record, review, render
- Shared nodes template-ized so remaining workflows become configuration, not code

**Verify:** Canvas matches the definition and updates live while stepping on device; a fixture denial letter produces a complete appeal letter where every factual field traces to a source record or upload; pan/zoom stays smooth.

### Phase 28: Workflow library completion & v1.3 release  (4 days)
*Depends on: P27*

**Delivers:** The full six-workflow library live on the App Store as v1.3.

- Prior authorization, Medicaid renewal, and discharge-to-home workflows built as template configurations on the shared nodes
- New-patient intake workflow whose confirmed outputs write INTO the patient record (meds, conditions, contacts) so runway and digest work immediately
- Library screen: browse with plain-language descriptions of what each automation produces, start a run, review past runs per patient
- Definition versioning so template edits never break in-flight runs
- v1.3 release: updated screenshots, privacy labels re-checked for uploaded-document handling, hospital-basement checklist re-run

**Verify:** All six workflows run to finished documents on device; intake populates a new patient whose digest immediately works; workflows degrade gracefully offline; v1.3 approved and live.

---

## Stage 7 — Connected Care (v2.0)

*Introduce the server only now that the local product is public and useful: opt-in accounts with same-phase deletion, PowerSync multi-device sync, time-boxed least-privilege sharing, and the citations-only grounded assistant behind a server proxy.*

### Phase 29: Backend foundation, accounts & in-app deletion  (4 days)
*Depends on: P20*

**Delivers:** Optional accounts on Supabase without degrading the local-first experience — with account deletion shipping in the same phase Apple starts checking for it.

- Supabase project: Postgres with row-level security keyed to care-circle membership, separate staging and production, encryption at rest, no PHI in server logs or URLs
- Sign in with Apple + email OTP; accounts strictly opt-in — the signed-out app remains fully functional forever (no login wall)
- In-app account deletion with verified server-side purge, shipping in this same phase (Guideline 5.1.1(v))
- pgaudit plus the synced app-level access_log; privacy nutrition labels flip to Health & Fitness linked-to-identity and the policy is updated

**Verify:** Create an account then delete it in-app — a direct DB query confirms nothing retained; the signed-out app passes the full hospital-basement regression unchanged; the first accounts build passes App Review.

### Phase 30: Local-first sync engine  (4 days)
*Depends on: P1, P29*

**Delivers:** Seamless multi-device sync built on the change tracking designed in phase 1 — the local schema becomes the synced schema.

- PowerSync bridging server Postgres to the existing on-device SQLite, sync buckets per care circle, using the phase-1 change_log and UUIDv7 groundwork
- Conflict policy: last-writer-wins per column for notes/observations; APPEND-ONLY for medication fills and audit events — conflicting med edits surface as a human review card, never silent merge
- First-sign-in backfill of existing local data into the account, reversibly
- Honest sync status UI (last synced, pending changes) and a full-resync recovery path

**Verify:** The same med edited offline on two devices converges deterministically with no lost fill data (review card appears for the conflict); airplane-mode behavior is identical to pre-sync builds; full resync recovers a corrupted replica.

### Phase 31: Care handoff pack & respite mode  (4 days)
*Depends on: P4, P15, P30*

**Delivers:** Time-boxed, least-privilege sharing with a second caregiver — the phase-4 consent framework fully realized and enforced server-side.

- Invite a second caregiver to specific patients with per-category consent scopes (meds, vitals, documents, notes) enforced by RLS policies
- Respite mode: time-boxed access auto-expiring via expires_at policy checks, countdown visible to both parties
- Synced access log: every view/change by a shared caregiver recorded and reviewable by the owner
- Care handoff pack: one-pager + ER sheet + current meds + active notes bundled via the print engine for the incoming helper
- Invite links carry opaque single-use tokens only — no PII in URLs or deep links

**Verify:** A meds-only 48h invite sees meds but a direct API probe for documents is refused server-side by RLS; access dies at expiry in a clock-forward test; every access appears in the owner's log.

### Phase 32: Grounded AI assistant & v2.0 release  (4 days)
*Depends on: P12, P29*

**Delivers:** An assistant that answers only from the person's records with tap-through citations and hard refusals — shipped as v2.0 with demonstrable guardrails.

- Thin server-side LLM proxy (API key never ships in the app) on Anthropic zero-data-retention with BAA; one chokepoint for audit logging, prompt versioning, and rate limits
- Named-provider opt-in consent screen ('Anthropic Claude') shown BEFORE the first transmission per Guideline 5.1.2(i); the feature is off until consented and the app is fully functional without it
- Deterministic context assembly: minimum-necessary record slices selected in code (not embeddings), Zod-validated response shapes
- Citation-linked answers tapping through to the actual record entry; no citation available means 'not in the records' — never general medical knowledge
- Deterministic pre-LLM refusal layer for dose and diagnosis questions with scripted redirect to clinician/pharmacist; red-team suite covering prompt injection via document contents, cross-patient leakage, and dose phrasings
- v2.0 release: privacy labels updated for AI processing, review notes with a demo script a reviewer can trivially trigger

**Verify:** A 50-prompt adversarial suite yields zero dose recommendations, zero cross-patient leaks, and zero uncited claims; 'When did Mom's metformin last change?' cites the exact timeline entry while 'Can I double her dose?' triggers the scripted refusal; v2.0 approved and live above 99.5% crash-free.
