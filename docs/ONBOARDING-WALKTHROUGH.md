# The pre-account experience, end to end

What happens between a cold first launch and a usable app with one person in the care circle. Scope stops at the arrival screen; sync, workflows, scan, and the Companion are out of scope except where they touch this path.

Every path below is relative to the repo root, `/Users/anirudh/Desktop/sideprojects/hearth-native`, unless it is already absolute. Verified against the working tree on 2026-07-27.

---

## 1. The 60-second version

1. **Boot.** `apps/mobile/src/app/_layout.tsx` renders nothing but a breathing mark until `bootDatabase()` resolves. That call reads or mints a 256-bit SQLCipher key in the iOS Keychain, opens `rua.db`, runs `PRAGMA key` as the very first statement, migrates behind a file-copy safety net, and seeds workflow templates. Four non-`ready` outcomes each get a `Recovery` screen instead of a crash loop.
2. **The gate.** There is no `app/index.tsx`. `/` is `apps/mobile/src/app/(tabs)/index.tsx`, and Home itself redirects: `if (!hasAccount() && data.patients.length === 0) return <Redirect href="/welcome" />`. That single expression is the entire first-run test — there is no `onboardingComplete` flag anywhere.
3. **The threshold.** `apps/mobile/src/app/welcome.tsx` shows the word RUA, the dotted sphere, and "Press and hold to begin". Hold the sphere for 3000 ms; it contracts, the haptics build, a hairline ring fills, then it blooms for 360 ms and calls `onEnter()`, which `router.replace`s to `/onboarding`. Writes nothing.
4. **Step 1 of 4 — account.** `app/onboarding/index.tsx`: a three-slide carousel, then name + email → `authProvider.signUp()`. That writes one `settings` row (`auth.local`) and one Keychain item. Then `offerNativeProtections()` blocks navigation on two native sheets: opt-in Face ID (writes `settings.appLock = true`) and the iOS notification prompt. There is also an underlined "See a demo family" escape hatch that seeds three fictional people **and no account**.
5. **Step 2 of 4 — the person.** `app/onboarding/person.tsx`: name, relationship, DOB, optional photo, plus a required caregiver-authority attestation checkbox. `createPatient()` inserts the row, stamps the attestation text and timestamp, and appends a `change_log` create row. Navigates to `/onboarding/uploads?patientId=<id>` — that query param is the only thing threading the patient through the rest of the wizard.
6. **Step 3 of 4 — the papers.** `app/onboarding/uploads.tsx`: insurance card and a records file. On device, `lib/vault.ts` copies the bytes into `Documents/vault/` and writes a `documents` row holding only the generated filename.
7. **Step 4 of 4 — the band.** `app/onboarding/wearables.tsx`: "Connect the demo band" sets `settings['wearables.source.<id>'] = 'demo-band'` and runs `syncWearables()`, which backfills 30 days of deterministic `vitals` rows each tagged `note: 'from band'`.
8. **Arrival.** `app/onboarding/done.tsx` reads the database back — account name, care circle, document count, band-reading count — and "Open RUA" does `router.replace('/')`. Home now passes the gate because a patient exists.

Total keystroke-free time at the threshold: 3.36 seconds. Total writes before an account exists: one Keychain key. Total network calls in the whole flow: zero.

---

## 2. The map

Every file the pre-account path actually touches.

```
apps/mobile/
  app.json                              expo-sqlite plugin with useSQLCipher:true; the
                                        NSFileProtectionCompleteUntilFirstUserAuthentication entitlement
  jest.setup.js                         already mocks expo-secure-store (see §6 — the harness exists, tests don't)
  src/
    app/
      _layout.tsx                       the only bootDatabase() caller; Recovery UI; foreground upkeep;
                                        notification deep-link listener; gates the whole Stack on boot
      welcome.tsx                       the threshold screen; enter() routes to /onboarding or /;
                                        dev-only ?enter=1 automation hook
      (tabs)/index.tsx                  Home. Line 121 holds the entire first-run redirect
      onboarding/
        _layout.tsx                     15 lines: a plain Stack, no guard, no completion tracking
        ui.tsx                          OnboardingSteps({step}) shared by all four steps; its own default
                                        export is a <Redirect> back to /onboarding
        index.tsx                       step 1: carousel, account form, offerNativeProtections(), demo door
        person.tsx                      step 2: first patient + attestation
        uploads.tsx                     step 3: two document pickers; patient/no-patient variants
        wearables.tsx                   step 4: demo band; patient/no-patient variants
        done.tsx                        arrival summary (renders no step indicator — it is not "step 5")
    components/
      ThresholdSphere.tsx               the hold gesture: 170 dots, one RAF loop, ring, haptics, bloom
      LiquidGlass.tsx                   liquidGlassAvailable() gate; the disc under the finger, the step capsule
      BreathingMark.tsx                 the pre-boot placeholder
      Shields.tsx                       app-switcher paper cover + the optional Face ID app lock
      EmptyArt.tsx                      BottleArt / FlowArt / ChartArt — the three carousel illustrations
    db/
      client.ts                         key lifecycle, PRAGMA key, BootState, migrateSafely, destroyAllData
      repo.ts                           every write funnels here: logChange/diff, createPatient (:96),
                                        addDocument (:416), getSetting/setSetting (:462)
      webdb.web.ts                      sql.js, in-memory per page load — the Playwright surface only
      workflowStore.ts                  seedWorkflowTemplates() runs at boot, before onboarding
    lib/
      auth.ts                           LocalAuthProvider; the Clerk-shaped seam; TODO(clerk) at :134
      vault.ts                          VAULT_DIR, intake(), importDocumentPhoto/File
      wearables.ts                      the demo-band generator and syncWearables()
      demo.ts                           confirmLoadDemoFamily() → seedDemoFamily()
      events.ts / useData.ts            bumpDataVersion + useSyncExternalStore; why screens re-read SQLite
      copy.ts                           ATTESTATION_TEXT, ATTESTATION_EXPLAINER, ONBOARDING_DISCLAIMER
      clock.ts                          nowIso(), today(), greetingFor()
      notifications.ts                  ensureNotificationPermission(), syncNotifications()
      dialogs.ts                        confirmDialog / infoDialog (Alert.alert on native, DOM fallback on web)
      reboot.ts                         19-line handler registry so a wipe can remount the tree cleanly
      polyfills.ts                      imported on line 1 of _layout.tsx, before anything else
      backup.ts                         not in onboarding — but the ONLY escape hatch from key loss (§4)
    ds/ , ds/motion.ts                  Screen/Card/PillButton/FormField/CheckRow; enterLead/enterRow/enterQuiet
packages/
  schema/src/schema.ts                  every table; the change_log and documents-vault comments
  schema/src/migrations.ts              GENERATED, SQL inlined as m0000..m0003 (Metro can't import .sql)
  schema/src/seed.ts                    seedDemoFamily()
  core/src/uuid.ts                      uuidv7() — client-generated, time-ordered ids
  core/src/dates.ts                     isValidLocalDate() used by the DOB field
e2e/specs/07-onboarding.spec.ts         the one real end-to-end test of this whole flow
e2e/specs/helpers.ts                    loadApp() / seedDemo(); drives the hold ritual in four other specs
.maestro/03-onboarding.yaml             the native mirror — weaker than it looks (§6)
```

