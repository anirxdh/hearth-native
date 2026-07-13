# Shipped Compliance Strings (verbatim)

Appendix to `docs/compliance/consent-and-compliance-framework.md`. These are the exact strings the app ships. Engineering copies them character for character; any wording change must land in the framework document first. String IDs are stable; a copy revision bumps the version suffix and keeps the old constant until no stored record references it.

Ready-to-copy TypeScript (suggested home: `packages/core/src/complianceStrings.ts`):

```ts
/**
 * Frozen compliance copy. Source of truth:
 * docs/compliance/consent-and-compliance-framework.md (Sections 3.2 and 6.1).
 * Do not edit strings here without updating that document first.
 */

export const ATTESTATION_CHECKBOX_V1 =
  'I confirm that I am a caregiver for this person, and that I have their permission or the legal authority (for example, healthcare power of attorney or guardianship) to record and manage their health information in Hearth.';

export const ATTESTATION_EXPLAINER_V1 =
  'Hearth keeps health information about the person you care for, such as medications and allergies, on this device. That information is theirs. Before adding it, please confirm they have agreed, or that you have the authority to act for them. If they are able to take part in this decision, talk with them first. You can review or remove everything you add at any time.';

export const DISCLAIMER_ONBOARDING_V1 =
  'Hearth helps you organize care. It does not provide medical advice, diagnosis, dosing guidance, or treatment recommendations. Always follow the instructions of the prescribing clinician and the pharmacy label. If you think someone needs urgent medical help, call 911.';

export const DISCLAIMER_RUNWAY_V1 =
  'Runway dates are inventory arithmetic from the pharmacy label: fill date plus day supply. They are not medical advice and never tell you when, whether, or how much medication to take. Follow the label and the prescriber\'s instructions.';

export const DISCLAIMER_GUIDES_V1 =
  'This guide is general first-aid information. It is not medical advice and is not a substitute for professional care or emergency services. If you think this may be an emergency, call 911 now.';

export const DISCLAIMER_ASSISTANT_V1 =
  'This assistant answers only from this person\'s Hearth records and cites the entry behind each answer. It is not medical advice. It will not answer dosing, diagnosis, or treatment questions; for those, contact the prescribing clinician or pharmacist. In an emergency, call 911.';
```

Placement reference:

| Constant | Surface | Phase |
|---|---|---|
| `ATTESTATION_CHECKBOX_V1` | Add-patient flow, required checkbox; saved verbatim to `patients.attestation_text` with `patients.attestation_at` | P5 |
| `ATTESTATION_EXPLAINER_V1` | Add-patient flow, directly above the checkbox | P5 |
| `DISCLAIMER_ONBOARDING_V1` | First-run onboarding screen; also Settings, "What Hearth is and is not" | P9, P19 |
| `DISCLAIMER_RUNWAY_V1` | Medication runway screens and digest runway details, `DisclaimerFootnote`; one-pager print footer | P19, P14 |
| `DISCLAIMER_GUIDES_V1` | Top of every emergency guide and on every printed guide | P16 |
| `DISCLAIMER_ASSISTANT_V1` | Assistant consent screen and pinned in the assistant UI | P32 |
