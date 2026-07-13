# Hearth (native)

A caregiver-first command center for coordinating care across multiple older adults.
React Native (Expo) iOS app, built phase by phase; see ROADMAP.md.

- `apps/mobile` - the Expo app (expo-router, SQLCipher-encrypted SQLite, Drizzle)
- `packages/core` - the deterministic engine: runway math, digest selector, notification planner (pure TS, no React)
- `packages/schema` - Drizzle schema, generated migrations, demo seed, audit helpers
- `packages/label-parser` - deterministic prescription-label field parser (P3 spike)
- `spike/ocr` - Apple Vision OCR feasibility spike and corpus
- `docs/compliance` - consent, disclaimer, and privacy framework (P4)

All people and records in the demo data are fictional.
