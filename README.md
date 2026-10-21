# RUA (native)

> **Write-up:** [Building RUA, an Offline-First Caregiver App With Provable Math](https://anirudhvasudevan.com/blog/rua-caregiver-app-offline-first/), the architecture, decisions and lessons. Built by [Anirudh Vasudevan](https://anirudhvasudevan.com/).

A caregiver-first command center for coordinating care across multiple older adults.
React Native (Expo) iOS app, built phase by phase; see ROADMAP.md.

- `apps/mobile` - the Expo app (expo-router, SQLCipher-encrypted SQLite, Drizzle)
- `packages/core` - the deterministic engine: runway math, digest selector, notification planner (pure TS, no React)
- `packages/schema` - Drizzle schema, generated migrations, demo seed, audit helpers
- `packages/label-parser` - deterministic prescription-label field parser (P3 spike)
- `spike/ocr` - Apple Vision OCR feasibility spike and corpus
- `docs/compliance` - consent, disclaimer, and privacy framework (P4)

All people and records in the demo data are fictional.

## Running the app yourself

Daily use (the app is already built on the simulator):

    cd apps/mobile
    npx expo start

Then press `i` in that terminal: the iPhone simulator boots, RUA opens,
and connects to the dev server. Press `r` to reload, Ctrl-C to stop.

First time on a machine, or after adding a NATIVE dependency:

    cd apps/mobile
    export LANG=en_US.UTF-8   # CocoaPods needs a UTF-8 locale
    npx expo run:ios

That compiles and installs the native app (about 5-10 minutes). Everyday
JavaScript changes never need it; `expo start` is enough.

Extras:
- See onboarding again: Settings -> Delete everything inside the app (or
  remove the app from the simulator and run `expo run:ios` once).
- Web version: `npx expo start`, then press `w` (test surface, not the
  product; iOS keeps the encrypted database).
- Local E2E: `./scripts/e2e-local.sh` from the repo root (Maestro flows
  against the simulator); the Playwright suite runs in CI on every push.
