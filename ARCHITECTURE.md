# Hearth Native — Architecture and Decision Records

This document records the load-bearing decisions behind phases P1–P8, why each was made, what it cost, and where it pays off later. File paths are real; every decision here is implemented and tested in this repo.

---

## 1. The one-sentence architecture

A **pure-TypeScript deterministic core** (`packages/core`) computes everything that must be exact; an **encrypted local SQLite database** (`packages/schema` + `apps/mobile/src/db`) is the single source of truth; and a thin **Expo screen layer** (`apps/mobile/src/app`) renders rows read straight from the database — no server, no account, no AI anywhere in phases 1–8.

```
label facts (fill date + day supply)
        │  entered once, verified by a human
        ▼
┌─────────────────────────┐     ┌──────────────────────────┐
│ SQLCipher-encrypted     │────▶│ @hearth/core (pure TS)   │
│ SQLite  (the truth)     │     │ runway → digest → alerts │
└─────────────────────────┘     └──────────────────────────┘
        ▲                                   │
        │ repository writes + change log    ▼
┌─────────────────────────┐     ┌──────────────────────────┐
│ expo-router screens     │◀────│ pre-scheduled local      │
│ (read models, no state) │     │ notifications (iOS)      │
└─────────────────────────┘     └──────────────────────────┘
```

---

## 2. Decision records

### ADR-1 · Monorepo with a React-free core
**Decision.** pnpm workspace: `apps/mobile`, `packages/core`, `packages/schema` (+ `packages/label-parser` from the P3 spike). `packages/core` never imports React or React Native.
**Why.** The safety-critical math (runway, digest ranking, notification planning) must be testable in milliseconds on plain Node, portable to a future server or Android app, and reviewable without UI noise. CI runs 135 core tests in ~2.5 s.
**Cost.** A little indirection: screens call the repo, the repo calls core.
**Where it pays off.** P30 sync and any future server reuse the exact same engine; a judge (or auditor) can read one folder and see every rule.

