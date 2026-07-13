# Hearth Consent and Compliance Framework

| | |
|---|---|
| Status | Adopted (Phase 4 spike output) |
| Date | 2026-07-12 |
| Owner | Anirudh Vasudevan |
| Implemented by | Phase 5 (attestation), Phase 19 (compliance gate), Phase 31 (respite mode); Phases 29, 30, and 32 inherit obligations noted below |
| Companion | `docs/compliance/attestation-and-disclaimers.ts-content.md` (verbatim shipped strings) |
| Review cadence | Re-read at every release gate (P9, P19, P20, P23, P24, P28, P29, P31, P32) and whenever a feature touches health data, sharing, or marketing copy |

This is the decision document for how Hearth handles another person's health information. Hearth's user is a family caregiver; the data subject is usually someone else (a parent, an aunt). That asymmetry is the central legal and ethical fact of the product, and every rule below exists because of it.

Nothing in this document is legal advice. It is an engineering-facing compliance posture, written to be conservative, and it should be reviewed by counsel before the first external distribution (Phase 19) and again before the first server feature (Phase 29).

---

## 1. Legal posture

### 1.1 HIPAA: Hearth is not a covered entity, and we never claim to be

HIPAA applies to covered entities (health plans, healthcare clearinghouses, and providers who conduct standard electronic transactions) and to their business associates. Hearth is a direct-to-consumer tool sold to family caregivers. It receives no data from a covered entity on a covered entity's behalf, bills no payer, and signs no business associate agreement in its local-first era. It is therefore typically not regulated by HIPAA at all.

Two consequences, both binding:

1. We never write "HIPAA compliant" anywhere: not in the app, not in App Store metadata, not on the marketing site, not in investor or prize materials. For a non-covered entity the claim is meaningless, and the FTC has treated compliance-adjacent claims by non-covered entities as deceptive (see 1.5). The permitted phrasing is factual: "your data is encrypted on your device" or "we follow the security practices described in our privacy policy."
2. Not being HIPAA-regulated does not mean unregulated. The rules that actually bind Hearth are the FTC Health Breach Notification Rule (1.2), Washington's My Health My Data Act (1.3), California's CMIA (1.4), the FTC Act's deception standard (1.5), general state breach-notification statutes, and Apple's App Review Guidelines (Section 9). This posture, "not HIPAA, still heavily obligated," is the frame for every decision below.

Exception path: if Hearth ever integrates with a provider or plan on their behalf (for example, an EHR integration operated for a clinic), Hearth becomes a business associate for that data flow and this section must be rewritten before that feature ships. The Phase 32 LLM proxy is planned on an Anthropic zero-data-retention arrangement with a BAA available, which is a defensive posture, not a HIPAA obligation.

### 1.2 FTC Health Breach Notification Rule (16 CFR Part 318)

The HBNR covers vendors of personal health records that are not HIPAA covered entities. Under the FTC's 2021 policy statement and the amended rule effective July 2024, a consumer health app that maintains identifiable health information drawn from multiple sources (user entry, camera capture of labels and documents, device APIs) is a PHR vendor. Hearth should assume it is covered from its first external tester.

Key features of the amended rule that shape our plan:

- "Breach of security" is not limited to hacking. It includes any unauthorized acquisition of identifiable health information, including a voluntary but unauthorized disclosure, for example sharing health data with an advertising SDK without authorization. Hearth's no-trackers, no-analytics-on-health-data posture (Section 7) is the primary control.
- Individuals must be notified without unreasonable delay and in no case later than 60 calendar days after discovery of a breach. The clock starts on the first day the breach is known or reasonably should have been known.
- For breaches involving 500 or more individuals, the FTC must be notified at the same time as individuals. For fewer than 500, a log is submitted annually within 60 days after the end of the calendar year. Breaches affecting 500 or more residents of a state also require media notice.
- Violations are treated as unfair or deceptive acts with civil penalties assessed per violation per day.

The written incident-response plan required by this rule is Section 2 of this document.

Local-first note: while Hearth holds no server copy, the realistic breach surfaces are a lost or stolen device and a compromised user-initiated export. The on-device database is SQLCipher-encrypted with the key in the iOS Keychain (Phase 1), so acquisition of the device or the database file without the key does not expose readable health information. This does not exempt us from the rule; it makes the "was identifiable health information actually acquired?" analysis in Section 2 usually resolve to no.