---

## 3. Screen by screen

### 3.0 Boot — `apps/mobile/src/app/_layout.tsx`

`RootLayout` holds exactly one piece of state, `boot: BootState | null`, and gates the entire tree on it. Nothing — not a route, not the tab shell — mounts before the encrypted database is open.

Order on cold start:

1. `import '../lib/polyfills'` is the literal first line; `SplashScreen.preventAutoHideAsync()` runs at module scope (line 19).
2. `useEffect(doBoot)` → `bootDatabase()` from `db/client.ts`.
3. On `kind: 'ready'`, `seedWorkflowTemplates()` runs synchronously inside a try/catch — a failure is logged, not fatal. Then `setBoot(state)`, and `SplashScreen.hideAsync()` in `.finally`.

While `boot === null`: a bare paper `View` centered on `<BreathingMark size={56} />`. No `Stack`, no router, so no route can mount early.

If `boot.kind !== 'ready'`, the `Recovery` component (lines 26–61) renders one of four copy sets. The consequential line is the reset handler at 145–157:

```ts
if (boot.kind === 'key-without-db' || boot.kind === 'db-without-key') {
  destroyAllData().then(...)
} else {
  setBoot(null); doBoot();       // migration-failed / boot-error: retry, never wipe
}
```

Only the two explicit key/DB mismatch states may destroy data. That guard is the single highest-consequence branch in this path and it has no test (§6).

Two more root effects matter here only by their absence. Foreground upkeep always runs `syncNotifications()`, but `ensureFreshSession()` and `syncWearables()` are inside `if (hasAccount())` — so before signup, nothing biometric or wearable-ish fires on resume. And a notification-response listener deep-links `data.route`.

`Shields` (`components/Shields.tsx`) is independent of the account: it covers the UI with paper on backgrounding (app-switcher snapshot protection), and if `getSetting('appLock', false)` is true it demands Face ID. That setting can be turned on *during* onboarding step 1, so the app lock can exist before there is a single person in the circle.

### 3.1 The entry gate — there is no `app/index.tsx`

`/` resolves to `apps/mobile/src/app/(tabs)/index.tsx`. The tab shell mounts, Home runs its `useData` read, and then:

```ts
// (tabs)/index.tsx:121
if (!hasAccount() && data.patients.length === 0) {
  return <Redirect href={'/welcome' as never} />;
}
```

Three consequences worth internalizing before you add a backend:

- **Account OR one patient is enough to never see the sphere again.** They are ORed, not ANDed. A visitor who takes the demo door gets patients with no account and is permanently past the threshold.
- **There is no completion flag.** Quit halfway through the wizard after creating the account and you land on Home's empty state forever. Nothing records *which* step you abandoned.
- `/welcome` is a sibling route pushed onto the root `Stack` above the `(tabs)` group, with iOS gesture-back enabled. Swiping back lands on Home, which immediately redirects to `/welcome` again. Self-healing, but a visible bounce.

The other Home branch — `hasAccount()` true, zero patients — renders the "Start your care circle" `EmptyState` with three actions: `PillButton "Set up RUA"` → `push('/onboarding')`, `"Add a person"` → `push('/patient/new')`, and an underlined link → `confirmLoadDemoFamily()`.

### 3.2 The threshold — `apps/mobile/src/app/welcome.tsx` (70 lines)

Top: `RUA` in letterspaced label type, `entering={enterQuiet}`. Middle: the sphere in a `flex: 1` centering view, sized `Math.max(150, Math.min(264, Math.round(height * 0.34)))`. Bottom, fading in at `duration.slow` (340 ms) after a **700 ms delay** with `ReduceMotion.System`: "A calm place for everyone you care for." and "Press and hold to begin".

The sphere deliberately has **no** entering animation around it. The comment at lines 48–50 explains why: the Liquid Glass disc it shows during the hold does not composite inside a layout-animated subtree.

Writes: nothing at all.

```ts
function enter() {
  router.replace(hasAccount() ? '/' : ('/onboarding' as never));
}
```

`replace`, so the threshold never lands on the back stack. The `hasAccount()` branch is effectively dead in the normal flow — you only reach `/welcome` when there is no account — and exists for the deep link.

Dev-only branch (lines 34–37): `rua:///welcome?enter=1` calls `enter()` from a `useEffect` when `__DEV__`, because Maestro cannot express a 3-second hold. Inert in production. This is also why the native test suite has never actually opened the door (§6).

### 3.3 The hold — `apps/mobile/src/components/ThresholdSphere.tsx` (243 lines)

The signature interaction, in detail.

**Geometry.** `DOTS = 170` points from a Fibonacci sphere (`unitSphere`, golden angle `π(3−√5)`, no pole clumping), rotated around Y and projected orthographically every frame, rendered as 170 `<Circle>` elements inside one `react-native-svg` `<Svg>`.

**Constants** (module scope, lines 25–32):

| Constant | Value | Meaning |
|---|---|---|
| `HOLD_MS` | 3000 | the hold |
| `IDLE_REV_SECONDS` | 26 | one idle revolution |
| `BREATH_SECONDS` / `BREATH_DEPTH` | 6.5 / 0.016 | the idle inhale-exhale |
| `BLOOM_MS` | 360 | the payoff after completion |

**The loop.** One `requestAnimationFrame` loop driven by `Date.now()` deltas. Continuous values live in refs (`angleRef`, `holdRef`, `bloomStart`, `entered`, `lastPulse`); React state is throttled to roughly 30 fps by `if (now - lastTick.current > 33)`. So the animation runs at display rate while React re-renders 30 times a second.

- `holdStart.current` is set in `onPressIn`, nulled in `onPressOut`. `target = min(1, (now - holdStart) / HOLD_MS)`.
- Release **drains** rather than snapping: `holdRef.current = holding ? target : Math.max(0, holdRef.current - dt * 3.4)`, about 0.3 s to empty.
- Rotation speed scales with the hold: `((2π) / 26) * (1 + hold * 2.2)` — up to 3.2× at full hold.
- Radius is one expression, and it is the whole feel of the thing:
  `half * (0.78 + breath*0.016 − hold*0.22 + bloom*0.55)`. The sphere **contracts 22 %** under the finger, then throws outward 55 % on bloom while `dissolve = 1 - bloom` fades every dot toward zero.
