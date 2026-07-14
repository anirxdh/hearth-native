/** Plain-English labels for access-log entries. Pure; unit-tested. */

const WHAT_LABEL: [RegExp, string][] = [
  [/^er_sheet\.print/, 'Printed the ER sheet'],
  [/^er_sheet\.share/, 'Shared the ER sheet'],
  [/^one_pager\.print/, 'Printed the one-pager'],
  [/^one_pager\.share/, 'Shared the one-pager'],
  [/^portfolio\.print/, 'Printed the everyone pack'],
  [/^portfolio\.share/, 'Shared the everyone pack'],
  [/^guide\.print:(.+)/, 'Printed a guide'],
  [/^guide\.share:(.+)/, 'Shared a guide'],
  [/^document\.share:(.+)/, 'Shared a document'],
  [/^backup\.export/, 'Exported an encrypted backup'],
  [/^backup\.import/, 'Restored from a backup'],
];

export function describeAccess(what: string): string {
  for (const [re, label] of WHAT_LABEL) {
    const m = re.exec(what);
    if (m) return m[1] ? `${label}: ${m[1]}` : label;
  }
  return what;
}
