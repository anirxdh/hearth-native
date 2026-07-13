# Label OCR Spike Scorecard (Phase 3)

Date: 2026-07-12
Pipeline: headless-Chrome-rendered label corpus -> Apple Vision `VNRecognizeTextRequest` (accurate mode, language correction off) via a compiled Swift CLI -> deterministic `@hearth/label-parser` -> normalized exact-match scoring against ground truth.

Everything below was produced by an actual end-to-end run. Reproduce with:

```
cd spike/ocr
node corpus-gen.mjs          # renders 40 label PNGs + ground truth JSON into spike/ocr/corpus/
swiftc -O -framework Vision -framework AppKit -o visionocr VisionOCR.swift
./node_modules/.bin/tsx run-spike.mjs   # writes results.json, prints the summary
pnpm -C ../../packages/label-parser test   # 29 unit tests
```

## Corpus

40 synthetic US pharmacy labels, 1200 px wide, 4 layout families x 10 medications across the three demo patients (Robert, Eleanor, Rosa). Medications: metformin 500 mg, apixaban 5 mg, lisinopril 10 mg, atorvastatin 20 mg, insulin glargine 100 units/mL, donepezil 10 mg, sertraline 50 mg, amlodipine 5 mg, levothyroxine 75 mcg, ibuprofen 600 mg.

| Layout family | Traits exercised |
| --- | --- |
| CVS-style | red header bar, right-column fill date, merged QTY / day-supply row, NDC and discard-date decoys |
| Walgreens-style | comma-form patient name, narrow sig box that wraps sigs across two lines, 2-digit-year dates, ORIG date decoy |
| Kaiser mail-order-style | table cells (label and value split), month-name dates, 1-866 phone, USE BY decoy |
| Independent | combined "QTY 60 / 30 DAYS SUPPLY" line, "N REFILLS BEFORE date" and "NO REFILLS" forms, prescriber phone decoy |

Realism variants: 19 clean, 6 rotated (2 to 4 degrees), 5 reduced contrast, 6 with a yellow auxiliary sticker fully occluding the day-supply text, 4 small-font.

## Per-field results (n = 40 per field)

| Field | n | Clean exact-match | Overall exact-match | Failure modes observed |
| --- | --- | --- | --- | --- |
| drugName | 40 | 100% | 100% | none in this run; fuzzy fallback (edit distance 1) is unit-tested but never triggered |
| strength | 40 | 100% | 100% | none, including glued "10MG" and "100 UNITS/ML" |
| sig | 40 | 100% | 100% | none; wrapped two-line sigs were rejoined correctly on all 10 Walgreens-style labels |
| fillDate | 40 | 100% | 100% | none; discard/expiry/orig/refill-by decoy dates never captured |
| daySupply | 40 | 100% | 85% | all 6 misses are the 6 sticker images: Vision reads the sticker text, the value underneath is unrecoverable; parser correctly returns nothing rather than a wrong number |
| quantity | 40 | 100% | 95% | 2 misses, both independent-family sticker images where qty shares the occluded line with day supply |
| refills | 40 | 100% | 100% | none, including "NO REFILLS" mapping to 0 |
| rxNumber | 40 | 100% | 100% | none, including dashed formats; NDC decoys never captured |
| pharmacyPhone | 40 | 100% | 100% | none; prescriber-phone decoy never won over the pharmacy phone |
| patientName | 40 | 100% | 100% | none, but extraction is positional on 3 of 4 layouts (no PATIENT: label), so its confidence is intentionally capped low |

Rotation, low contrast, and small fonts caused zero field losses at this resolution; the only failure source was physical occlusion. Critically, the parser produced zero wrong values in the entire run: every miss was an honest "field not found", which is the correct behavior feeding a confirm UI.

## Go / no-go

Gate: drugName, fillDate, daySupply at or above 85% on clean images and 70% overall.

Result: 100 / 100 / 100 clean and 100 / 100 / 85 overall. **GO.**

The scan flow is feasible as a correction flow rather than manual re-entry. The runner prints the gate decision mechanically (`results.json` -> `goGate.decision: "GO"`), so re-running against a harder corpus keeps the decision honest.

