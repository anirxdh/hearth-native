/**
 * Synthetic pharmacy-label corpus generator.
 *
 * Renders 40 realistic US pharmacy labels (4 layout families x 10 meds for
 * the demo family) as 1200px-wide PNGs via headless Chrome, with ground
 * truth JSON written alongside each image. Realism variants: slight
 * rotation, reduced contrast, a yellow auxiliary sticker occluding the
 * day-supply text, and small font sizes.
 *
 * Usage: node corpus-gen.mjs
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = dirname(fileURLToPath(import.meta.url));
const HTML_DIR = join(ROOT, 'corpus-html');
const OUT_DIR = join(ROOT, 'corpus');
const PROFILE = join(tmpdir(), `rua-ocr-chrome-${process.pid}`);

const PATIENTS = {
  robert: {
    name: 'ROBERT ALVAREZ',
    commaName: 'ALVAREZ, ROBERT',
    addr1: '1420 WILLOW CREEK RD',
    addr2: 'SPRINGFIELD, IL 62704',
    prescriber: 'ANIL PATEL',
  },
  eleanor: {
    name: 'ELEANOR ALVAREZ',
    commaName: 'ALVAREZ, ELEANOR',
    addr1: '1420 WILLOW CREEK RD',
    addr2: 'SPRINGFIELD, IL 62704',
    prescriber: 'MEERA SHAH',
  },
  rosa: {
    name: 'ROSA MARQUEZ',
    commaName: 'MARQUEZ, ROSA',
    addr1: '88 CYPRESS LANE APT 2B',
    addr2: 'SPRINGFIELD, IL 62703',
    prescriber: 'T. NGUYEN',
  },
};

const MEDS = [
  { key: 'metformin', patient: 'robert', drugLine: 'METFORMIN HCL 500 MG TABLETS', generic: 'METFORMIN', strength: '500 MG', sig: 'TAKE 1 TABLET BY MOUTH TWICE DAILY WITH MEALS', qty: 60, ds: 30, refills: 3, ndc: '00093-1048-01' },
  { key: 'apixaban', patient: 'robert', drugLine: 'APIXABAN 5 MG TABLETS', generic: 'APIXABAN', strength: '5 MG', sig: 'TAKE 1 TABLET BY MOUTH TWICE DAILY', qty: 60, ds: 30, refills: 5, ndc: '00003-0894-21' },
  { key: 'lisinopril', patient: 'robert', drugLine: 'LISINOPRIL 10MG TABLETS', generic: 'LISINOPRIL', strength: '10 MG', sig: 'TAKE 1 TABLET BY MOUTH EVERY DAY', qty: 90, ds: 90, refills: 2, ndc: '68180-0514-01' },
  { key: 'atorvastatin', patient: 'robert', drugLine: 'ATORVASTATIN CALCIUM 20 MG TABLETS', generic: 'ATORVASTATIN', strength: '20 MG', sig: 'TAKE 1 TABLET BY MOUTH AT BEDTIME', qty: 90, ds: 90, refills: 1, ndc: '00071-0156-23' },
  { key: 'insulin-glargine', patient: 'robert', drugLine: 'INSULIN GLARGINE 100 UNITS/ML SOLOSTAR PEN', generic: 'INSULIN GLARGINE', strength: '100 UNITS/ML', sig: 'INJECT 20 UNITS UNDER THE SKIN AT BEDTIME', qty: 15, ds: 30, refills: 2, ndc: '00088-2219-33' },
  { key: 'donepezil', patient: 'eleanor', drugLine: 'DONEPEZIL HCL 10 MG TABLETS', generic: 'DONEPEZIL', strength: '10 MG', sig: 'TAKE 1 TABLET BY MOUTH AT BEDTIME', qty: 30, ds: 30, refills: 4, ndc: '62756-0246-88' },
  { key: 'sertraline', patient: 'eleanor', drugLine: 'SERTRALINE HCL 50 MG TABLETS', generic: 'SERTRALINE', strength: '50 MG', sig: 'TAKE 1 TABLET BY MOUTH EVERY MORNING', qty: 30, ds: 30, refills: 3, ndc: '68180-0352-09' },
  { key: 'amlodipine', patient: 'eleanor', drugLine: 'AMLODIPINE BESYLATE 5 MG TABLETS', generic: 'AMLODIPINE', strength: '5 MG', sig: 'TAKE 1 TABLET BY MOUTH ONCE DAILY', qty: 90, ds: 90, refills: 0, ndc: '69097-0127-15' },
  { key: 'levothyroxine', patient: 'rosa', drugLine: 'LEVOTHYROXINE SODIUM 75 MCG TABLETS', generic: 'LEVOTHYROXINE', strength: '75 MCG', sig: 'TAKE 1 TABLET BY MOUTH EVERY MORNING ON AN EMPTY STOMACH', qty: 90, ds: 90, refills: 3, ndc: '00074-5182-90' },
  { key: 'ibuprofen', patient: 'rosa', drugLine: 'IBUPROFEN 600 MG TABLETS', generic: 'IBUPROFEN', strength: '600 MG', sig: 'TAKE 1 TABLET BY MOUTH EVERY 8 HOURS AS NEEDED FOR PAIN', qty: 60, ds: 30, refills: 1, ndc: '53746-0131-05' },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const p2 = (n) => String(n).padStart(2, '0');

function fillDateFor(famIdx, medIdx) {
  return { y: 2026, m: 3 + (medIdx % 5), d: 3 + medIdx * 2 + famIdx * 3 };
}

const fmt = {
  slash4: (d) => `${p2(d.m)}/${p2(d.d)}/${d.y}`,
  slash2: (d) => `${p2(d.m)}/${p2(d.d)}/${String(d.y).slice(2)}`,
  month: (d) => `${MONTH_NAMES[d.m - 1]} ${d.d}, ${d.y}`,
  dash: (d) => `${p2(d.m)}-${p2(d.d)}-${d.y}`,
  iso: (d) => `${d.y}-${p2(d.m)}-${p2(d.d)}`,
};

const plusYear = (d) => ({ ...d, y: d.y + 1 });

// Variant assignment by global image index (family * 10 + med).
const ROTATED = { 2: 2.5, 9: -3, 14: 3.5, 23: 2, 28: -2.5, 37: 4 };
const LOW_CONTRAST = new Set([5, 12, 19, 26, 33]);
const STICKER = new Set([3, 8, 17, 22, 31, 36]);
const SMALL_FONT = new Set([6, 15, 24, 34]);

function variantFor(idx) {
  if (idx in ROTATED) return { kind: 'rotated', deg: ROTATED[idx] };
  if (LOW_CONTRAST.has(idx)) return { kind: 'lowContrast' };
  if (STICKER.has(idx)) return { kind: 'sticker' };
  if (SMALL_FONT.has(idx)) return { kind: 'smallFont' };
  return { kind: 'clean' };
}

const STICKER_HTML =
  '<span class="sticker">TAKE WITH FOOD</span>';

function dsTarget(text, sticker) {
  return `<span class="ds-target">${text}${sticker ? STICKER_HTML : ''}</span>`;
}

// Layout families. Each returns inner-label HTML plus family CSS.

function cvsLabel(med, pt, ctx) {
  return `
  <div class="label cvs">
    <div class="hdr"><span class="logo">CVS/pharmacy</span><span class="store">STORE #08421</span></div>
    <div class="sub">1206 W MONROE ST, SPRINGFIELD, IL 62704 &nbsp;&nbsp; PH: (217) 555-0134</div>
    <div class="row rx"><span>RX# ${ctx.rx}</span><span>FILLED: ${ctx.fill}</span></div>
    <div class="pt">${pt.name}</div>
    <div class="addr">${pt.addr1}<br>${pt.addr2}</div>
    <div class="drug">${med.drugLine}</div>
    <div class="sig">${med.sig}</div>
    <div class="row qty"><span>QTY: ${med.qty}</span>${dsTarget(`${med.ds} DAY SUPPLY`, ctx.sticker)}</div>
    <div class="ref">${med.refills > 0 ? `REFILLS: ${med.refills} BY ${ctx.refillBy}` : 'REFILLS: 0 - CONTACT PRESCRIBER'}</div>
    <div class="foot">DR. ${pt.prescriber} &nbsp;&nbsp; NDC ${med.ndc}</div>
    <div class="foot">DISCARD AFTER ${ctx.discard} &nbsp;&nbsp; MFG: TEVA USA</div>
  </div>`;
}

const CVS_CSS = `
  .cvs .hdr { background:#c00; color:#fff; display:flex; justify-content:space-between; padding:0.35em 0.55em; font-weight:bold; font-size:1.05em; }
  .cvs .sub { font-size:0.6em; padding:0.5em 0 0.9em; color:#222; }
  .cvs .row { display:flex; justify-content:space-between; font-weight:bold; font-size:0.85em; }
  .cvs .pt { font-weight:bold; font-size:0.95em; margin-top:0.7em; }
  .cvs .addr { font-size:0.62em; color:#222; margin:0.2em 0 0.9em; line-height:1.35; }
  .cvs .drug { font-weight:bold; font-size:1.12em; margin:0.3em 0; }
  .cvs .sig { font-size:0.88em; margin:0.4em 0 0.8em; }
  .cvs .qty { margin:0.4em 0; }
  .cvs .ref { font-size:0.72em; font-weight:bold; margin:0.5em 0; }
  .cvs .foot { font-size:0.58em; color:#333; margin-top:0.5em; }
`;

function walgreensLabel(med, pt, ctx) {
  return `
  <div class="label wal">
    <div class="hdr"><span class="logo">WALGREENS</span><span class="ph">PH: (217) 555-0188</span></div>
    <div class="sub">2455 WABASH AVE, SPRINGFIELD, IL 62704</div>
    <div class="row rx"><span>RX ${ctx.rx}</span><span>DATE FILLED: ${ctx.fill}</span></div>
    <div class="pt">${pt.commaName}</div>
    <div class="addr">${pt.addr1}, ${pt.addr2}</div>
    <div class="drug">${med.drugLine}</div>
    <div class="sigbox">${med.sig}</div>
    <div class="row qty"><span>QTY: ${med.qty}</span>${dsTarget(`DAYS SUPPLY: ${med.ds}`, ctx.sticker)}</div>
    <div class="ref">REFILLS LEFT: ${med.refills}</div>
    <div class="foot">PRESCRIBER: ${pt.prescriber} &nbsp;&nbsp; ORIG: 01/15/2026 &nbsp;&nbsp; DISCARD AFTER: ${ctx.discard}</div>
  </div>`;
}

const WAL_CSS = `
  .wal .hdr { display:flex; justify-content:space-between; align-items:baseline; border-bottom:3px solid #101010; padding-bottom:0.25em; }
  .wal .logo { font-weight:bold; font-size:1.1em; letter-spacing:0.06em; }
  .wal .ph { font-size:0.68em; font-weight:bold; }
  .wal .sub { font-size:0.6em; color:#222; padding:0.4em 0 0.8em; }
  .wal .row { display:flex; justify-content:space-between; font-weight:bold; font-size:0.85em; }
  .wal .pt { font-weight:bold; font-size:0.98em; margin-top:0.8em; }
  .wal .addr { font-size:0.62em; color:#222; margin:0.2em 0 0.9em; }
  .wal .drug { font-weight:bold; font-size:1.1em; margin:0.3em 0 0.45em; }
  .wal .sigbox { border:2px solid #101010; width:62%; padding:0.45em 0.5em; font-size:0.88em; line-height:1.4; margin-bottom:0.7em; }
  .wal .qty { margin:0.4em 0; }
  .wal .ref { font-size:0.78em; font-weight:bold; margin:0.5em 0; }
  .wal .foot { font-size:0.58em; color:#333; margin-top:0.6em; }
`;

function kaiserLabel(med, pt, ctx) {
  return `
  <div class="label kp">
    <div class="hdr">KAISER PERMANENTE</div>
    <div class="sub">MAIL ORDER PHARMACY - PO BOX 12500, DENVER, CO 80217</div>
    <div class="sub2">QUESTIONS? CALL 1-866-555-0119</div>
    <div class="pt">FOR: ${pt.name}</div>
    <div class="drug">${med.drugLine}</div>
    <div class="sig">${med.sig}</div>
    <table class="grid">
      <tr><td>Rx No: ${ctx.rx}</td><td>Fill Date: ${ctx.fill}</td></tr>
      <tr><td>Qty: ${med.qty}</td><td>${dsTarget(`Days Supply: ${med.ds}`, ctx.sticker)}</td></tr>
      <tr><td>Refills Remaining: ${med.refills}</td><td>Prescriber: ${pt.prescriber} MD</td></tr>
    </table>
    <div class="foot">USE BY: ${ctx.useBy} &nbsp;&nbsp; NDC ${med.ndc}</div>
  </div>`;
}

const KP_CSS = `
  .kp .hdr { font-weight:bold; font-size:1.05em; letter-spacing:0.04em; }
  .kp .sub { font-size:0.6em; color:#222; padding-top:0.35em; }
  .kp .sub2 { font-size:0.6em; font-weight:bold; padding:0.15em 0 0.9em; }
  .kp .pt { font-weight:bold; font-size:0.95em; border-top:2px solid #101010; padding-top:0.7em; }
  .kp .drug { font-weight:bold; font-size:1.1em; margin:0.55em 0 0.35em; }
  .kp .sig { font-size:0.85em; margin-bottom:0.8em; }
  .kp .grid { width:100%; border-collapse:collapse; font-size:0.74em; }
  .kp .grid td { border:1px solid #555; padding:0.5em 0.7em; width:50%; }
  .kp .foot { font-size:0.58em; color:#333; margin-top:0.8em; }
`;

function independentLabel(med, pt, ctx) {
  return `
  <div class="label ind">
    <div class="hdr">OAK STREET PHARMACY</div>
    <div class="sub">314 OAK ST, SPRINGFIELD, IL 62701 &nbsp; (217) 555-0163</div>
    <div class="row rx"><span>Rx #: ${ctx.rx}</span><span>FILLED ${ctx.fill}</span></div>
    <div class="pt">${pt.name}</div>
    <div class="addr">${pt.addr1}, ${pt.addr2}</div>
    <div class="drug">${med.drugLine}</div>
    <div class="sig">${med.sig}</div>
    <div class="qty">${dsTarget(`QTY ${med.qty} / ${med.ds} DAYS SUPPLY`, ctx.sticker)}</div>
    <div class="ref">${med.refills > 0 ? `${med.refills} REFILLS BEFORE ${ctx.refillBy}` : 'NO REFILLS - DR AUTH REQUIRED'}</div>
    <div class="foot">DR. ${pt.prescriber} (217) 555-0142</div>
    <div class="warn">CAUTION: FEDERAL LAW PROHIBITS TRANSFER OF THIS DRUG TO ANY PERSON OTHER THAN THE PATIENT</div>
  </div>`;
}

const IND_CSS = `
  .ind .hdr { font-weight:bold; font-size:1.0em; text-align:center; letter-spacing:0.05em; }
  .ind .sub { font-size:0.6em; text-align:center; color:#222; padding:0.3em 0 0.9em; border-bottom:1px solid #444; margin-bottom:0.6em; }
  .ind .row { display:flex; justify-content:space-between; font-weight:bold; font-size:0.85em; }
  .ind .pt { font-weight:bold; font-size:0.95em; margin-top:0.7em; }
  .ind .addr { font-size:0.62em; color:#222; margin:0.2em 0 0.9em; }
  .ind .drug { font-weight:bold; font-size:1.1em; margin:0.3em 0; }
  .ind .sig { font-size:0.88em; margin:0.4em 0 0.7em; }
  .ind .qty { margin:0.35em 0; font-weight:bold; font-size:0.9em; }
  .ind .ref { font-size:0.78em; font-weight:bold; margin:0.45em 0; }
  .ind .foot { font-size:0.62em; margin-top:0.5em; }
  .ind .warn { font-size:0.5em; color:#333; margin-top:0.7em; }
`;

const FAMILIES = [
  { key: 'cvs', render: cvsLabel, css: CVS_CSS, dateFmt: fmt.slash4, rx: (m) => `04462${30 + m}`, phone: '2175550134' },
  { key: 'walgreens', render: walgreensLabel, css: WAL_CSS, dateFmt: fmt.slash2, rx: (m) => `12987${60 + m}-06012`, phone: '2175550188' },
  { key: 'kaiser', render: kaiserLabel, css: KP_CSS, dateFmt: fmt.month, rx: (m) => `20-55739${10 + m}`, phone: '8665550119' },
  { key: 'independent', render: independentLabel, css: IND_CSS, dateFmt: fmt.dash, rx: (m) => `7734${80 + m}`, phone: '2175550163' },
];

function pageHtml(inner, css, variant) {
  const fontSize = variant.kind === 'smallFont' ? 21 : 30;
  const rotate = variant.kind === 'rotated' ? `transform: rotate(${variant.deg}deg);` : '';
  const filter = variant.kind === 'lowContrast' ? 'filter: contrast(0.45) brightness(1.18);' : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1200px; height:900px; }
  body { background:#dcd9d3; font-family:Arial, Helvetica, sans-serif; display:flex; align-items:center; justify-content:center; }
  .wrap { ${rotate} ${filter} }
  .label { width:1120px; background:#fff; color:#101010; padding:1.0em 1.2em; font-size:${fontSize}px; box-shadow:0 2px 6px rgba(0,0,0,0.35); }
  .ds-target { position:relative; display:inline-block; }
  .sticker { position:absolute; left:-0.4em; top:-0.55em; min-width:110%; padding:0.32em 0.5em; background:#f5d33f; border:2px solid #cbb02a; color:#5b4a00; font-size:0.72em; font-weight:bold; text-align:center; transform:rotate(-3deg); box-shadow:0 1px 3px rgba(0,0,0,0.3); white-space:nowrap; z-index:5; }
  ${css}
</style></head><body><div class="wrap">${inner}</div></body></html>`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chrome 150's new headless mode writes the screenshot promptly but does
 * not always exit afterwards, so poll for a stable PNG and then kill the
 * whole process group instead of waiting on process exit.
 */