- Dot radius and opacity also read the hold: `r = 0.9 + depth*(1.5 + hold*0.5)`, `opacity = (0.12 + depth*(0.55 + hold*0.33)) * dissolve`, where `depth` is the projected z mapped to 0 (back) → 1 (front).
- **Haptics** (skipped on web): a pulse every 15 % of the hold, `Math.floor(target / 0.15)` — Light for steps 0–2, Medium for 3–4, Heavy for 5–6, then `NotificationFeedbackType.Success` at completion. Seven build-up taps, then the confirmation.
- **The ring**: two SVG circles at `r = half - 3`. The filled one uses `strokeDasharray = circumference` with `strokeDashoffset = C * (1 - hold)` and `transform="rotate(-90 …)"` so it starts at twelve o'clock. Both are opacity-zero until `hold > 0.02`.
- **Liquid glass**: when `liquidGlassAvailable()` and `hold > 0.02`, a `<LiquidGlass effect="clear" interactive>` disc at 82 % of the sphere box, opacity `min(1, hold * 1.4)`, `zIndex: 1`, refracting the dots beneath it.

**Completion is two-phase, and `onEnter` fires from inside the RAF loop, not from the press handler** (lines 107–123):

```ts
if (holding && target >= 1 && !entered.current) {
  entered.current = true; bloomStart.current = now; /* success haptic */
}
…
if (bloomStart.current !== null) {
  bloom = Math.min(1, (now - bloomStart.current) / BLOOM_MS);
  if (bloom >= 1) { onEnter(); return; }   // stops the loop entirely
}
```

So finger-down to navigation is 3000 + 360 ms, and `bloomStart` survives an early release: once you cross 3 s the bloom completes and you are let in even if you lift immediately.

**Accessibility.**
- Reduce Motion is read once on mount via `AccessibilityInfo.isReduceMotionEnabled()`. It kills rotation (`if (!reduceMotion) angleRef.current += …`) and zeroes `breath`. The hold, the ring, and the haptics all still work.
- VoiceOver: `accessibilityRole="button"`, label "Hold to enter RUA", hint "Press and keep holding for three seconds, or double tap with VoiceOver", plus an explicit `accessibilityActions=[{ name: 'activate' }]` whose handler calls `onEnter()` immediately — no 3 s, no bloom.
- **The docstring lies.** Lines 20–22 claim "the parent screen always offers a plain alternative button." It does not; `welcome.tsx` has no button, and its own comment on line 18 says the door is orb-only. The VoiceOver `activate` action is the *only* alternative path into the app.

### 3.4 The wizard shell — `app/onboarding/_layout.tsx` and `ui.tsx`

`_layout.tsx` is fifteen lines: a plain `Stack`, `headerShown: false`, paper background. Steps are `push`ed, so the iOS back gesture walks the wizard backwards. No guard, no redirect, no completion tracking.

`ui.tsx` lives inside the route directory so the steps can share it, which means expo-router also treats it as a route. It exports `OnboardingSteps({ step: 1|2|3|4 })` — "Step n of 4" plus four 14×3 ink ticks, wrapped in a `LiquidGlass` capsule when available — and its *default* export is `<Redirect href="/onboarding" />` so an accidental visit to `/onboarding/ui` bounces to the start.

**The step docstrings are all off by one.** `person.tsx` says "Step 3" and renders `step={2}`; `uploads.tsx` says "Step 4" and renders `3`; `wearables.tsx` says "Step 5" and renders `4`. Leftovers from a five-step wizard. The UI is right; the comments are wrong.

### 3.5 Step 1 — `app/onboarding/index.tsx` → `/onboarding`

**Returning-user branch first.** `const existing = currentUser()` (line 221). If an account exists, the entire carousel and form are replaced by one card: "Welcome back, {name}" plus a `Continue` button (`testID="ob-continue-account"`) straight to `/onboarding/person`. No re-signup, no re-validation, and `authProvider.signIn()` is never involved.

First run sees three things:

- **`HeroCarousel`** — a horizontal paging `FlatList` over three `SLIDES`: "One glance, every medication" (`BottleArt`), "Paperwork, automated" (`FlowArt`), "The daily rhythm" (`ChartArt`). Auto-advances on a `setInterval` every `SLIDE_HOLD_MS = 2600`, wrapping with `%`. `onTouchStart` sets `touched.current = true` and the interval yields **permanently** — the hand takes over for good. Pager dots animate width 6 → 18 via `withSpring({ damping: 24, stiffness: 220, reduceMotion: ReduceMotion.System })`, floating in a `LiquidGlass` pill when available, labelled `Slide ${page+1} of 3`.
- **The account `Card`** — "Created on this phone, not on a server." Two `FormField`s: Full name (`ob-name`) and Email (`ob-email`, `autoCapitalize="none"`, `keyboardType="email-address"`), then `Create account` (`ob-create`).
- **The demo door** — an underlined `Pressable` (`ob-demo`), "Just exploring? See a demo family", calling `confirmLoadDemoFamily(() => router.replace('/'))`, which runs `seedDemoFamily(getDb(), today())` and drops you into the app with **no account at all**.

`create()` (lines 231–247) does four things in order:

1. Validates locally — name non-empty, email against `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` (line 30). Errors render inline on the fields.
2. `await authProvider.signUp({ name, email })` (see §5).
3. `await offerNativeProtections()` — **this blocks navigation until both OS prompts resolve**:
   - If `hasHardwareAsync() && isEnrolledAsync()`: a `confirmDialog` ("Protect with Face ID?" / Protect / Not now). On confirm it runs a real `authenticateAsync`, and *only on success* does `setSetting('appLock', true)` — which immediately arms the `Shields` app-lock gate.
   - Then `ensureNotificationPermission()` — the real iOS sheet, honoring `canAskAgain`.
   - The whole function returns immediately when `Platform.OS === 'web'`.
4. `next()` → `router.push('/onboarding/person')`.

Failures surface as `infoDialog('Could not create the account', …)`; `busy` drives the button's `loading` state.

### 3.6 Step 2 — `app/onboarding/person.tsx` → `/onboarding/person`

Title "Who do you care for?", subline "Start with one person…", `OnboardingSteps step={2}`.

