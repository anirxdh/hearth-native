import { describeAccess } from '../accessLabels';

describe('describeAccess', () => {
  test.each([
    ['er_sheet.print', 'Printed the ER sheet'],
    ['er_sheet.share', 'Shared the ER sheet'],
    ['one_pager.print', 'Printed the one-pager'],
    ['portfolio.share', 'Shared the everyone pack'],
    ['backup.export', 'Exported an encrypted backup'],
    ['backup.import', 'Restored from a backup'],
  ])('%s -> %s', (what, expected) => {
    expect(describeAccess(what)).toBe(expected);
  });

  test('carries the subject through for parameterized events', () => {
    expect(describeAccess('guide.print:fall')).toBe('Printed a guide: fall');
    expect(describeAccess('document.share:Insurance card')).toBe('Shared a document: Insurance card');
  });

  test('unknown events pass through verbatim rather than crashing', () => {
    expect(describeAccess('future.event:x')).toBe('future.event:x');
  });
});
