# Hearth Native — What Remains (and who holds it)

Phases P1-P28's **code** is complete: 290 unit/component tests plus 14 Playwright E2E specs, all green and CI-enforced on every push, all screens working on
the simulator. This file is the honest list of what is deliberately NOT done,
split by who has to do it. Check items off as they land.

---

## 1. Yours (needs your Apple account, devices, or people)

### GitHub (one-click, optional)
- [ ] Required-to-merge checks (branch protection) need GitHub Pro on private repos, or a public repo. When either happens, run: gh api -X PUT repos/anirxdh/hearth-native/branches/main/protection with contexts ["test", "core-safety", "e2e"]. Until then both workflows already run on every PR and push; a red check is loudly visible on the PR page, just not merge-blocking.

### Apple / distribution
- [ ] Enroll in the Apple Developer Program ($99/yr) and register the bundle id `com.anirudh.hearth`
- [ ] Create the App Store Connect app record; answer the age-rating questionnaire honestly (medical/wellness topics)
- [ ] `eas build --profile production` + `eas submit` for the first **internal TestFlight** (P9); install on your own iPhone
- [ ] Recruit 3-5 family/friend caregivers for internal TestFlight; watch them onboard unassisted
- [ ] **P19 external beta**: 8-15 real caregivers through Beta App Review, structured feedback, bug bash
- [ ] **P20 v1.0 submission**: listing copy (checked against `docs/consent-and-compliance.md` intended-use statement), screenshots, phased release, respond to App Review

### One-command E2E verification (after a Mac restart)
- [ ] The Maestro E2E flows are written and were verified step by step, but the final full pass is blocked by a wedged CoreSimulator on this machine (hundreds of stale simulator processes after many boot cycles). After restarting the Mac: `./scripts/e2e-local.sh` (app is already built; add `--build` to rebuild). Alternatively run the "E2E (iOS simulator)" workflow from the GitHub Actions tab (uses ~300 of the 2,000 free monthly minutes).
- [ ] Note for flaky finds: on this Xcode 26.3 simulator, below-the-fold elements are sometimes missing from the accessibility snapshot (kAXError -25218); flows are written to assert above-the-fold content on an iPhone 17 Pro Max.

### Physical-device verification (cannot be simulated)
- [ ] **Package the Vision OCR Expo Module** (P21 finishing item): the spike proved Apple Vision reads labels (docs/ocr-scorecard.md); lib/ocr.ts already calls requireOptionalNativeModule('HearthVision').recognizeText(uri) when present. Wrap the spike's ~150-line Swift into an Expo Module, rebuild the dev client, and rerun the corpus scorecard on device. Until then the scan flow works via the sample-label path and manual entry.
- [ ] **3-day notification soak** (P8 gate): two physical iPhones, app force-quit, verify every refill alert lands on time
- [ ] **Real-bottle OCR corpus** (P3/P21 gate): photograph 30-50 of your family's actual Rx bottles across pharmacies; rerun `spike/ocr/run.sh`; compare the scorecard before building P21 scanning
- [ ] **Hospital basement gate** (`HOSPITAL_BASEMENT.md`): full airplane-mode checklist on a physical device before any release
- [ ] **Manual VoiceOver run** (P17 gate): complete add-med, read-digest, and open-ER-sheet with VoiceOver only; XL Dynamic Type screenshot review of every screen
- [ ] Face ID lock, camera capture, AirPrint, and share-sheet flows on a physical device (simulator fakes or lacks all four)
- [ ] Cold-start and long-list profiling on an older iPhone (P18 perf item)