### 1.3 Washington My Health My Data Act (chapter 19.373 RCW)

MHMD is the strictest consumer-health privacy law in the country, it has a private right of action through Washington's Consumer Protection Act, and it has no meaningful volume threshold. It attaches, practically, at the first Washington tester. TestFlight distribution reaches Washington, so Phase 19 is the deadline, and the controls are cheap to build earlier, so we build them from Phase 1.

What it requires of Hearth:

- A standalone Consumer Health Data Privacy Policy, separate and distinct from any general privacy policy, with its own link on the marketing site homepage. It must list the categories of consumer health data collected, purposes, sources, categories shared, and third parties and affiliates receiving data. Section 7 is that policy, drafted for the local-first era. Phase 19 puts it at a public URL.
- Prior opt-in consent to collect or share consumer health data beyond what is necessary to provide a product or service the consumer requested. In the local-first era, everything Hearth stores is data the caregiver deliberately typed or captured in order to use the product, and nothing is shared, so the requested-service ground covers processing; the policy still says exactly this. Any future purpose (sync, AI) requires new, separate consent before first use (Phases 29 and 32 already plan this).
- Selling consumer health data requires a separate, signed, time-limited authorization. Hearth's answer is simpler: we never sell consumer health data, stated flatly in the policy.
- Consumer rights: confirm and access data (including third parties it was shared with), withdraw consent, and delete, with deletion propagating to affiliates, processors, and third parties, and to archives and backups on their cycle. Locally this is satisfied by in-app edit, the full data wipe (Phase 19), and the fact that no third party ever holds a copy. Once a server exists (Phase 29), deletion must verifiably purge server data and propagate to processors, which is already a Phase 29 exit criterion.
- No geofencing around health facilities. Hearth requests no location permission in v1 and never geofences; the transport feature (Phase 24) uses deep links with no PII and no location capture.

