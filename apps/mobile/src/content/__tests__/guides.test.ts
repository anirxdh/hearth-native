/**
 * The emergency guides are static safety content; this suite pins the
 * invariants a clinician reviewer and App Review both care about.
 */
import { GUIDES } from '../guides';

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const EM_DASH = /—/;

describe('emergency guide content', () => {
  test('exactly six guides with the expected ids', () => {
    expect(GUIDES.map((g) => g.id).sort()).toEqual(
      ['bleeding', 'chest-pain', 'choking', 'confusion', 'fall', 'stroke'].sort(),
    );
  });

  test('every guide has exactly four steps, numbered 1 to 4, each with art', () => {
    for (const g of GUIDES) {
      expect(g.steps).toHaveLength(4);
      expect(g.steps.map((s) => s.n)).toEqual([1, 2, 3, 4]);
      for (const s of g.steps) {
        expect(typeof s.Art).toBe('function');
        expect(s.title.length).toBeGreaterThan(3);
        expect(s.body.length).toBeGreaterThan(20);
      }
    }
  });

  test('call-first guides are marked: choking, stroke, chest pain, bleeding', () => {
    const callFirst = GUIDES.filter((g) => g.callFirst).map((g) => g.id).sort();
    expect(callFirst).toEqual(['bleeding', 'chest-pain', 'choking', 'stroke'].sort());
  });

  test('blood-thinner warnings are present on fall and bleeding', () => {
    for (const id of ['fall', 'bleeding']) {
      const g = GUIDES.find((x) => x.id === id)!;
      expect(g.warning?.toLowerCase()).toContain('blood thinner');
    }
  });

  test('every guide wears its review stamp', () => {
    for (const g of GUIDES) {
      expect(g.review.version).toBeTruthy();
      expect(g.review.reviewer).toBeTruthy();
      expect(g.review.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('house style: no emojis, no em dashes, anywhere in guide copy', () => {
    for (const g of GUIDES) {
      const text = [g.title, g.oneLiner, g.warning ?? '', ...g.steps.flatMap((s) => [s.title, s.body])].join(' ');
      expect(text).not.toMatch(EMOJI);
      expect(text).not.toMatch(EM_DASH);
    }
  });

  test('stroke guide teaches FAST and notes the time of onset', () => {
    const stroke = GUIDES.find((g) => g.id === 'stroke')!;
    const all = stroke.steps.map((s) => `${s.title} ${s.body}`).join(' ').toLowerCase();
    for (const word of ['face', 'arm', 'speech', 'time']) {
      expect(all).toContain(word);
    }
  });

  test('no step ever instructs a medication dose', () => {
    const dosePattern = /\b\d+\s?(mg|mcg|tablets?|pills?)\b/i;
    for (const g of GUIDES) {
      for (const s of g.steps) {
        expect(`${s.title} ${s.body}`).not.toMatch(dosePattern);
      }
    }
  });
});
