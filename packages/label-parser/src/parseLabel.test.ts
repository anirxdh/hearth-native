import type { OcrLine } from './types';
import { parseLabel } from './parseLabel';
import {
  normalizeName,
  normalizePhone,
  normalizeStrength,
  normalizeText,
  parseDate,
} from './normalize';

/** Build a stack of full-width lines, one per visual row. */
function stack(texts: string[], confidence = 1): OcrLine[] {
  return texts.map((text, i) => ({
    text,
    x: 40,
    y: 40 + i * 50,
    w: text.length * 14,
    h: 30,
    confidence,
  }));
}

function line(text: string, x: number, y: number, confidence = 1): OcrLine {
  return { text, x, y, w: text.length * 14, h: 30, confidence };
}

describe('parseLabel: CVS-style fixture', () => {
  const lines = stack([
    'CVS/pharmacy STORE #08421',
    '1206 W MONROE ST, SPRINGFIELD, IL 62704 PH: (217) 555-0134',
    'RX# 0446239 FILLED: 03/05/2026',
    'ROBERT ALVAREZ',
    '1420 WILLOW CREEK RD',
    'SPRINGFIELD, IL 62704',
    'METFORMIN HCL 500 MG TABLETS',
    'TAKE 1 TABLET BY MOUTH TWICE DAILY WITH MEALS',
    'QTY: 60 30 DAY SUPPLY',
    'REFILLS: 3 BY 03/05/2027',
    'DR. ANIL PATEL NDC 00093-1048-01',
    'DISCARD AFTER 03/05/2027',
  ]);
  const parsed = parseLabel(lines);

  it('extracts the drug name from the generics list', () => {
    expect(parsed.drugName?.value).toBe('METFORMIN');
    expect(parsed.drugName?.confidence).toBe(1);
  });

  it('extracts strength from the drug line', () => {
    expect(normalizeStrength(parsed.strength?.value ?? '')).toBe('500MG');
  });

  it('extracts the sig', () => {
    expect(parsed.sig?.value).toBe('TAKE 1 TABLET BY MOUTH TWICE DAILY WITH MEALS');
  });

  it('extracts the fill date, not the discard or refill-by date', () => {
    expect(parsed.fillDate?.value).toBe('2026-03-05');
  });

  it('extracts qty and day supply from a merged row', () => {
    expect(parsed.quantity?.value).toBe(60);
    expect(parsed.daySupply?.value).toBe(30);
  });

  it('extracts refills, rx number, phone, and patient name', () => {
    expect(parsed.refills?.value).toBe(3);
    expect(parsed.rxNumber?.value).toBe('0446239');
    expect(parsed.pharmacyPhone?.value).toBe('2175550134');
    expect(parsed.patientName?.value).toBe('ROBERT ALVAREZ');
  });
});

describe('parseLabel: table layout with label-only cells', () => {
  const y = (r: number) => 40 + r * 50;
  const lines: OcrLine[] = [
    line('KAISER PERMANENTE', 40, y(0)),
    line('MAIL ORDER PHARMACY - PO BOX 12500, DENVER, CO 80217', 40, y(1)),
    line('QUESTIONS? CALL 1-866-555-0119', 40, y(2)),
    line('FOR: ELEANOR ALVAREZ', 40, y(3)),
    line('DONEPEZIL HCL 10 MG TABLETS', 40, y(4)),
    line('TAKE 1 TABLET BY MOUTH AT BEDTIME', 40, y(5)),
    line('Rx No: 20-5573921', 40, y(6)),
    line('Fill Date: May 30, 2026', 520, y(6)),
    line('Qty:', 40, y(7)),
    line('30', 220, y(7)),
    line('Days Supply:', 520, y(7)),
    line('30', 800, y(7)),
    line('Refills Remaining: 4', 40, y(8)),
    line('USE BY: MAY 30, 2027', 40, y(9)),
  ];
  const parsed = parseLabel(lines);

  it('reads the labeled patient name', () => {
    expect(parsed.patientName?.value).toBe('ELEANOR ALVAREZ');
    expect(parsed.patientName?.confidence).toBe(1);
  });

  it('parses a month-name fill date and ignores USE BY', () => {
    expect(parsed.fillDate?.value).toBe('2026-05-30');
  });

  it('pairs label-only cells with the bare number to their right', () => {
    expect(parsed.quantity?.value).toBe(30);
    expect(parsed.daySupply?.value).toBe(30);
  });

  it('handles refills remaining, dashed rx numbers, and 1-800 style phones', () => {
    expect(parsed.refills?.value).toBe(4);
    expect(parsed.rxNumber?.value).toBe('20-5573921');
    expect(parsed.pharmacyPhone?.value).toBe('8665550119');
  });

  it('does not mistake USE BY for a sig', () => {
    expect(parsed.sig?.value).toBe('TAKE 1 TABLET BY MOUTH AT BEDTIME');
  });
});

describe('parseLabel: wrapped sig continuation', () => {
  const lines: OcrLine[] = [
    line('LEVOTHYROXINE SODIUM 75 MCG TABLETS', 40, 100),
    line('TAKE 1 TABLET BY MOUTH EVERY MORNING', 40, 150),
    line('ON AN EMPTY STOMACH', 40, 190),
    line('QTY 90 / 90 DAYS SUPPLY', 40, 240),
  ];
  const parsed = parseLabel(lines);

  it('joins the wrapped second line', () => {
    expect(parsed.sig?.value).toBe(
      'TAKE 1 TABLET BY MOUTH EVERY MORNING ON AN EMPTY STOMACH',
    );
  });

  it('does not join the qty row into the sig', () => {
    expect(parsed.quantity?.value).toBe(90);
    expect(parsed.daySupply?.value).toBe(90);
  });

  it('extracts mcg strength', () => {
    expect(normalizeStrength(parsed.strength?.value ?? '')).toBe('75MCG');
  });
});