Fields: Full name (`ob-person-name`), Relationship (`ob-person-relationship`), Date of birth (`ob-person-dob`, hint "YYYY-MM-DD, optional"). Optional photo via `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })`; the URI goes into state and swaps the button for a 44 px round preview plus "Photo added" (`ob-photo-set`). A `CheckRow` carries `ATTESTATION_TEXT` from `lib/copy.ts` with `ATTESTATION_EXPLAINER` beneath it, and `ONBOARDING_DISCLAIMER` as a footnote.

The primary button's label is live: `fullName.trim() ? \`Add ${firstName}\` : 'Add person'`.

`save()` (lines 52–77): name required; `dob` validated by `isValidLocalDate` from `@rua/core` when present. The attestation is **not** an inline field error — an unchecked box fires `infoDialog('One confirmation needed', …)` and returns. Then:

```ts
const p = createPatient({
  fullName, preferredName: null, relationship: relationship || null,
  dob: dob || null, photoUri, conditions: [], allergies: [],
  attestationText: ATTESTATION_TEXT, attestationAt: nowIso(),
});
router.push(`/onboarding/uploads?patientId=${p.id}`);
```

`createPatient` (`db/repo.ts:96`) mints a `uuidv7()`, stamps `createdAt`/`updatedAt`, inserts, then `logChange('patient', id, id, 'create', { fullName })` — and `logChange` ends in `bumpDataVersion()`, which is what makes every `useData()` screen re-read. The attestation is a stored fact, not just a UI gate.

The photo is stored as the **picker's own URI**, never copied into the vault. See §4.

**Skip branch:** `PillButton "Skip"` (`ob-skip-person`) → `push('/onboarding/uploads')` with **no** `patientId`. That param is the only thread; dropping it silently degrades the next two steps to informational screens.

### 3.7 Step 3 — `app/onboarding/uploads.tsx` → `/onboarding/uploads?patientId=…`

`const patient = patientId ? getPatient(patientId) : undefined`. Two genuinely different screens.

**No patient** (you skipped step 2): one card explaining that documents attach to a person, plus `Continue` (`ob-continue-uploads`) → `/onboarding/wearables` with no param. Nothing writable.

**With patient**: subline personalized with `patient.preferredName ?? patient.fullName.split(/\s+/)[0]`. Two cards:

- *Insurance card* → `pickInsurance()` → on native, `importDocumentPhoto(patient.id, 'Insurance card', 'insurance')`.
- *Medication list or records* → `pickRecords()` → on native, `importDocumentFile(patient.id, '', 'other')`. The empty title is deliberate — `vault.ts` falls back to the picked file's own name (`title: title || asset.name`).

On native, `lib/vault.ts` `intake()` does the real work: `ensureVaultDir()` (`${documentDirectory}vault/`), a generated filename `${Date.now().toString(36)}-${random}.${ext}`, `FileSystem.copyAsync` of the bytes into the sandbox, then `addDocument({ patientId, title, category, fileName, mimeType })`. The DB row stores only the generated filename; the bytes live in the vault directory, which `destroyAllData()` deletes wholesale.

On web the same pickers run but only the row is written — `expo-file-system/legacy` is native-only. The file header at lines 15–22 is blunt that web is a Playwright surface, never real storage.

Success replaces each button with a green `StatusDot` plus the filename (`ob-insurance-done` / `ob-records-done`). Errors → `infoDialog('Could not add the document', …)`. `Continue` → `/onboarding/wearables?patientId=…`, param preserved.

### 3.8 Step 4 — `app/onboarding/wearables.tsx` → `/onboarding/wearables?patientId=…`

Same patient/no-patient split. Without a patient: an explanatory card plus `Continue`.

With a patient, `Connect the demo band` (`ob-connect-band`) runs:

```ts
setPatientWearableSource(patient.id, 'demo-band');   // settings row + bumpDataVersion
const result = await syncWearables();
setReadings(result.readings);
```

`syncWearables()` (`lib/wearables.ts:114`) walks every patient whose source is not `'none'`, computes a backfill window from `settings['wearables.lastSync.<id>']` (`BACKFILL_DAYS = 30`), generates deterministic daily summaries — same patient plus same date always yields the same numbers — and writes up to three `addVital` rows per day: `hr`/`bpm`, `steps`/`steps`, `sleep`/`min`. Each is stamped `recordedAt: '<date>T08:00:00.000Z'` and **`note: 'from band'`**. That literal string is the marker `done.tsx` counts on. `bumpDataVersion()` fires once at the end if anything was written.

The UI then shows `Connected: {n} readings arrived` (`ob-band-done`) and the `Skip` button disappears — `Skip` only renders while `readings === null`. Both `Continue` and `Skip` call `next()` → `push('/onboarding/done')`. **The `patientId` param is dropped here**, which is harmless because `done.tsx` reads the whole database.

### 3.9 Arrival — `app/onboarding/done.tsx` → `/onboarding/done`

"You are set up." / "Here is what lives in RUA now. All of it stays on this phone." It renders no step indicator; it is the fifth screen but not "step 5 of 4".

Everything reads through `useData()` so it reflects what actually landed:

- **Account** → `currentUser()?.name` or "Not created"
- **Care circle** → patient full names joined, or "No one added yet"
- **Documents** → `patients.reduce((n, p) => n + listDocuments(p.id).length, 0)` → "n in the vault"
- **Band readings** → count of vitals where `v.note === 'from band'`

Rows enter staggered with `enterRow(1..5)`. `Open RUA` (`ob-open-rua`) → `router.replace('/')`, so the wizard leaves the back stack and Home now passes the gate.

Because it is a live read of the repo rather than accumulated wizard state, this screen doubles as the flow's own smoke test: if a write silently failed, the count is wrong here.

---

## 4. Where the data goes

Two places on the phone, and nowhere else. There is no network call anywhere in this path.

### (a) One encrypted SQLite file

`db/client.ts:41` → `${FileSystem.documentDirectory}SQLite/rua.db`, i.e. `<app container>/Documents/SQLite/rua.db`, plus `rua.db-wal` and `rua.db-shm` because boot sets `PRAGMA journal_mode = WAL`. Every table — patients, medications, vitals, document *metadata*, your account record, the audit logs — is rows in that one file.

`DB_NAME = 'rua.db'` and `KEY_NAME = 'rua.db.key.v1'` (lines 26–27) were both renamed in the rebrand, which is why an old Hearth install looks empty rather than migrating.

### (b) The document vault: loose bytes, not in the database

`lib/vault.ts:14` → `VAULT_DIR = ${FileSystem.documentDirectory}vault/`. `intake()` copies the picked file there and then writes the row. So the insurance card JPEG is a plain file in the sandbox and the `documents` row carries only `title`, `category`, `file_name`, `mime_type`.