async function screenshot(htmlPath, pngPath, profileDir) {
  const child = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--mute-audio',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--user-data-dir=${profileDir}`,
    '--window-size=1200,900',
    `--screenshot=${pngPath}`,
    `file://${htmlPath}`,
  ], { stdio: 'ignore', detached: true });

  const deadline = Date.now() + 30000;
  let lastSize = -1;
  let stable = 0;
  while (Date.now() < deadline) {
    await sleep(100);
    if (!existsSync(pngPath)) continue;
    const size = statSync(pngPath).size;
    if (size > 0 && size === lastSize) {
      stable += 1;
      if (stable >= 3) break;
    } else {
      stable = 0;
      lastSize = size;
    }
  }
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // already exited
  }
  if (!existsSync(pngPath) || statSync(pngPath).size === 0) {
    throw new Error(`screenshot failed: ${pngPath}`);
  }
}

async function main() {
  rmSync(HTML_DIR, { recursive: true, force: true });
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(HTML_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const counts = {};
  let idx = 0;
  for (let f = 0; f < FAMILIES.length; f++) {
    const fam = FAMILIES[f];
    for (let m = 0; m < MEDS.length; m++, idx++) {
      const med = MEDS[m];
      const pt = PATIENTS[med.patient];
      const variant = variantFor(idx);
      const d = fillDateFor(f, m);
      const ctx = {
        rx: fam.rx(m),
        fill: fam.dateFmt(d),
        refillBy: fam.dateFmt(plusYear(d)),
        discard: fam.dateFmt(plusYear(d)),
        useBy: fam.dateFmt(plusYear(d)),
        sticker: variant.kind === 'sticker',
      };
      const base = `label-${p2(idx)}-${fam.key}-${med.key}`;
      const htmlPath = join(HTML_DIR, `${base}.html`);
      const pngPath = join(OUT_DIR, `${base}.png`);
      writeFileSync(htmlPath, pageHtml(fam.render(med, pt, ctx), fam.css, variant));

      const profileDir = `${PROFILE}-${idx}`;
      await screenshot(htmlPath, pngPath, profileDir);
      try {
        rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // Chrome may still be flushing the temp profile after SIGKILL; leave it to the OS temp cleaner.
      }

      const truth = {
        patientName: pt.name,
        drugName: med.generic,
        strength: med.strength,
        sig: med.sig,
        fillDate: fmt.iso(d),
        daySupply: med.ds,
        quantity: med.qty,
        refills: med.refills,
        rxNumber: ctx.rx,
        pharmacyPhone: fam.phone,
      };
      writeFileSync(
        join(OUT_DIR, `${base}.json`),
        JSON.stringify({ file: `${base}.png`, layout: fam.key, variant: variant.kind, truth }, null, 2) + '\n',
      );
      counts[variant.kind] = (counts[variant.kind] ?? 0) + 1;
      process.stdout.write(`${base}.png [${variant.kind}]\n`);
    }
  }
  process.stdout.write(`\nGenerated ${idx} labels: ${JSON.stringify(counts)}\n`);
}

await main();
