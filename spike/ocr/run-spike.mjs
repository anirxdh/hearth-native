/**
 * OCR spike runner: Vision OCR -> deterministic parser -> ground truth.
 *
 * For every corpus image: run the compiled visionocr CLI, feed its lines to
 * @rua/label-parser, normalize both sides, and score per-field exact
 * matches. Writes results.json and prints the scorecard summary.
 *
 * Usage: node --import tsx run-spike.mjs   (or: pnpm spike)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// @rua/label-parser is a CommonJS package (same shape as @rua/core),
// so under tsx its named exports arrive on the default binding.
import labelParser from '../../packages/label-parser/src/index.ts';

const { parseLabel, normalizeName, normalizePhone, normalizeStrength, normalizeText } =
  labelParser;

const ROOT = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(ROOT, 'corpus');
const BIN = join(ROOT, 'visionocr');
const LOW_CONFIDENCE = 0.8;

if (!existsSync(BIN)) {
  execFileSync('swiftc', ['-O', '-framework', 'Vision', '-framework', 'AppKit', '-o', BIN, join(ROOT, 'VisionOCR.swift')], { stdio: 'inherit' });
}

const COMPARE = {
  patientName: (got, want) => normalizeName(got) === normalizeName(want),
  drugName: (got, want) => normalizeText(got) === normalizeText(want),
  strength: (got, want) => normalizeStrength(got) === normalizeStrength(want),
  sig: (got, want) => normalizeText(got) === normalizeText(want),
  fillDate: (got, want) => got === want,
  daySupply: (got, want) => got === want,
  quantity: (got, want) => got === want,
  refills: (got, want) => got === want,
  rxNumber: (got, want) => String(got).replace(/\s+/g, '') === String(want).replace(/\s+/g, ''),
  pharmacyPhone: (got, want) => normalizePhone(String(got)) === normalizePhone(String(want)),
};

const FIELDS = Object.keys(COMPARE);

function ocr(imagePath) {
  const raw = execFileSync(BIN, [imagePath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return raw
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

const gtFiles = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort();
if (gtFiles.length === 0) {
  console.error('No corpus found. Run: node corpus-gen.mjs');
  process.exit(1);
}

const stats = Object.fromEntries(
  FIELDS.map((f) => [f, {
    n: 0, hit: 0, cleanN: 0, cleanHit: 0,
    missing: 0, wrong: 0,
    confRight: [], confWrong: [],
    wrongFlagged: 0, rightFlagged: 0,
    failures: [],
  }]),
);
const perImage = [];

for (const gtFile of gtFiles) {
  const gt = JSON.parse(readFileSync(join(CORPUS, gtFile), 'utf8'));
  const imagePath = join(CORPUS, gt.file);
  const lines = ocr(imagePath);
  const parsed = parseLabel(lines);
  const clean = gt.variant === 'clean';
  const record = { file: gt.file, layout: gt.layout, variant: gt.variant, ocrLineCount: lines.length, fields: {} };

  for (const f of FIELDS) {
    const want = gt.truth[f];
    if (want === undefined || want === null) continue;
    const s = stats[f];
    s.n += 1;
    if (clean) s.cleanN += 1;
    const got = parsed[f]?.value;
    const conf = parsed[f]?.confidence;
    let ok = false;
    if (got === undefined) {
      s.missing += 1;
    } else {
      ok = COMPARE[f](got, want);
      if (ok) {
        s.hit += 1;
        if (clean) s.cleanHit += 1;
        s.confRight.push(conf);
        if (conf < LOW_CONFIDENCE) s.rightFlagged += 1;
      } else {
        s.wrong += 1;
        s.confWrong.push(conf);
        if (conf < LOW_CONFIDENCE) s.wrongFlagged += 1;
      }
    }
    if (!ok) {
      s.failures.push({ file: gt.file, variant: gt.variant, expected: want, got: got ?? null, confidence: conf ?? null });
    }
    record.fields[f] = { expected: want, got: got ?? null, confidence: conf ?? null, ok };
  }
  perImage.push(record);
  process.stdout.write(`${gt.file} [${gt.variant}] ocr lines: ${lines.length}\n`);
}

const pct = (hit, n) => (n === 0 ? 0 : Math.round((hit / n) * 1000) / 10);
const mean = (xs) => (xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000);

const summary = {};
for (const f of FIELDS) {
  const s = stats[f];
  summary[f] = {
    n: s.n,
    cleanN: s.cleanN,
    cleanPct: pct(s.cleanHit, s.cleanN),
    overallPct: pct(s.hit, s.n),
    missing: s.missing,
    wrong: s.wrong,
    meanConfRight: mean(s.confRight),
    meanConfWrong: mean(s.confWrong),
    wrongFlaggedAtThreshold: `${s.wrongFlagged}/${s.wrong}`,
    rightFlaggedAtThreshold: `${s.rightFlagged}/${s.hit}`,
  };
}

const gate = ['drugName', 'fillDate', 'daySupply'];
const go =
  gate.every((f) => summary[f].cleanPct >= 85) &&
  gate.every((f) => summary[f].overallPct >= 70);

const results = {
  generatedAt: new Date().toISOString(),
  corpusSize: gtFiles.length,
  lowConfidenceThreshold: LOW_CONFIDENCE,
  goGate: { fields: gate, cleanFloor: 85, overallFloor: 70, decision: go ? 'GO' : 'NO-GO' },
  summary,
  failures: Object.fromEntries(FIELDS.map((f) => [f, stats[f].failures])),
  perImage,
};
writeFileSync(join(ROOT, 'results.json'), JSON.stringify(results, null, 2) + '\n');

console.log('\nfield            n   clean%   overall%  missing  wrong  conf(right/wrong)');
for (const f of FIELDS) {
  const s = summary[f];
  console.log(
    `${f.padEnd(15)} ${String(s.n).padStart(3)} ${String(s.cleanPct).padStart(7)}% ${String(s.overallPct).padStart(8)}% ${String(s.missing).padStart(8)} ${String(s.wrong).padStart(6)}  ${s.meanConfRight ?? '-'} / ${s.meanConfWrong ?? '-'}`,
  );
}
console.log(`\nDecision gate (drugName, fillDate, daySupply >= 85% clean and >= 70% overall): ${results.goGate.decision}`);
console.log('Wrote results.json');