That split has a security consequence worth stating plainly: **the vault bytes are not SQLCipher-encrypted.** They are protected only by iOS Data Protection, via `apps/mobile/app.json`:

```
"com.apple.developer.default-data-protection": "NSFileProtectionCompleteUntilFirstUserAuthentication"
```

Readable once after the first unlock post-boot; unreadable from a powered-off device. Weaker than the database, which is unreadable even on a running device without the Keychain key.

(Minor drift: the schema comment at `packages/schema/src/schema.ts:257` describes vault filenames as `<id>.<ext>`; `vault.ts` actually generates `<base36-timestamp>-<random>.<ext>`. The code is right.)

### What encrypts it, and where the key is

SQLCipher is switched on by the Expo config plugin (`app.json`, `["expo-sqlite", { "useSQLCipher": true }]`). The whole mechanism is about twenty lines in `client.ts:50–72`:

```ts
const bytes = await Crypto.getRandomBytesAsync(32);              // 256 bits
await SecureStore.setItemAsync(KEY_NAME, hex, {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
});
...
raw.execSync(`PRAGMA key = "x'${key}'";`);   // MUST be the first statement
```

Three things to internalize:

- **`x'…'` is the raw-key form.** SQLCipher skips PBKDF2 entirely and uses those 32 bytes directly as the AES-256 key. There is no passphrase and no KDF in the live-database path.
- **The key lives only in the iOS Keychain** — never in the file, never in a JS constant, never in `settings`. `getDbKeyHex()` (line 157) is the only read-back, for maintenance paths.
- **`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` is the entire security posture in one constant.** `ThisDeviceOnly` excludes the item from iCloud Keychain *and* from device backups — it does not travel to a new phone under any circumstance. `AfterFirstUnlock` means background work can open the DB after a reboot-and-unlock without Face ID.

### The boot states

`bootDatabase()` (line 117) returns a `BootState` union of five kinds; `_layout.tsx` renders four Recovery variants:

| kind | meaning | what `_layout.tsx` does |
|---|---|---|
| `ready` | key and file agree | render the app; also `seedWorkflowTemplates()` |
| `db-without-key` | file present, Keychain entry gone | Recovery, "Start fresh" → `destroyAllData()` |
| `key-without-db` | key present, file gone | Recovery, "Start fresh" → `destroyAllData()` |
| `migration-failed` | migration threw; pre-migration copy restored | Recovery, "Try again", **never wipes** |
| `boot-error` | Keychain or filesystem blew up | Recovery, "Try again", **never wipes** |

**`key-without-db` is unreachable.** Lines 121–128:

```ts
const fileExists = await dbFileExists();
const key = await getOrCreateKey(!fileExists);       // createIfMissing = true when no file
if (fileExists && !key) return { kind: 'db-without-key' };
if (!fileExists && (await SecureStore.getItemAsync(KEY_NAME)) && !key) {
  return { kind: 'key-without-db' };
}
```

`getOrCreateKey` returns any existing Keychain value on its first line. So that second branch needs the Keychain to simultaneously hold a value and not hold one. It cannot fire. The real behavior of "key survived, file gone" is: reopen with the surviving key, create a fresh empty encrypted DB, migrate, land on `ready` with an empty circle — arguably the better UX, but the Recovery copy at `_layout.tsx:35–41` is dead code and you should know that before building restore flows on top of it. (The `if (!key) return { kind: 'db-without-key' }` on line 128 is unreachable for the same reason.)

### `migrateSafely` — the copy-protected upgrade

`client.ts:75–96`, in order: `PRAGMA wal_checkpoint(TRUNCATE)` so a single-file copy is complete → `copyAsync(rua.db → rua.db.premigrate)` → `migrate(db, migrationBundle)`. On success, delete the copy. On failure: close the handle, delete the live file, copy the snapshot back, delete the snapshot, rethrow.

The migrations live in `packages/schema/src/migrations.ts`, a **generated** file with SQL inlined as string constants `m0000`…`m0003`, because Metro cannot import `.sql`. Four to date: 0000 baseline, 0001 vitals/observations/timeline/labs/documents, 0002 appointments + `wf_*`, 0003 `ALTER TABLE patients ADD sex`. A test asserts the file byte-matches `packages/schema/migrations/*.sql`, so a stale regeneration fails CI.

One cosmetic wrinkle: `openEncrypted()` runs before `migrateSafely()`, and `openDatabaseSync` creates the file. So on a genuine first launch `exists` is already true and a pointless copy of an empty database is taken. Harmless, but "did we back up?" is not a signal for "was there prior data?".

### Everything written before an account exists, in one table

| Where | What | Storage |
|---|---|---|
| boot | SQLCipher key | Keychain `rua.db.key.v1` |
| step 1 signup | `{ user, rememberedToken, expiresAt }` | `settings` row `auth.local` (inside the encrypted DB) |
| step 1 signup | session token | Keychain `rua.auth.token.v1` |
| step 1 Face ID opt-in | `true` | `settings` row `appLock` |
| step 2 | patient row + `change_log` row; `photoUri` is the raw picker URI | `patients` |
| step 3 | document rows; bytes copied into `Documents/vault/` | `documents` + sandbox |
| step 4 | vitals tagged `note: 'from band'`, plus `wearables.source.<id>` / `wearables.lastSync.<id>` | `vitals`, `settings` |
| demo door | 3 patients, meds, fills, contacts, vitals, observations, timeline, labs | tables, **no account** |

Tables onboarding never touches: `medications`, `med_fills`, `contacts`, `observations`, `timeline_events`, `lab_results`, `appointments`, `access_log`. The `wf_*` family *is* populated before onboarding, by `seedWorkflowTemplates()` at boot.

### `change_log`, and why it matters more than it looks

`packages/schema/src/schema.ts:115` (with its intent comment just above). Append-only: never updated, never deleted, no `archivedAt`. Columns: `id` (uuidv7), `at`, `actor` (hardcoded `'owner'` today), `entity`, `entityId`, `patientId`, `action` ∈ create/update/archive/restore, `detail` as JSON — a snapshot for creates, a `{field: {from, to}}` diff for updates from `diff()` at `repo.ts:78`.

Four jobs, three of them already live:

1. **The consent/audit trail.** Its read-side twin is `access_log`, written by `logAccess()` for sensitive reads (`document.share:*`, `backup.export`, `er_sheet.print`).
2. **The UI invalidation signal.** `logChange()` calls `bumpDataVersion()` (`lib/events.ts`); screens subscribe through `useSyncExternalStore` in `lib/useData.ts` and re-query SQLite. Nothing is mirrored into JS state — the row is the single source of truth. This is why writing with drizzle directly instead of through the repo leaves the UI silently stale.
3. **Derived reads.** `lastTouchedAt()` (`repo.ts:282`) powers the per-person "last touched" line; `apptRepo.ts` queries it for medication changes since an instant, to build appointment prep.
4. **The future sync change feed** — stated intent in the schema comment and `ARCHITECTURE.md:169`.