### ADR-2 · SQLCipher-encrypted SQLite with the key in the Keychain
**Decision.** `expo-sqlite` built with `useSQLCipher: true`; a 256-bit key is generated on first launch with `expo-crypto` and stored only in the iOS Keychain (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`); `PRAGMA key` is the first statement on every connection (`apps/mobile/src/db/client.ts`).
**Why.** PHI at rest must be unreadable without the device passcode context, by construction, not by policy. iOS Data Protection (`NSFileProtectionCompleteUntilFirstUserAuthentication`) layers on top.
**Explicit boot states.** `bootDatabase()` distinguishes ready / key-without-db / db-without-key / migration-failed, and each mismatch state renders a recovery screen instead of crash-looping. Key loss means the data is gone *by design*; the P18 encrypted backup becomes the escape hatch.

### ADR-3 · Copy-restore migration safety
**Decision.** Before applying Drizzle migrations, checkpoint WAL and copy the DB file; on failure, close, restore the copy, and surface `migration-failed` (`migrateSafely()` in `client.ts`).
**Why.** An interrupted or buggy migration must never strand a caregiver's only copy of the data. SQLite transactions cover a single migration statement set, but the file copy covers even catastrophic failures.
**Verification.** `packages/schema/src/__tests__/durability.test.ts` simulates a failing migration and asserts the restored file matches the seeded state.

### ADR-4 · Two kinds of time, never mixed
**Decision.** Instants are ISO-8601 UTC strings (`createdAt`, `attestationAt`); calendar facts are `YYYY-MM-DD` local-date strings (`fillDate`, `dob`). All calendar math routes through `Date.UTC` (`packages/core/src/dates.ts`); nothing in core reads the system clock — "today" is always passed in from `apps/mobile/src/lib/clock.ts`.
**Why.** A fill date is a *pharmacy calendar fact*, not an instant: treating it as midnight-something invites off-by-one bugs at DST transitions and across timezones. Pure-UTC day math makes DST provably irrelevant (tested across spring-forward, fall-back, leap days, and year boundaries).
**Where it pays off.** The runway can never drift a day because the caregiver flew to another timezone.

### ADR-5 · UUIDv7 identifiers
**Decision.** Time-ordered UUIDv7 (RFC 9562) generated in `packages/core/src/uuid.ts`, with an injectable random source.
**Why.** Time-ordered ids keep SQLite b-trees append-friendly, make change feeds naturally ordered, and give the future P30 sync engine stable, conflict-free ids that sort by creation time. Injectable randomness makes id generation deterministic in tests.

### ADR-6 · Append-only change log as the spine
**Decision.** Every consequential write goes through the repository (`apps/mobile/src/db/repo.ts`), which appends to `change_log` (never updated, never deleted). `access_log` exists from day one for sensitive reads.
**Why.** Three birds: (1) the audit trail the P4 consent framework promises caregivers; (2) the "medication changes auto-appear in the history timeline" feature of P12 is a query, not new plumbing; (3) `change_log` + UUIDv7 is exactly the change-tracking a PowerSync-style sync engine consumes in P30 — sync becomes a migration, not a rewrite.
**Bonus.** The UI refresh signal hooks `logChange()` (one choke point): any write bumps a version, and screens re-read via `useSyncExternalStore`.

### ADR-7 · The database row is the only state
**Decision.** No Redux/Zustand for domain data. Screens read from SQLite through the repo inside `useData()` (`useSyncExternalStore` + version bump) and re-read on any write.
**Why.** Mirroring rows into a JS store is the classic source of "the screen says 4 days but the DB says 3." With a local, fast, synchronous SQLite, reads are cheap; correctness beats cleverness at this scale.
**Cost.** Re-reads are coarse (any write re-runs screen queries). Acceptable at family-circle data volumes; Drizzle live queries are the escape hatch if profiling ever demands it.

### ADR-8 · Runway = inventory arithmetic, statuses in code
**Decision.** `runOutDate = fillDate + daySupply`; `daysRemaining = runOutDate − today`; statuses `ok / soon(≤10) / urgent(≤3) / overdue(≤0)` are constants in `packages/core/src/runway.ts`. PRN meds get **no** forecast, deliberately.
**Why.** The single most preventable caregiving failure (running out) is fully determined by two numbers printed on the label. No model, no heuristics, no adherence guessing — so the number is never wrong, and the UI can say *why* ("supply ends 2026-07-16").
**Honesty rule.** No fill on record → no runway → an explicit "add fill" state, never a guess. As-needed meds → "no forecast," never a fake countdown.

### ADR-9 · The digest is a ranking, not a feed
**Decision.** `buildDigest()` (`packages/core/src/digest.ts`) ranks across every patient: overdue > urgent > soon > missing-fill > stale(≥14 d) > all-good; ties break by days remaining, then high-alert. Output is exactly one lead item plus at most four quiet lines.
**Why.** Alarm fatigue is the failure mode of every monitoring product. A hard cap (one action) forces triage into the code, where it is testable — `digest.test.ts` pins the full ranking order — instead of leaving prioritization to a stressed human at 7 a.m.

### ADR-10 · Notifications pre-scheduled at write time
**Decision.** Because runway is arithmetic, every future alert is knowable the moment a fill is saved. `planNotifications()` (`packages/core/src/notifications.ts`) computes the whole desired set (lead / urgent / run-out / overdue nudge per med); the app diff-reconciles it against what iOS actually has pending (stable keys = med + trigger + date) on every med write and every foregrounding. Background tasks are never load-bearing.
**Why.** iOS background execution is best-effort and silently throttled; products that "compute alerts in the background" miss alerts. Pre-scheduling sidesteps the whole failure class. The iOS 64-pending cap is handled nearest-first, topped up on each open.
**Privacy rule (tested).** Lock-screen payloads never contain a drug, dose, or person name — `notifications.test.ts` asserts payloads against the corpus of names.

### ADR-11 · High-alert medications get friction, not blockage
**Decision.** A bundled ISMP-derived list (`packages/core/src/highAlert.ts`) flags anticoagulants, insulin, opioids, methotrexate, digoxin, lithium, and other classes by name match; creating or renaming a matching med triggers an extra deliberate confirmation. P22 upgrades matching to RxNorm ingredient classes.
**Why.** The cost asymmetry is extreme (a wrong blood-thinner entry can kill; an extra tap costs a second). Friction is added exactly where the asymmetry lives — and only there.

### ADR-12 · Expo managed + dev client, New Architecture, no Expo Go
**Decision.** Expo SDK 57 managed workflow with `expo-dev-client`; native needs (SQLCipher, secure store, notifications) via config plugins; EAS profiles committed.
**Why.** Solo-dev velocity with full native capability. SQLCipher rules out Expo Go from day one, which is fine: the dev client is the artifact TestFlight will ship.
**Compliance plumbing landed with P1.** `ITSAppUsesNonExemptEncryption=false`, Data Protection entitlement, light-only UI, camera strings deferred until the feature that needs them (P13/P21) so permission requests are honest.

### ADR-13 · Design system as the only styling surface
**Decision.** `apps/mobile/src/ds` holds tokens (paper/ink/hairlines/status colors, editorial type scale) and every primitive (Screen, SectionHeader, Card, ListRow, PillButton, StatusDot, RunwayBar, FormField, CheckRow, EmptyState, DisclaimerFootnote). Screens never use raw colors; status color appears only as small semantic dots/tags; a gallery screen renders every component in every state.
**Why.** The Ivory Editorial language is the product's trust signal; centralizing it makes drift impossible and the P17 accessibility pass a single-folder job. System font (SF) everywhere — zero font-loading risk, native feel.

### ADR-14 · Spikes before subsystems
**Decision.** P3 proved label OCR (Apple Vision CLI on macOS — the same Vision API surface iOS uses — over a generated 26-label corpus with ground truth, feeding `packages/label-parser`), and P4 fixed the legal/consent posture (attestation at add-patient, disclaimer set, not-a-covered-entity stance) **before** the scan flow or sharing features exist.
**Why.** These are the two risks that could invalidate whole subsystems (P21–P23 scanning; P29–P31 sharing). Retiring them costs days now and saves weeks later. The per-field scorecard directly dictates the P22 confirm-UI design (which fields need low-confidence flagging).

### ADR-15 · Demo data is relative, attested, and fictional
**Decision.** `seedDemoFamily(db, today)` (`packages/schema/src/seed.ts`) computes all fill dates relative to the passed `today`, so Robert's metformin is always ~3 days from empty — the demo digest always has a story. Every seed write goes through the same audit path as real writes.
**Why.** A demo that decays into "everything is fine" after a week is useless for TestFlight reviewers and App Review; ACL/App Store reviewers see the product exactly as designed.


### ADR-16 · Charts are custom SVG, not a chart library
**Decision.** `HearthChart` renders through `react-native-svg` (already present for Lucide icons): hairline grid, ink line, first/last labels, optional reference band. All bucketing lives in `packages/core/src/series.ts` (7d/30d daily, 90d weekly means, 1y monthly means; same-day readings averaged first), pinned by 9 tests.
**Why.** The roadmap suggested victory-native (Skia), but vitals trends need exactly one mark type (a line), and Skia would add a heavyweight dependency purely for styling we would then fight to make editorial. Deviation recorded here on purpose: Skia enters in P27 for the workflow canvas, which genuinely needs gestures and a scene graph; if charts ever need pan/scrub, they can ride that dependency then.
**The invariant that matters.** What you see is what the data says: rendering is pure presentation and every transformation is a tested pure function.

### ADR-17 · The paper layer is a pure package with two enforced rules
**Decision.** `packages/print` produces complete US-Letter HTML documents (one-pager, ER sheet, portfolio, guide) as pure TypeScript string functions with zero react-native imports, snapshot-tested, XSS-escaped (`esc()` tested against a `<script>` payload in a patient name). The app-side `lib/print.ts` is the only place PDFs are made, and it enforces: (1) every print/share writes to the access log; (2) PHI PDFs exist only in cache and are deleted after the share sheet closes.
**Why.** Printouts are the product's emergency interface: they must render identically forever (snapshots), survive hostile input (escaping), and never silently leak (one chokepoint for logging and cleanup). Severe allergies render as a black band leading every page, above medications, asserted by test.

### ADR-18 · Backup is SQLCipher re-keying, not hand-rolled crypto
**Decision.** Export attaches a new database keyed to a caregiver-chosen passphrase and runs `sqlcipher_export` (the canonical SQLCipher copy path); import verifies the passphrase, replaces the live file, re-exports into a fresh database keyed with this device's Keychain key, and rolls forward through any newer migrations via the normal boot path.
**Why.** No new cryptography code, no new dependencies: the same audited engine that encrypts at rest encrypts in transit. This is also the deliberate answer to the by-design key-loss case from ADR-2: a backup plus its passphrase rebuilds the record on a new phone.

### ADR-19 · Shields: privacy overlay always, Face ID opt-in
**Decision.** One component (`Shields`) covers the UI with plain paper whenever the app is not active (so iOS app-switcher snapshots never show care data) and, when the caregiver opts in, demands Face ID/passcode on open and on return from background. A root `ErrorBoundary` guarantees no crash ever strands a caregiver on a white screen.
**Why.** The overlay is free privacy with zero friction, so it is always on. The lock adds friction at exactly the wrong moments (an emergency), so it is a choice, not a default; the settings copy says what it does and when it asks.

### ADR-20 · Guides are bundled data, stamped for review
**Decision.** The six emergency guides live in the binary as typed data (24 SVG pictogram components, four steps each), with a version + reviewer + date stamp rendered on every card and printout. They currently ship stamped "Pending clinician review v0.9" — visibly, not in a changelog.
**Why.** Emergency content must work offline, never vary by network state, and never be generated. Content updates are data changes reviewed like code (guideline 2.5.2-safe). Wearing the review status on the surface is the honest version of "clinician-reviewed": the stamp is real, so its absence is visible until a licensed reviewer signs.

---

## 3. Testing strategy

| Layer | Harness | What is pinned |
|---|---|---|
| `packages/core` | Jest (ts-jest), 155 tests | Golden runway tables across DST/leap/boundaries; full digest ranking order; notification trigger sets, quiet-hours wrap, 64-cap, PHI-free payloads; UUIDv7 bits and ordering; high-alert matches |
| `packages/schema` | Jest + better-sqlite3, 22 tests (now over migrations 0000+0001) | Migrations apply in journal order onto a fresh DB; seed round-trips field-for-field; audit helpers append; copy-restore durability under a failing migration |
| `apps/mobile` | Jest (jest-expo + Testing Library), 25 tests, plus `tsc --noEmit` strict and the simulator build | DS component behavior and accessibility contracts (roles, labels, disabled states); chart empty/summary states; guide-content invariants (four steps, call-first set, blood-thinner warnings, review stamps, no dose instructions); access-log labels |
| CI | GitHub Actions (macOS) | `pnpm typecheck && pnpm test` on every push |

| `packages/print` | Jest snapshots, 11 tests | Template output stability; escaping; severe-allergy-before-meds ordering |
| `packages/label-parser` | Jest, 29 tests | Deterministic label parsing against the P3 corpus |

**The rule that generated the tests:** every number a caregiver might act on must be computed in exactly one place, in pure code, with a test pinning it. Total: 242.

**CI (every push):** an ubuntu job runs typecheck, all 242 tests, and `scripts/guardrails.sh` (no emojis, no em dashes, no `console.log` in app source, generic notification payload intact, no PII in routes, guide review stamps present); a second visible `core-safety` job re-runs the deterministic core verbosely so a safety-math regression is unmissable. **E2E (weekly + on demand):** Maestro flows in `.maestro/` drive a Release simulator build through first-run, demo seed, the digest, the patient record, the ER sheet, and the guides; `scripts/e2e-local.sh` runs the same flows free before releases.

---

## 4. What P1–P8 deliberately did NOT build

- **No account, no server, no network calls.** The privacy label is honestly "Data Not Collected" until P29.
- **No AI.** The first LLM feature (assistant) arrives at P32, behind a server proxy, after consent UX exists. OCR (P21) is on-device Vision — not a cloud model.
- **No adherence tracking.** Hearth never claims to know whether a dose was swallowed; it knows supply. That honesty is a feature.
- **No dose logic of any kind.** Runway copy is inventory framing; the intended-use statement (P4) is checked against every screen.

## 5. The path from here (how P1–P8 pre-paid for it)

- **P13/P21 camera features** slot behind permission strings already reserved in the P4 checklist.
- **P22 RxNorm confirm UI** consumes the P3 scorecard's per-field confidence thresholds; `medications.rxcui` column already exists.
- **P25 workflow engine** persists definitions/runs into this same SQLite with the same audit spine.
- **P29/P30 accounts + sync** consume `change_log` + UUIDv7 + UTC/local-date conventions laid in P1 — the local schema *is* the synced schema.
- **P31 respite sharing** implements the P4 per-category consent scopes; `access_log` is already the viewing record.
