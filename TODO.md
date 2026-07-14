# Hearth Native — What Remains (and who holds it)

Phases P1-P19's **code** is complete: 242 tests green (CI-enforced on every push), all screens working on
the simulator. This file is the honest list of what is deliberately NOT done,
split by who has to do it. Check items off as they land.

---

## 1. Yours (needs your Apple account, devices, or people)

### Apple / distribution
- [ ] Enroll in the Apple Developer Program ($99/yr) and register the bundle id `com.anirudh.hearth`
- [ ] Create the App Store Connect app record; answer the age-rating questionnaire honestly (medical/wellness topics)
- [ ] `eas build --profile production` + `eas submit` for the first **internal TestFlight** (P9); install on your own iPhone
- [ ] Recruit 3-5 family/friend caregivers for internal TestFlight; watch them onboard unassisted
- [ ] **P19 external beta**: 8-15 real caregivers through Beta App Review, structured feedback, bug bash
- [ ] **P20 v1.0 submission**: listing copy (checked against `docs/consent-and-compliance.md` intended-use statement), screenshots, phased release, respond to App Review

### Physical-device verification (cannot be simulated)
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

## 2. Next build phases (mine, when you say go)

- [ ] **P21-P23 (v1.1)**: scan-a-label camera flow -> productize the spike module -> field-by-field confirm UI with RxNorm + patient-match + high-alert gates -> scan creates the medication
- [ ] **P24 (v1.2)**: appointment kit (patient-first list, prep sheet from observations, booking script, post-visit capture) + get-there transport cards + escalation contacts
- [ ] **P25-P28 (v1.3)**: the n8n-style admin workflow engine: frozen schema + headless resumable runner -> stepper run UI + HIPAA records release -> Skia canvas viewer + claim denial appeal -> all six workflows + library + versioning
- [ ] **P29-P32 (v2.0)**: Supabase accounts (opt-in, same-phase deletion) -> PowerSync local-first sync -> care handoff pack + respite mode with server-enforced least privilege -> grounded AI assistant behind a server proxy (citations-only, scripted dose refusals, red-team suite)

## 3. Known code debts (small, tracked, deliberate)

- [ ] Sex field on the patient profile (one-pager nutrition currently infers from pronouns and says so; replace with an explicit optional field)
- [ ] Document title editing + category picker in the vault (files land as "Untitled document"/filename today)
- [ ] Document viewer screen (vault items share out today; an in-app viewer with zoom would be better)
- [ ] BP diastolic series on the Activity chart (systolic plots today, labeled as such)
- [ ] Observation kinds could feed the P24 prep sheet automatically (designed for it; wire when P24 lands)
- [ ] `Alert.prompt` passphrase entry is iOS-only (fine for iOS-first; Android needs a small modal when it comes)
- [ ] Migration test harness runs migrations forward only; add a downgrade-refusal test before P30 sync

## 4. Standing release gates (never skipped, each release)

1. `pnpm typecheck && pnpm test` green across the monorepo (CI enforces on every push, plus house-rule guardrails)
1a. Maestro E2E flows green: `./scripts/e2e-local.sh` locally (free) or the weekly/on-demand `E2E (iOS simulator)` workflow
2. `HOSPITAL_BASEMENT.md` full pass in airplane mode on a physical device
3. Xcode archive privacy report matches the privacy nutrition labels
4. No PHI in any log line, URL, notification payload, or app-switcher snapshot
5. Every new screen: VoiceOver labels, 44pt targets, Dynamic Type XL check