### People / legal
- [ ] **Clinician review of the six emergency guides** (they ship stamped "Pending clinician review v0.9"; a licensed reviewer's name, date, and version bump replace it in `src/content/guides.tsx`)
- [ ] Clinician/pharmacist read-through of all medication copy and the high-alert list
- [ ] Host the consumer-health privacy policy at a public URL (WA MHMD requires it linked from the marketing site homepage); draft lives in `docs/consent-and-compliance.md`
- [ ] Legal read of the attestation + disclaimer set if budget allows
- [ ] Sentry account + DSN (P9 item: crash reporting with the PII scrubber already designed)

---

### Clerk integration (the swap is pre-wired)
- [ ] apps/mobile/src/lib/auth.ts defines the provider interface the whole app consumes; onboarding, silent refresh, and the Face ID gate are already wired against it. To integrate Clerk: install @clerk/clerk-expo, implement ClerkAuthProvider (signUp/signIn via Clerk flows, refresh(oldToken) becomes session.getToken({ skipCache: true }), signOut -> clerk signOut), swap the one authProvider export, delete the local token minting. The 30-minute TTL + Face-ID-gated silent re-login semantics match Clerk session behavior by design.

### Companion LLM swap (the seam is pre-wired)
- [ ] apps/mobile/src/lib/companion.ts is the single seam the Companion tab consumes: answerFor(text, ctx) is pure, local, and returns { text, action }, knowing nothing about the UI. To swap in a real model later: keep answerFor as the offline fallback, add a provider that sends the same ctx snapshot to a clinician-reviewed LLM with a user-supplied API key (Keychain-stored, never bundled, no key of ours to leak), and map replies back into the same { text, action } shape. The 911-first rule and dose-question refusals stay enforced locally on both sides of any model call, by design.

### Wearables (band data: how it actually works)
- [ ] Package the HearthHealthKit Expo Module (Swift: HKStatisticsQuery daily resting HR, steps, sleep) next to HearthVision; lib/wearables.ts already calls it optionally. HealthKit is DEVICE-OWNER ONLY: valid when the patient's own iPhone/Watch runs Hearth. Requires the HealthKit entitlement + purpose strings + a dev-client rebuild.
- [ ] Cross-person band data (caregiver views patient's numbers): Fitbit / Withings / Oura cloud APIs with patient-consented OAuth; needs the P29 backend for token custody. Slots into lib/wearables.ts as another adapter. There is no MCP path for this (MCP is a desktop agent protocol, not an on-device health API).

### Deliberate placeholders (user-approved)
- [ ] 'Request refill' routes to the med screen; a real pharmacy request flow is future integration work.
- [ ] Insurance details on the patient record: the onboarding captures the card as a vault photo; structured member-id fields come later (the booking script's insurance line reads from them then).
- [ ] Workflow editing in-app (rewire nodes, author new workflows): run/pause/resume/cancel is the v1 surface.

### Auth decision (end-stage, P29)
- [ ] Accounts stay absent by design until P29 (device-local UUIDv7 identities; "Data Not Collected" privacy label). At P29 pick: Supabase Auth (roadmap pick: pairs with Postgres RLS + PowerSync sync, BAA path) vs Clerk Expo (nicer prebuilt auth UI, but a second vendor next to the sync database). Decide when sync lands; both support Sign in with Apple, which is mandatory either way (guideline 4.8).

## 2. Next build phases (mine, when you say go)

- [ ] **P21-P23 (v1.1)**: scan-a-label camera flow -> productize the spike module -> field-by-field confirm UI with RxNorm + patient-match + high-alert gates -> scan creates the medication
- [ ] **P24 (v1.2)**: appointment kit (patient-first list, prep sheet from observations, booking script, post-visit capture) + get-there transport cards + escalation contacts
- [ ] **P25-P28 (v1.3)**: the n8n-style admin workflow engine: frozen schema + headless resumable runner -> stepper run UI + HIPAA records release -> Skia canvas viewer + claim denial appeal -> all six workflows + library + versioning
- [ ] **P29-P32 (v2.0)**: Supabase accounts (opt-in, same-phase deletion) -> PowerSync local-first sync -> care handoff pack + respite mode with server-enforced least privilege -> grounded AI assistant behind a server proxy (citations-only, scripted dose refusals, red-team suite)

## 3. Known code debts (small, tracked, deliberate)

- [x] Sex field on the patient profile: optional Male/Female/Prefer-not-to-say selector on add + edit; nutrition uses patient.sex when set (pronoun inference stays as the legacy fallback) and the one-pager note says which source was used
- [x] Document title editing + category picker in the vault: pencil edit on each row opens an inline title + category editor, saved through updateDocument with the standard audit entry
- [ ] Document viewer screen (vault items share out today; an in-app viewer with zoom would be better)
- [x] BP diastolic series on the Activity chart: HearthChart grew an optional second series (dashed, ink3) with a legend and a both-values accessibility summary; other kinds keep the single-series API
- [ ] Observation kinds could feed the P24 prep sheet automatically (designed for it; wire when P24 lands)
- [x] `Alert.prompt` passphrase entry is iOS-only: promptDialog in lib/dialogs.ts (native Alert.prompt, web window.prompt) now backs the backup flows; Android still wants a real modal when it comes
- [x] Migration test harness runs migrations forward only: downgrade.test.ts pins that a database newer than the bundle is a clean no-op (nothing applied, dropped, or deleted); migrateSafely's snapshot/restore covers any future regression to throwing

## 4. Standing release gates (never skipped, each release)

1. `pnpm typecheck && pnpm test` green across the monorepo (CI enforces on every push, plus house-rule guardrails)
1a. Maestro E2E flows green: `./scripts/e2e-local.sh` locally (free) or the weekly/on-demand `E2E (iOS simulator)` workflow
2. `HOSPITAL_BASEMENT.md` full pass in airplane mode on a physical device
3. Xcode archive privacy report matches the privacy nutrition labels
4. No PHI in any log line, URL, notification payload, or app-switcher snapshot
5. Every new screen: VoiceOver labels, 44pt targets, Dynamic Type XL check