Two coverage gaps before you treat it as a feed: `appendMedChangeEvent()` (`repo.ts:371`) inserts into `timeline_events` with **no** `logChange`, and `db/workflowStore.ts` contains zero `logChange` calls at all. Neither is on the pre-account path, but both would be invisible to any feed built on this table.

### If the key is lost

The data is gone. Not "hard to recover" — cryptographically gone, and that is the design, stated in the Recovery copy at `_layout.tsx:32`: the data cannot be read without the key.

Concretely how it happens: the Keychain item is `ThisDeviceOnly`, so restoring an iPhone backup to a new device brings `Documents/SQLite/rua.db` along (nothing in the codebase marks it backup-excluded) but leaves the key behind. First launch on the new phone: file exists, `getOrCreateKey(false)` returns null → `db-without-key` → the only offered action is `destroyAllData()`, which deletes the DB, its `-wal`/`-shm`, the entire `vault/` directory, and the Keychain entry (`client.ts:170`).

**The one escape hatch is `lib/backup.ts`, and it is not wired into onboarding at all** — it lives in Settings. `exportBackup(passphrase)` does the canonical SQLCipher move: checkpoint, `ATTACH DATABASE '<dest>' AS backup KEY '<passphrase>'`, `SELECT sqlcipher_export('backup')`, detach, share sheet. The exported `.ruabackup` is keyed to something the caregiver *knows* — so PBKDF2 does apply there, unlike the live DB — which is exactly what makes it device-portable. `importBackup` reverses it: stage the file, `PRAGMA key` and probe `sqlite_master` (a wrong passphrase surfaces as "file is not a database"), `closeDb()`, delete the live file, `sqlcipher_export('live')` into a fresh DB keyed with *this* device's Keychain key, then `bootDatabase()` again to roll forward newer migrations.

Two caveats on that hatch: the passphrase floor is 8 characters (`validPassphrase`, `backup.ts:24`), and **the backup contains only the database — `vault/` files are not included.** A restore rebuilds every `documents` row pointing at bytes that do not exist on the new phone.

---

## 5. What "account" means today

`apps/mobile/src/lib/auth.ts`, 194 lines, entirely device-local, deliberately shaped as a drop-in for Clerk (`TODO(clerk)` at line 134).

**Storage.** One `settings` row, `auth.local`, holding `{ user: { id: uuidv7(), name, email }, rememberedToken, expiresAt }` — i.e. *the account is a JSON row inside the encrypted SQLite database*. The current token also goes to the Keychain under `rua.auth.token.v1` with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (`localStorage` on web).

**Tokens.** 24 random bytes as hex from `Crypto.getRandomBytesAsync`, `TOKEN_TTL_MINUTES = 30`. There is no password, no verification, no server. `signIn` only checks that the email matches the one already on the device.

**Synchronous reads.** `hasAccount()` and `currentUser()` are plain synchronous reads of that row, which is why the Home gate and `welcome.tsx` can call them inline during render. Callers: `_layout.tsx`, `welcome.tsx`, `(tabs)/index.tsx`, `onboarding/index.tsx`, `onboarding/done.tsx`. That is the complete list.

**The silent re-login.** `ensureFreshSession()` (lines 174–194): unexpired and token matches `rememberedToken` → `active`; otherwise `biometricGate()` → `authProvider.refresh(token)`, which exchanges the *remembered* token even after expiry, mirroring Clerk's `getToken()`. Failed biometric → `locked`. Unrecognized token → `signed-out`. `biometricGate()` returns `true` when there is no Face ID hardware or enrollment, so nobody is locked out of their own device. Only `_layout.tsx` calls this, on foreground, and only when `hasAccount()`.

**Two functions in this file are unreachable from the app.** Grepping all of `apps/mobile/src` outside `lib/auth.ts` finds zero callers of `authProvider.signOut()` and zero of `.signIn(...)`. There is no sign-out UI and no returning-device sign-in screen — step 1's returning branch just reads `currentUser()` and continues. The only way to leave the local account today is the Settings wipe (`destroyAllData`).

### The seam a real provider slots into

```ts
export interface AuthProvider {
  signUp(input: { name: string; email: string }): Promise<AuthSession>;
  signIn(input: { email: string }): Promise<AuthSession>;
  refresh(oldToken: string): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}
export const authProvider: AuthProvider = new LocalAuthProvider();
```

That single `authProvider` export is the seam. Everything above it — the onboarding form, the silent refresh, the Face ID gate — consumes the interface and nothing else. `TODO.md` line 45 spells out the intended swap: implement `ClerkAuthProvider`, make `refresh` become `session.getToken({ skipCache: true })`, delete the local minting, change the one export.

What that swap does *not* solve: the moment a server exists, `settings['auth.local']` stops being the account of record and becomes a cache, and every place that reads it synchronously during render (`hasAccount()` in the Home redirect, in `welcome.tsx`) has to tolerate an async, possibly-stale, possibly-signed-out answer. The current code has no loading state for "we don't know yet whether you're signed in."

Also note the roadmap has *not* settled Clerk versus Supabase Auth (`TODO.md` line 60): Supabase pairs with the PowerSync + Postgres RLS choice in `ROADMAP.md:16`; Clerk is a second vendor with nicer prebuilt UI. Sign in with Apple is mandatory either way.

---

## 6. What is tested, and what is not

### The three surfaces

| Surface | Files | When it runs | Reality |
|---|---|---|---|
| Jest unit/component | 274 `it`/`test` cases across 25 test files in `packages/*` and `apps/mobile/src/**/__tests__` | every push and PR (`.github/workflows/ci.yml`, jobs `test` and `core-safety`) | green, cheap, **and touches none of the pre-account code** |
| Playwright (Expo web export) | 17 tests across 6 spec files in `e2e/specs` | every push and PR (`.github/workflows/e2e-web.yml`) | the only real regression net for onboarding |
| Maestro (iOS simulator) | 5 flows in `.maestro` | **`workflow_dispatch` only** (`.github/workflows/e2e-ios.yml`) | effectively not running |

Doc-versus-reality mismatches, since you will read these files:

- `TODO.md:3` claims "290 unit/component tests plus 14 Playwright E2E specs". Actual: 274 unit/component cases, 17 Playwright tests in 6 spec files.
- `.github/workflows/e2e-ios.yml` contradicts itself: the cost note at the top says it "runs weekly and on demand", four lines later another comment says "so no schedule", and the `on:` block contains only `workflow_dispatch`. `TODO.md:82` repeats the "weekly" claim. There is no schedule. Combined with `TODO.md:23` (the full local Maestro pass is blocked by a wedged CoreSimulator), **the native onboarding flow has never been verified green end-to-end by any automation.**

### What genuinely is covered

`e2e/specs/07-onboarding.spec.ts` — one test, and it is the single most valuable asset in this area. On the web export it covers:

1. **The threshold ritual** — asserts "Press and hold to begin", grabs `threshold-sphere`, and does a real `mouse.down` → `waitForTimeout(3600)` → `mouse.up`. The RAF loop, the ring fill, the `entered` latch, and bloom → `onEnter` all actually execute.
2. **Account creation** — fills `ob-name`/`ob-email`, presses `ob-create`, which runs `authProvider.signUp()` for real (settings row + token write).
3. **First person** — name, relationship, DOB, a real photo through the file chooser, the attestation checkbox, the `createPatient` write.
4. **Papers** — an inline 1×1 PNG and a minimal PDF through both pickers; asserts the filename reads back off the created `DocumentRow`.
5. **Demo band** — presses `ob-connect-band`, asserts "N readings", so `syncWearables()` and the generator really ran and wrote vitals.
6. **Arrival** — `done.tsx` reads back account name, person name, "2 in the vault", the reading count; then `Open RUA` and the dashboard renders.

That is a true round trip: input → SQLite → read back on a different screen. It would catch a broken repo write, a broken step transition, or a broken arrival summary.

Supporting: `e2e/specs/00-smoke.spec.ts` (boots to threshold/empty/dashboard, and **zero console errors on load**); `e2e/specs/helpers.ts` `seedDemo()`, which repeats the hold ritual and takes the `ob-demo` door for four other specs; and `packages/schema/src/__tests__/` — `migrations.test.ts`, `durability.test.ts` (copy-restore around a failing migration), `downgrade.test.ts`, `seed.test.ts` — which protect the schema layer onboarding writes into. `scripts/guardrails.sh` runs in CI: no `console.log` in app source, no PII interpolated into routes, generic notification payload text.

### `.maestro/03-onboarding.yaml` is weaker than it looks

- **It never performs the hold.** It waits for "Press and hold to begin" and then fires `openLink: rua:///welcome?enter=1` — the `__DEV__` bypass in `welcome.tsx`. Every Maestro flow does this. The actual door has never been opened by native automation.
- It skips the photo picker entirely.
- On uploads it only asserts the "Insurance card" card is visible and taps Continue. It never taps `ob-upload-insurance` or `ob-upload-records`, so **the native vault byte-copy path is invoked by nothing, ever**.
- Face ID and notifications are wrapped in `when: visible` conditionals ("Not now" / "Allow"). On a simulator with no Face ID enrolled and notifications pre-granted in `launchApp`, both evaluate false and silently skip. A pass proves nothing about either.
- It taps "Create account" up to three times behind conditionals, with a comment blaming the auto-advancing carousel for invalidating the view tree mid-tap. That is a sign the flow is flaky, not that the app is verified — and it points at a real risk in `HeroCarousel`'s `setInterval`.

### Untested, bluntly

1. **`lib/auth.ts` — 194 lines, zero unit tests, and it is the file you are about to replace.** No test file imports it; its only execution anywhere is `signUp()` on the web path in the Playwright spec. Uncovered: token expiry → `isExpired()` → the entire silent-refresh branch; `refresh(oldToken)`'s remembered-token contract and its `null` return (the exact contract you would pin Clerk against); `signIn()` with a non-matching email; `signOut()`; `hasAccount()`/`currentUser()`; the whole `ensureFreshSession()` state machine, especially the desync at line 181 where the Keychain token no longer equals `stored.rememberedToken`; and all the `SecureStore` branches of `storeToken`/`readToken`/`clearToken`. Worse, `biometricGate()` returns `true` unconditionally on web (line 157), so the only surface CI runs hardcodes the Face ID path to pass. `apps/mobile/jest.setup.js` already mocks `expo-secure-store` — the harness exists; nobody wrote the tests.
2. **`db/client.ts` — the boot state machine, untested.** Only `ready` is ever produced, and only via `bootWeb()` (sql.js). Untested: all four non-ready states, the SQLCipher `PRAGMA key` open, `getOrCreateKey`'s `createIfMissing` logic, `migrateSafely`'s copy/restore, `destroyAllData`. `packages/schema/src/__tests__/durability.test.ts` tests the same *idea* against better-sqlite3 but imports none of this code.
3. **The Recovery screen and its wipe guard (`_layout.tsx:26–61`, `:141–160`).** Four copy branches and one data-destroying decision, all uncovered. Line 148 is the branch that must never fire on a transient failure. A regression there silently deletes a caregiver's data. Maestro's `when: visible: 'Start fresh'` is opportunistic cleanup, not an assertion — it never checks which state produced the screen.
4. **Persistence across relaunch — structurally impossible to test today.** `db/webdb.web.ts` is in-memory per page load, so Playwright can never assert that entered data survives a restart, and every Maestro flow opens with `clearState: true`. **Nothing anywhere asserts that completing onboarding and killing the app leaves your account and your person still there.** For a local-first app, that is the gap to close first.
5. **The returning-account branch never runs.** `welcome.tsx:29`'s `'/'` leg and `ob-continue-account` in `onboarding/index.tsx` are dead in the test suite — Maestro's own comment says "fresh runs never render this id".
6. **Every validation branch.** No test asserts that an empty name, an email failing `EMAIL_RE`, a malformed DOB, or an unchecked attestation blocks progress. The attestation gate is a compliance control; the E2E ticks the box and moves on, and nobody proves it stops you.
7. **Both skip paths.** `ob-skip-person` and `ob-skip-wearables` appear in zero tests and zero flows, so the entire "no patient yet" variant of `uploads.tsx` and `wearables.tsx` — different copy, different button, different routing — has never been rendered by automation.
8. **`lib/vault.ts`.** Playwright only takes the `Platform.OS === 'web'` branch of `uploads.tsx`, which writes a row and no file. `importDocumentPhoto`/`importDocumentFile` — the actual product behavior — is executed by nothing.
9. **`offerNativeProtections()`.** Returns immediately on web, conditionally skipped in Maestro. The `setSetting('appLock', true)` write and the notification permission call are untested.
10. **`lib/wearables.ts`.** The deterministic generator has no unit test; only the rendered string "N readings" is asserted end to end.
11. **`ThresholdSphere` beyond the happy hold.** The VoiceOver `activate` action — the only way a screen-reader user gets in — plus Reduce Motion, early-release drain, and the haptic ladder are all uncovered. Haptics and the glass disc are gated on `Platform.OS !== 'web'` / `liquidGlassAvailable()`, so CI never reaches them.
12. **`lib/reboot.ts`.** 19 lines, no test; it is what prevents "Database accessed before bootDatabase() completed" after a wipe.