MHMD nuance specific to Hearth: "consumer health data" here belongs to the person the data describes, usually the elder, not only the caregiver holding the phone. The caregiver-authority attestation (Section 3) is our control for the lawful-basis question of processing a third party's health data at that person's (or their representative's) direction.

### 1.4 California CMIA section 56.06: Hearth is deemed a provider of health care

Civil Code section 56.06(b) provides that any business offering software or hardware to consumers, including a mobile application, designed to maintain medical information in order to make it available to the individual or a provider of health care, for purposes of allowing the user to manage their information or for diagnosis and treatment, is deemed a provider of health care for the purposes of CMIA's confidentiality obligations. Hearth is squarely inside this definition, and this attaches at roughly the first California tester.

What being a deemed provider means in practice:

- CMIA's confidentiality duties apply: no disclosure of medical information without a valid authorization, and an affirmative duty to preserve confidentiality. CMIA authorizes nominal damages of 1,000 dollars per violation without proof of actual harm, plus actual damages and administrative penalties, so a single sloppy disclosure is expensive.
- Design consequences Hearth already carries: encryption at rest by construction (Phase 1), no health data in logs, URLs, notification payloads, or crash reports (Phase 8, Phase 9, Phase 18), user-initiated sharing only (Phase 14 print and share flows), per-category scoped sharing with logging when multi-caregiver sharing arrives (Section 5, Phase 31).
- The caregiver-authority attestation (Section 3) documents that the person entering another adult's medical information affirms permission or authority to do so, which is the honest answer to "who authorized Hearth to maintain this person's medical information?"

### 1.5 FTC Act section 5: the deception standard governs every claim we make

The FTC's health-app enforcement (GoodRx, BetterHelp, Premom, Cerebral) establishes that marketing and privacy-policy claims about health data are strictly held: say "we never share your data" and then use an analytics SDK, and that is a deceptive practice regardless of HIPAA status. Rules Hearth adopts:

- Every public claim about data handling must be literally true of the shipped build. The privacy policy, the App Store privacy label, and the actual binary are audited together at every release gate (Phase 18 checklist, Phase 19 audit).
- Health-benefit claims are out of bounds. Marketing says Hearth "helps you stay organized"; it never says Hearth "prevents medication errors," "improves adherence," or "keeps your parents safe." Anything that sounds like a measurable health outcome requires substantiation we do not have and do not want to imply. The intended-use statement (Section 6.2) is the copy filter.
- No "HIPAA compliant" claims (see 1.1), and no compliance seals or badges we cannot document.

### 1.6 FDA software-function line, stated once

Hearth is designed to remain outside the FDA device definition under FD&C Act section 520(o) (21st Century Cures Act): it is administrative and organizational software that stores, transfers, and displays health information a user entered, plus general wellness content. The features that would cross the line, and which Hearth therefore never builds without a regulatory strategy, are: computing or recommending doses, interpreting vitals or labs to produce a diagnosis or alarm, triage recommendations, and treatment suggestions. The runway engine is inventory arithmetic (fill date plus day supply, `packages/core/src/runway.ts`); the high-alert badge (`packages/core/src/highAlert.ts`) prompts extra confirmation at data entry and never blocks or directs care; emergency guides are static, clinician-reviewed, general first-aid content. The intended-use statement (Section 6.2) is how this line is enforced feature by feature.

---

## 2. Incident-response plan (the 60-day clock)

This is the written plan required by the FTC Health Breach Notification Rule. It is deliberately short so that it is actually followed. Solo-dev reality: one person plays every role; the value of the plan is the checklist and the clock.

### 2.1 Definitions

- Security incident: any event where health data may have been exposed to someone not authorized to see it. Examples: a lost unlocked device reported by a tester, an export emailed to the wrong recipient, a dependency compromise, a future server misconfiguration, disclosure to a third-party SDK that should not receive health data.
- Breach of security (HBNR): unauthorized acquisition of unsecured, identifiable health information in a personal health record. Includes unauthorized voluntary disclosures. Encrypted data acquired without its key has not been meaningfully "acquired" for this analysis, which is why SQLCipher-at-rest is our first-line control.
- Discovery: the first day the incident is known, or reasonably should have been known. The 60-day clock starts here, not when the investigation ends.

### 2.2 Response steps

1. Record discovery. Open an incident note with the discovery date and time, what is known, and who reported it. This timestamp anchors every deadline.
2. Contain within 24 hours. Depending on the vector: instruct the user on remote wipe (Find My), revoke tokens or invites, disable the affected feature via release, rotate keys, take a server offline. In the local-first era, containment is usually user-device guidance.
3. Assess within 5 days. Answer in writing: What data elements were involved? How many individuals (count both caregivers and the people whose records they hold)? Was the data encrypted, and did the key travel with it? Was there actual acquisition by an unauthorized party, or only exposure? Which states are the affected individuals in?
4. Classify. If unauthorized acquisition of identifiable health information occurred, it is an HBNR breach and notification duties fire. If not (for example, an encrypted database file with no key), record the reasoning in the incident note and skip to step 8. When in doubt, treat it as a breach.
5. Notify individuals. Without unreasonable delay, and never later than 60 calendar days after discovery. Plain-language notice: what happened, what data was involved, what we have done, what the individual can do, whether the data was encrypted, what third party acquired it if known, and a contact channel. Email is the expected medium for a D2C app.
6. Notify the FTC. 500 or more individuals: at the same time as individual notices, via the FTC's reporting portal. Fewer than 500: enter it in the annual log, submitted within 60 days after the calendar year ends.
7. Notify media and states as applicable. 500 or more residents of one state triggers HBNR media notice. Separately, check the general breach statutes of each affected individual's state (all 50 states have one; several require attorney-general notice). California individuals also trigger CMIA analysis, and Washington individuals trigger MHMD and RCW 19.255 analysis.
8. Post-incident review within 14 days of closing. What control failed, what changes ship, and an update to this plan if it was wrong. The incident note is retained permanently.

### 2.3 Standing preparations

- This plan lives in the repo and is re-read at every release gate.
- The privacy policy names a monitored contact address for security reports.
- The access log and change log (`access_log`, `change_log` tables, Phase 1) exist partly so an assessment in step 3 has evidence to work from.
- Once a server exists (Phase 29): server logging must be sufficient to answer step 3 within 5 days, and processor contracts (Supabase, Anthropic) must obligate prompt breach notice to us; their notice starts our clock.

---

## 3. Caregiver-authority attestation

### 3.1 Why it exists

Hearth's caregiver enters another adult's medical information. CMIA deems us a provider of health care maintaining that information (1.4), MHMD gives the data subject rights over it (1.3), and basic ethics says the elder is a person, not a record. Hearth cannot verify a power of attorney from an app screen, and pretending to would be theater. What we can honestly do is: require an explicit, recorded affirmation of authority or permission at the moment a person is added; explain in plain English why we ask; and keep the affirmation with a timestamp so it is auditable later.

The attestation is a consent-posture control and an honesty control. It does not create legal authority the caregiver lacks, and this document never claims it does.

### 3.2 Exact shipped copy

These strings are frozen by this document and duplicated verbatim in the companion appendix. Engineering copies them exactly; any edit requires updating this document first.

Checkbox label (`attestation.checkbox.v1`):

> I confirm that I am a caregiver for this person, and that I have their permission or the legal authority (for example, healthcare power of attorney or guardianship) to record and manage their health information in Hearth.

Plain-English explainer, shown directly above the checkbox (`attestation.explainer.v1`):

> Hearth keeps health information about the person you care for, such as medications and allergies, on this device. That information is theirs. Before adding it, please confirm they have agreed, or that you have the authority to act for them. If they are able to take part in this decision, talk with them first. You can review or remove everything you add at any time.

### 3.3 Behavior and storage

- The checkbox is unchecked by default and required: the add-patient flow cannot complete without it. There is no "skip."
- On save, the app stores the verbatim string that was displayed in `patients.attestation_text` and the ISO-8601 UTC instant in `patients.attestation_at` (both columns exist in the frozen Phase 1 schema, `packages/schema/src/schema.ts`). Storing the text itself, not a boolean, means a future copy revision is self-versioning: the record shows exactly what the caregiver affirmed.
- The attestation is per patient. Adding a second person prompts a second attestation.
- The patient detail screen shows, under an "About this record" row, the date the attestation was made, so the caregiver can see it later.
- If the copy is ever revised (v2), existing records keep their v1 text; re-attestation is only prompted if the meaning materially changes, and that decision is recorded here.
- Edge case, deceased or fully incapacitated person: the explainer's "if they are able to take part" phrasing deliberately covers the common case where the elder cannot meaningfully consent; the caregiver affirms authority instead. We do not collect documentation.
- Edge case, self-care: a user adding themselves is attesting to managing their own information, which the checkbox text still reads correctly for ("I am a caregiver for this person" includes self-care; no special-case copy in v1).

---

## 4. Per-category consent scopes and the access-log commitment

### 4.1 Scope model

All future sharing (Phase 31 invites and respite mode, and anything after) is expressed in exactly four consent scopes, fixed here so that schema, RLS policies, and UI never invent finer or vaguer categories ad hoc:

| Scope | Covers | Examples |
|---|---|---|
| `meds` | Medication list, fills, runway status, high-alert flags | "Rosa's levothyroxine, last filled June 30, 12 days left" |
| `vitals` | Structured measurements and their charts | BP, weight, glucose, O2, temperature readings |
| `documents` | Documents-vault items | Insurance card scans, POLST, discharge papers |
| `notes` | Free-text observations and caregiver notes | "Poor appetite this week", timeline notes |

Rules:

- Default deny. A grant enumerates scopes; anything not listed is invisible. There is no "all access" shortcut in the UI; selecting all four is a deliberate act of four choices.
- Grants are per patient, per grantee, per scope. Sharing Dad's meds says nothing about Mom's, and nothing about Dad's documents.
- Safety floor, disclosed, not optional: any grant at all also exposes the patient's name, photo, allergies, and emergency contacts, because a helper acting without allergy knowledge is a physical danger. The invite screen states this explicitly before the owner sends it.
- Scopes gate writes as narrowly as reads. A `meds` grantee can record a fill; they cannot add an observation (`notes`) or upload a document.
- Enforcement is server-side (Postgres RLS keyed to grant rows) from the day sharing exists (Phase 31). Client-side hiding is UI politeness, never the security boundary.

### 4.2 The access-log commitment

Hearth commits to this, in the privacy policy and in the product: every access to a person's health information by anyone other than the record owner is logged, and the log is reviewable by the owner.

- The `access_log` table (Phase 1 schema: `at`, `actor`, `what`, `patient_id`) is append-only and exists before there is anything to share, capturing sensitive local events first (ER-sheet print, backup export).
- Phase 19 surfaces the local log in Settings, read-only, newest first, in plain language ("You printed Robert's ER sheet, July 3, 2:14 PM").
- Phase 31 extends the same table shape to shared access, synced: every view or change by an invited caregiver writes an entry the owner can read ("Maria viewed Eleanor's medications, today, 9:02 AM").
- Log entries are never edited or deleted by any app flow. The only path that removes them is the full local data wipe (which removes everything) or account deletion (which removes everything server-side).
- The log never leaves the owner's control; it is not analytics and is never transmitted to the developer.

---

## 5. Respite mode rules

Respite mode (Phase 31) is short-term sharing for the "my sister covers while I travel" case. The framework fixes the rules now so the Phase 31 schema and RLS are designed to them.

1. Time-boxed, always. Every respite grant has an explicit end time chosen at creation from presets (24 hours, 48 hours, 72 hours, 7 days) with a hard maximum of 30 days. There is no indefinite respite grant; open-ended sharing is a different, deliberate flow with its own consent.
2. Least privilege. Respite grants use the Section 4 scopes with default deny. The invite flow proposes the minimum sensible default (`meds` only) and requires the owner to add anything more, scope by scope.
3. Auto-expiry is enforced where the data lives. Expiry is an `expires_at` check inside every relevant RLS policy, so an expired grant fails at the database even if a client misbehaves or a token is replayed. Client-side countdowns are display only. Verification (Phase 31 gate): a clock-forward test shows API access dying at expiry.
4. Both parties see the countdown. The owner and the helper each see the same remaining-time indicator on every shared surface (helper: "Your access to Robert's medications ends in 21 hours"; owner: "Maria's access ends tomorrow at 6:00 PM"). Nobody is silently watched and nobody silently retains access.
5. Revocation is immediate and unilateral. The owner can end a grant with one tap at any moment; revocation takes effect at the server on the next request. The helper is notified that access ended.
6. No silent renewal. Extending access is a new grant with the same explicit choices; nothing auto-renews. Expiry notice to the owner offers "share again" as a fresh decision.
7. Everything is logged. Every helper view and write lands in the synced access log (Section 4.2), reviewable by the owner during and after the grant.
8. No re-sharing, no export by default. A respite grantee cannot invite others, and print or export of shared data is a separate scope-like permission that defaults off.
9. Invite links carry an opaque, single-use token only. No names, no health data, no scope details in the URL or deep link. The token binds to the invitee's account on first acceptance.
10. The helper accepts terms on entry. Before first access, the helper sees what they were granted, until when, the fact that their access is logged, and the intended-use disclaimer set, and accepts.

---

## 6. Medical disclaimers and the intended-use statement

### 6.1 The disclaimer set (exact shipped copy)

Four disclaimers, one per surface, rendered through the design system's `DisclaimerFootnote` component (Phase 2) so placement and styling are consistent. These strings are frozen by this document and duplicated in the companion appendix; engineering copies them verbatim.

(a) Onboarding, shown on its own screen during first run, before the first patient is created (`disclaimer.onboarding.v1`):

> Hearth helps you organize care. It does not provide medical advice, diagnosis, dosing guidance, or treatment recommendations. Always follow the instructions of the prescribing clinician and the pharmacy label. If you think someone needs urgent medical help, call 911.

(b) Runway surfaces, shown as a footnote on medication runway screens and the digest's runway details (`disclaimer.runway.v1`):

> Runway dates are inventory arithmetic from the pharmacy label: fill date plus day supply. They are not medical advice and never tell you when, whether, or how much medication to take. Follow the label and the prescriber's instructions.

(c) Emergency guides, shown at the top of every guide and on every printed guide (`disclaimer.guides.v1`):

> This guide is general first-aid information. It is not medical advice and is not a substitute for professional care or emergency services. If you think this may be an emergency, call 911 now.

(d) Future AI assistant, shown on the consent screen and pinned in the assistant UI (`disclaimer.assistant.v1`):

> This assistant answers only from this person's Hearth records and cites the entry behind each answer. It is not medical advice. It will not answer dosing, diagnosis, or treatment questions; for those, contact the prescribing clinician or pharmacist. In an emergency, call 911.

Placement rules: disclaimers appear in context (App Review Guideline 1.4.1 expects in-context disclosure, not a buried settings page); the onboarding disclaimer is also reachable any time from Settings under "What Hearth is and is not"; printed artifacts (one-pager, ER sheet, guides) carry the relevant disclaimer in their footer via the print templates.

### 6.2 Intended-use statement (one page)

This statement is the product's constitution. Every feature, every App Store metadata field, and every marketing sentence is checked against it before shipping. It is reproduced in App Review notes at Phase 19 and Phase 20.

---

#### Hearth: Intended Use Statement

Version 1.0, adopted 2026-07-12.

What Hearth is. Hearth is an organizational tool for family caregivers who coordinate the everyday care of one or more older adults. It stores information the caregiver enters or captures: people, medications as written on their pharmacy labels, vitals readings, notes and observations, documents, contacts, and appointments. It presents that information back in organized, printable, shareable forms, and it performs deterministic arithmetic on it, such as computing the date a medication supply runs out from the label's fill date and day supply.

What Hearth is not. Hearth is not a medical device, not a clinical decision-support tool, and not a source of medical advice.

Three prohibitions, absolute:

1. No dosing. Hearth never computes, suggests, adjusts, or reminds anyone to take a dose amount. Runway math counts inventory days from label facts; it never expresses when or how much medication to take. The future assistant refuses dose questions with a scripted, deterministic redirect to the prescriber or pharmacist.
2. No diagnosis. Hearth never interprets symptoms, vitals, labs, or trends into a condition, risk score, or alert of a medical nature. Charts display; they do not conclude.
3. No triage. Hearth never tells a caregiver what to do in a medical situation beyond the single universal instruction to call 911. Emergency guides are static, clinician-reviewed, general first-aid reference content, not situation-specific direction.

Corollaries. High-alert medication badges prompt extra confirmation during data entry; they never block or direct care. Refill notifications say a supply is running low; they never say to take or skip medication. All health-related computation in Hearth is deterministic, testable arithmetic over caregiver-entered facts; no statistical or generative model ever writes to a health record (the future assistant proposes; the human confirms; code writes).

The feature test. Before any feature ships, it must pass all five questions:

1. Does it only organize, display, transport, or do deterministic arithmetic on caregiver-entered information?
2. Could its output ever be read as telling someone when, whether, or how much medication to take? (Must be no.)
3. Could its output ever be read as a diagnosis, risk assessment, or triage instruction? (Must be no.)
4. Is every claim in its UI copy and store metadata literally true and free of health-outcome promises?
5. If it touches another person's data, does it respect the attestation, scopes, and access-log commitments of this framework?

Marketing corollary. Approved vocabulary: organize, coordinate, keep track, one place, printable, works offline, private by design. Prohibited vocabulary: prevents, protects, improves adherence, medical-grade, HIPAA compliant, clinically proven, keeps them safe.

---

## 7. Consumer Health Data Privacy Policy (draft, local-first era)

This is the standalone policy MHMD requires (1.3), drafted for the era in which Hearth has no server, no accounts, and no data collection by the developer. It goes live at a public URL, linked separately from the marketing-site homepage, at Phase 19. It must be revised before Phase 29 (accounts and sync) and Phase 32 (AI) ship, because both change the answers.

Label-honesty note (binding on release configuration): the App Store privacy label declares "Data Not Collected" only while that is literally true of the shipped binary. Crash reporting (Sentry, Phase 9) therefore ships opt-in and default off during the local-first era, with PII scrubbing and no health data in events; if it is ever enabled by default, the label flips to declare Diagnostics (Crash Data, not linked to identity) and this policy's Section 4 is updated in the same release. Health data is never in scope for crash reports either way.

---

#### Hearth Consumer Health Data Privacy Policy

Effective date: [set at Phase 19 publication]. Applies to: the Hearth iOS application, version 1.0 and later, while operating without an account. Contact: [monitored address, set at Phase 19].

**1. Summary in plain language.** Your care records stay on your device. We, the developer of Hearth, do not receive, store, sell, or share them. We cannot read them. Everything below is detail on that sentence.

**2. Scope.** This policy covers consumer health data handled by the Hearth app: information about the health of the people whose care you manage, and any health information about you that you enter. It is published as a standalone policy to meet the Washington My Health My Data Act and similar laws.

**3. Consumer health data the app collects.** Hearth stores, on your device only, the information you deliberately enter or capture: names, relationships, dates of birth, and photos of the people you care for; their conditions, allergies, medications and pharmacy-label details, refill dates and supply counts; vitals readings and observations; notes; documents you save; care contacts; and your caregiver-authority attestation with its date. Hearth also keeps local, on-device logs of changes and of sensitive actions such as printing or exporting, so you have an audit trail. None of this is transmitted to us.

**4. What we collect off the device: nothing.** In this version of Hearth, the developer collects no personal data and no consumer health data. There are no analytics or advertising trackers in the app, and no third party receives data from the app. Optional crash reporting, if you turn it on in Settings, sends technical crash details scrubbed of personal and health information; it is off by default.

**5. How your information is used.** Solely to provide the features you use, on your device: organizing records, computing refill runways from label facts, scheduling local notifications, and producing documents you choose to print or share. We do not use consumer health data for advertising, marketing, analytics, profiling, or model training. We do not sell consumer health data, and we never will without the separate, signed authorization the law requires, which we do not intend to ask for.

**6. Sharing.** The only sharing that exists is sharing you perform yourself: printing a document, exporting a backup, or using the iOS share sheet. You choose every recipient. Generated documents are removed from the app's cache after sharing. We receive no copy.

**7. Storage and security.** All records are stored in an encrypted database on your device (SQLCipher, 256-bit key held in the iOS Keychain), protected by iOS Data Protection. You can additionally require Face ID to open the app. Backups you export are encrypted. No security is perfect, but data that never leaves your device cannot leak from our servers, because there are none.

**8. Your rights.** You can see everything Hearth holds, because it is all in the app. You can edit or delete any record, and Settings provides a full data wipe that permanently erases everything Hearth stores on the device. Because we hold no copy of your data, access, portability, and deletion are fully in your hands and take effect immediately; there is no third party to instruct. Washington residents: you may also exercise rights, ask questions, or appeal a decision by contacting us at the address above; if unsatisfied, you may contact the Washington Attorney General. We will respond to rights requests within 45 days.

**9. Whose data it is.** Hearth is used by caregivers to manage another person's health information. We require the caregiver to affirm they have that person's permission or the legal authority to do so. If you believe someone is managing your information in Hearth without authority, contact us and we will explain the available options; note that because data lives only on the caregiver's device, we cannot remotely read or delete it.

**10. Children.** Hearth is not directed to children under 13 and we do not knowingly handle their data.

**11. Changes.** If a future version of Hearth introduces features that change these answers, such as optional accounts, sync, or cloud AI features, we will update this policy first, and those features will ask for your explicit consent before any data leaves your device. Material changes never apply retroactively to data practices you did not agree to.

---

## 8. Implementation obligations by phase

| Phase | Must implement from this framework | Verified by |
|---|---|---|
| P5 | Attestation checkbox and explainer, verbatim (Section 3.2), stored in `attestation_text` and `attestation_at`; required to save | Attestation recorded per patient (P5 gate) |
| P6-P8 | Runway framed as inventory arithmetic everywhere; no dose language in notification payloads; content-hidden previews | Copy review against Section 6.2; P8 soak |
| P9 | Honest age rating (medical topics); crash reporting opt-in, PII-scrubbed; privacy-manifest audit | P9 gate |
| P14-P16 | Disclaimers in print footers (one-pager, ER sheet, guides); PHI PDFs cache-deleted after share | P14/P15/P16 gates |
| P19 | Disclaimer set live in context (Section 6.1); access log surfaced in Settings; full data wipe; policy (Section 7) at public URL; 5.1.3 self-audit (Section 9) answered line by line; App Review notes with intended-use statement | P19 gate |
| P20 | Store metadata checked against Section 6.2 vocabulary | P20 gate |
| P29 | Same-phase account deletion with verified purge; policy revision; labels flip honestly | P29 gate |
| P31 | Scopes (Section 4.1) in schema and RLS; respite rules 1 through 10 (Section 5); synced access log | P31 clock-forward and RLS-probe gates |
| P32 | Named-provider opt-in before first transmission; assistant disclaimer; scripted dose refusal | P32 adversarial suite |

---

## 9. App Review self-audit checklist (Guideline 5.1.3 and adjacent)

Completed line by line at Phase 19 and re-checked at every submission. "Answer" states the shipped behavior, not the intention.

| # | Requirement | Our answer | Phase |
|---|---|---|---|
| 1 | 5.1.3(i): health data may not be used for advertising, marketing, or use-based data mining, and may not be disclosed to third parties for those purposes | No advertising, no marketing use, no data mining: health data never leaves the device in the local-first era, and no ad or analytics SDK is present in the binary | P1, audited P19 |
| 2 | 5.1.3(i): disclosure to third parties only for improving health management or health research, and only with permission | No third-party disclosure exists. Sharing is user-initiated (print, share sheet, export) or, later, owner-granted scoped invites with logging | P14, P31 |
| 3 | 5.1.3(ii): may not write false or inaccurate data into health apps (including HealthKit) | Hearth does not integrate with HealthKit. Scanned label data is never saved without field-by-field human confirmation, and RxNorm-unmatched names carry a visible free-text badge | P22 |
| 4 | 5.1.3(ii): may not store personal health information in iCloud | The encrypted database and documents vault are excluded from iCloud device backup; the supported device-change path is the user-controlled encrypted local export | P1, P18 |
| 5 | 5.1.3(iii): health-related human-subject research requires informed consent (and IRB where applicable) | Hearth conducts no human-subject research. Beta feedback is product feedback; no health outcomes are studied. If research is ever contemplated, consent and IRB review come first | P19 notes |
| 6 | 1.4.1: medical apps that could provide inaccurate data or be used for diagnosis must disclose data and methodology in context | Runway screens disclose the entire methodology in one sentence (fill date plus day supply) with the in-context disclaimer; charts display entered readings without interpretation | P6, P19 |
| 7 | 1.4.1: drug dosage calculators must come from approved sources | Not applicable by design: Hearth contains no dose calculation of any kind, enforced by the intended-use feature test | All phases |
| 8 | 5.1.1: privacy policy link in metadata; consent for data collection | Standalone consumer-health privacy policy at a public URL, linked in App Store Connect; the app collects nothing off-device, and on-device storage is the requested service itself | P19 |
| 9 | 5.1.1(v): account deletion in-app if accounts exist | No accounts exist until P29; account creation and in-app deletion with verified server purge ship in the same phase | P29 |
| 10 | 5.1.1: apps may not require registration for non-account features | The signed-out, local-only app is fully functional forever; accounts are opt-in for sync and sharing only | P1, P29 |
| 11 | 5.1.2: data may not be repurposed or shared without consent | Nothing is transmitted in the local era; every future transmission (sync, sharing, AI) is opt-in per purpose before first use | P29, P31, P32 |
| 12 | 5.1.2(i) (Nov 2025): cloud AI features must name the actual provider and obtain explicit opt-in before first transmission | The P32 consent screen names Anthropic Claude, appears before any transmission, and the app is fully functional with the assistant off. On-device scan OCR (Apple Vision) is outside this rule by construction | P32 |
| 13 | 2.5.2: no downloading or executing code that changes app behavior | Workflows are declarative data interpreted by shipped node types; emergency guides are content bundles; no remote code | P16, P25 |
| 14 | 1.4.1 / privacy hygiene: no sensitive data exposure via side channels | No PHI in notification payloads (content-hidden previews), URLs, deep links, logs, or crash events; privacy overlay on backgrounding; CI grep at the hardening gate | P8, P18 |
| 15 | 4.3 / metadata honesty: accurate, differentiated, medical-claim-free listing | Listing copy is filtered through the intended-use vocabulary list; no outcome claims, no compliance claims | P20 |
| 16 | Privacy nutrition label accuracy | "Data Not Collected" only while literally true (crash reporting default off); flips honestly at P29 with the policy updated in the same release | P9, P19, P29 |
| 17 | Age rating honesty for medical and wellness topics | Questionnaire answered honestly at first submission and re-reviewed each release | P9, P20 |

---

## 10. Open items for counsel review (before Phase 19)

1. Confirm the HBNR PHR-vendor analysis for a purely local app and the encrypted-device "acquisition" position in Section 2.
2. Confirm the MHMD "necessary to provide the requested service" ground for on-device processing, and the policy language in Section 7.
3. Review the attestation copy for CMIA adequacy and any state-specific caregiver-authority nuances.
4. Confirm whether TestFlight beta distribution alone triggers the MHMD homepage-link requirement ahead of public marketing.
5. Review the incident-response plan's state-law fan-out step for completeness.