describe('parseLabel: insulin and slash units', () => {
  const parsed = parseLabel(
    stack([
      'INSULIN GLARGINE 100 UNITS/ML SOLOSTAR PEN',
      'INJECT 20 UNITS UNDER THE SKIN AT BEDTIME',
      'QTY: 15 DAYS SUPPLY: 30',
    ]),
  );

  it('matches the multi-word generic', () => {
    expect(parsed.drugName?.value).toBe('INSULIN GLARGINE');
  });

  it('reads units-per-ml strength', () => {
    expect(normalizeStrength(parsed.strength?.value ?? '')).toBe('100UNITS/ML');
  });

  it('reads an INJECT sig', () => {
    expect(parsed.sig?.value).toBe('INJECT 20 UNITS UNDER THE SKIN AT BEDTIME');
  });

  it('prefers the labeled days supply over the qty number', () => {
    expect(parsed.quantity?.value).toBe(15);
    expect(parsed.daySupply?.value).toBe(30);
  });
});

describe('parseLabel: edge cases', () => {
  it('returns an empty object for no lines', () => {
    expect(parseLabel([])).toEqual({});
  });

  it('maps NO REFILLS to zero', () => {
    const parsed = parseLabel(stack(['AMLODIPINE BESYLATE 5 MG', 'NO REFILLS - DR AUTH REQUIRED']));
    expect(parsed.refills?.value).toBe(0);
  });

  it('parses N REFILLS BEFORE <date> without stealing the date as fill date', () => {
    const parsed = parseLabel(stack(['2 REFILLS BEFORE 06-18-2027']));
    expect(parsed.refills?.value).toBe(2);
    expect(parsed.fillDate).toBeUndefined();
  });

  it('fuzzy-matches a single OCR character error with reduced confidence', () => {
    const parsed = parseLabel(stack(['METF0RMIN HCL 500 MG TABLETS'], 0.9));
    expect(parsed.drugName?.value).toBe('METFORMIN');
    expect(parsed.drugName?.confidence).toBeLessThan(0.9);
  });

  it('prefers the pharmacy phone over the prescriber phone', () => {
    const parsed = parseLabel(
      stack([
        'OAK STREET PHARMACY',
        '314 OAK ST, SPRINGFIELD, IL 62701 (217) 555-0163',
        'IBUPROFEN 600 MG TABLETS',
        'DR. S. OKAFOR (217) 555-0142',
      ]),
    );
    expect(parsed.pharmacyPhone?.value).toBe('2175550163');
  });

  it('does not read an NDC as an rx number or phone', () => {
    const parsed = parseLabel(stack(['NDC 00093-1048-01']));
    expect(parsed.rxNumber).toBeUndefined();
    expect(parsed.pharmacyPhone).toBeUndefined();
  });

  it('reads comma-form patient names', () => {
    const parsed = parseLabel(
      stack(['WALGREENS', 'RX 1298765-06012', 'ALVAREZ, ELEANOR', 'SERTRALINE HCL 50 MG']),
    );
    expect(parsed.patientName?.value).toBe('ALVAREZ, ELEANOR');
    expect(normalizeName(parsed.patientName?.value ?? '')).toBe('ELEANOR ALVAREZ');
  });

  it('skips pharmacy and prescriber lines when hunting the patient name', () => {
    const parsed = parseLabel(
      stack([
        'OAK STREET PHARMACY',
        'DR. ANIL PATEL',
        'ROSA MARQUEZ',
        'LEVOTHYROXINE SODIUM 75 MCG',
      ]),
    );
    expect(parsed.patientName?.value).toBe('ROSA MARQUEZ');
  });

  it('carries reduced OCR confidence through to fields', () => {
    const parsed = parseLabel(stack(['METFORMIN HCL 500 MG TABLETS'], 0.5));
    expect(parsed.drugName?.confidence).toBeCloseTo(0.5);
  });
});

describe('normalize helpers', () => {
  it('parses US date formats to ISO', () => {
    expect(parseDate('FILLED: 06/24/2026')).toBe('2026-06-24');
    expect(parseDate('DATE FILLED: 6/2/26')).toBe('2026-06-02');
    expect(parseDate('FILLED 06-18-2026')).toBe('2026-06-18');
    expect(parseDate('Fill Date: May 30, 2026')).toBe('2026-05-30');
    expect(parseDate('FILL DATE: MARCH 3, 2026')).toBe('2026-03-03');
    expect(parseDate('30 MAY 2026')).toBe('2026-05-30');
    expect(parseDate('2026-05-30')).toBe('2026-05-30');
    expect(parseDate('no date here')).toBeUndefined();
    expect(parseDate('13/45/2026')).toBeUndefined();
  });

  it('normalizes text, names, strengths, phones', () => {
    expect(normalizeText('  Take 1   tablet ')).toBe('TAKE 1 TABLET');
    expect(normalizeName('ALVAREZ, ROBERT')).toBe('ROBERT ALVAREZ');
    expect(normalizeName('Robert Alvarez')).toBe('ROBERT ALVAREZ');
    expect(normalizeStrength('500 mg')).toBe('500MG');
    expect(normalizePhone('1-866-555-0119')).toBe('8665550119');
    expect(normalizePhone('(217) 555-0134')).toBe('2175550134');
  });
});