## Which fields need low-confidence flagging in the P22 confirm UI

Parser confidence = Vision line confidence x heuristic factor (1.0 labeled, lower for positional/fuzzy/joined extractions). Measured at a 0.8 flag threshold:

| Field | Mean confidence when correct | Flag rate when correct | Recommendation |
| --- | --- | --- | --- |
| patientName | 0.70 | 30/40 | do not rely on the score; always route through the explicit patient-match gate ("this is for [Patient]") that P22 already requires |
| quantity | 0.75 | 19/38 | Vision systematically scores short numeric tokens like "QTY: 60" at 0.5, so treat quantity as low-trust; show it pre-filled but visually flagged |
| daySupply | 0.85 | 10/34 | same short-token effect, plus occlusion produces outright absence; absent daySupply must block save until entered, since it drives the runway engine |
| sig | 0.93 | 6/40 | flag when the value was joined from wrapped lines (the 6 flags were exactly the narrow-box labels); sig also carries the highest harm if wrong |
| fillDate | 0.94 | 5/40 | flag when the date came from a split label/value cell; otherwise reliable |
| drugName, strength, refills, rxNumber, pharmacyPhone | 0.99 | 1/40 each | trustworthy at this threshold; confirm-once UI treatment is sufficient |

Design consequence for P22: absence is the dominant failure signal, not misreads. The confirm UI needs a strong empty-state treatment (occluded or missing fields) more than it needs red squiggles under wrong values.

## Honest limitations

1. **The corpus is synthetic.** Rendered flat PNGs with clean fonts are the easy case. Real bottle photos add curvature, glare, focus blur, thermal-print fade, and camera noise. The 100% clean-image numbers are a ceiling, not a forecast. The go decision holds because the architecture question (can Vision plus a deterministic parser produce a correction flow) is answered, but the accuracy numbers must be re-measured on real photos before P21/P22 ship.
2. Vision confidence values on rendered text cluster near 1.0 (or 0.5 for short tokens); real photos will spread this distribution and may change the flagging threshold.
3. The sticker variant proves occlusion behavior but real auxiliary stickers vary in placement; the 15% occlusion rate here was chosen, not measured.
4. The generics list covers about 80 common generics; brand-name-only labels (for example SoloStar sold as Lantus) fall back to fuzzy matching or fail closed. RxNorm normalization was deferred to the P21 productization.
5. All layouts are US retail or mail-order; no hospital discharge, blister-pack, or compounded-medication labels.

### Real-bottle photo set needed from the user for final validation

30 to 50 photos covering, per the phase-3 roadmap intent:

- At least one bottle each from CVS, Walgreens, a mail-order pharmacy, a grocery or big-box pharmacy, and an independent pharmacy.
- Each bottle photographed 3 ways: label flattened toward the camera as best as possible, bottle rotated about 30 degrees so text curves away, and one deliberately imperfect shot (indoor evening light or slight motion).
- At least three bottles with visible glare from an overhead light on the label plastic.
- At least three 90-day mail-order bottles or boxes with small dense type.
- At least two labels with auxiliary warning stickers partially covering printed text.
- At least two older refills with faded thermal print.
- One insulin pen box and one non-oral form (drops, inhaler, or patch) if available.
- No real names or personal medications need to be shared: the user can cover patient name lines with a paper strip before photographing; every other field remains measurable.

## Zero-retention note

The Swift CLI reads the image, emits JSON lines on stdout, and writes nothing to disk; the parser is pure TypeScript over those lines. Filesystem inspection after a run shows no artifacts beyond the corpus and `results.json` that the spike itself writes, which matches the on-device zero-retention design for P21.

## Artifacts

- `spike/ocr/corpus-gen.mjs` corpus generator (Chrome headless renderer)
- `spike/ocr/corpus/` 40 PNG + ground-truth JSON pairs
- `spike/ocr/VisionOCR.swift` Vision CLI (same API surface as the future iOS Expo module)
- `spike/ocr/run-spike.mjs` end-to-end runner; writes `spike/ocr/results.json`
- `packages/label-parser/` deterministic parser package, 29 passing unit tests