### Related open items already in `TODO.md`

Line 12 — branch protection needs GitHub Pro on a private repo, so **a red E2E does not block a merge today**. Line 23 — the full local Maestro pass is still blocked. Line 24 — known simulator flakiness: below-the-fold elements drop out of the accessibility snapshot (kAXError -25218). Line 30 — the `HOSPITAL_BASEMENT.md` airplane-mode pass is not done. Line 31 — the manual VoiceOver run (P17 gate) is not done. Line 32 — Face ID on a physical device is unverified (the simulator fakes it, web hardcodes it). Line 40 — no Sentry DSN, so a boot failure in the wild is invisible to you. Line 45 — Clerk swap not done. Line 56 — insurance is a vault photo only; structured member-id fields deliberately deferred. Line 60 — accounts stay device-local by design until P29, and the Supabase-vs-Clerk decision is open.

---

## 7. Open questions to decide before the backend

Ordered roughly by how expensive they get if you decide them late.

**1. Identity does not exist in the data model.** There is no `user_id`, `owner_id`, or `circle_id` on any table. Everything is scoped to `patient_id`, and the account is a JSON blob in a `settings` row. Sync buckets and Postgres RLS need a real tenant column on every syncable table — a new migration touching `patients`, `medications`, `med_fills`, `contacts`, `vitals`, `observations`, `timeline_events`, `lab_results`, `documents`, `appointments`. Decide what the tenant *is* (a user? a care circle?) before you write it, because that choice is the sharing model.

**2. What does the demo family become?** It writes real rows into the same tables with no flag and no partition, and it creates patients **without an account**, which permanently disables the threshold and leaves `currentUser()` null on Home (the greeting falls back to no name). When accounts are real: does demo data backfill into the new account, get discarded at signup, or get a `is_demo` column? Today there is nothing to distinguish it.

**3. What is the first-run gate once accounts exist?** `hasAccount() || patients.length > 0` is currently the whole thing, evaluated synchronously during Home's render. With a server, "do I have an account" becomes asynchronous and can be *unknown*. You need a third state and a screen for it, plus a real completion flag if you want to resume an abandoned wizard — right now nothing records which step someone quit on.

**4. What happens to `db-without-key` when a server holds a copy?** Today that state's only offered action is `destroyAllData()`. The moment the server is authoritative, "your key is gone, so let's delete everything local" is actively wrong — it should be "re-download". And `key-without-db` is currently unreachable dead code (§4), so do not build restore logic on top of it without fixing the branch first.

**5. `change_log` is a change feed with no watermark.** No `synced_at`, no `device_id`, no server sequence number, and `actor` is hardcoded `'owner'` at every call site. Before it can drive replication it needs bookkeeping columns — and the two bypasses (`appendMedChangeEvent` at `repo.ts:371`, and all of `workflowStore.ts`) need closing or those rows will never replicate.

**6. Vault bytes need their own story.** SQLCipher and PowerSync both operate on the database; `vault/*.jpg` is outside both. Document sync means object storage plus either a per-file server key or client-side envelope encryption — genuinely new code, not a schema change. The same gap already bites `backup.ts` today: a restored backup has document rows pointing at bytes that do not exist.

**7. Two encryption boundaries collide.** The entire current design rests on the key never leaving the Keychain. A server holding plaintext is a different threat model, and it is the moment the privacy label flips from "Data Not Collected" (`ARCHITECTURE.md:159`) to Health & Fitness linked to identity. `ROADMAP.md` correctly ties that to the same phase as in-app account deletion (Apple guideline 5.1.1(v)).

**8. Conflict policy is chosen but not implemented.** The roadmap specifies last-writer-wins per column for notes and observations, strictly append-only for `med_fills` and audit rows, and a human review card for conflicting medication edits. Nothing in `repo.ts` enforces column-level anything today — `updateMedication` does a whole-row `set`.

**9. `patients.photo_uri` is a dangling pointer.** `person.tsx:46` stores the raw `ImagePicker` asset URI and passes it straight to `createPatient`; unlike documents it is never copied into `vault/`. `expo-image-picker` writes into the app's Caches directory, which iOS may purge under storage pressure and whose container path is not stable across reinstall or restore. Grep confirms `photoUri` is read nowhere except the preview `<Image>` on that same screen. Route it through `vault.ts` `intake()` before you build any UI on it — and certainly before you try to sync it.

**10. There is no way out of the account.** `signOut()` and `signIn()` have zero callers. Before a backend ships you need a real sign-out (which must decide what happens to local data), a returning-device sign-in, and in-app account deletion for guideline 5.1.1(v).

### Cheap fixes worth doing first

- Unit-test `lib/auth.ts` against the `expo-secure-store` mock that already exists in `jest.setup.js` — specifically expiry, `refresh` returning `null`, and the `locked` state. It is the contract you are about to swap a vendor into.
- Add a relaunch-persistence test (a Maestro flow without `clearState`, at minimum). Nothing today proves data survives a restart.
- Cover the `_layout.tsx:148` wipe guard. It is the one untested branch that can destroy a user's data.
- Free cleanups while you are in there: fix the off-by-one step numbers in the four onboarding docstrings, delete the "parent screen always offers a plain alternative button" claim in `ThresholdSphere.tsx`, correct the `TODO.md:3` test counts, and either add a schedule to `e2e-ios.yml` or fix the comment that claims it has one.

---

## Notes on this document's sources

Three independent traces of the codebase were reconciled against the working tree for this document. Where they disagreed or overstated:

- One trace described `Recovery` as covering "five states". The `BootState` union has five kinds, one of which is `ready`; `Recovery` has four copy branches. Corrected above.
- One trace called `done.tsx` "step 5". It renders no `OnboardingSteps` indicator at all — it is the fifth screen of a four-step wizard. Corrected.
- Playwright counts differed (17 vs 18). Verified: 17 top-level `test(` calls across 6 spec files.
- On `e2e-ios.yml`, one trace said the header comment claims a weekly schedule and there is none. Both are true simultaneously — the file contains one comment claiming weekly and another saying "no schedule". Stated as such above.

Every file path cited here was confirmed to exist at the time of writing.
