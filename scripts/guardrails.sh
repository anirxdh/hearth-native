#!/usr/bin/env bash
# House-rule guardrails, run in CI on every push.
# Each check greps product source; docs and tests are exempt where noted.
set -uo pipefail

fail=0
SRC_DIRS=(apps/mobile/src packages/core/src packages/schema/src packages/print/src packages/label-parser/src)

echo "── guardrail: no em dashes in product source (house style)"
if grep -rn --include='*.ts' --include='*.tsx' -e '—' "${SRC_DIRS[@]}" | grep -v '__tests__'; then
  echo "FAIL: em dash found (use commas, colons, or periods)"; fail=1
else
  echo "ok"
fi

echo "── guardrail: no emojis in product source (professional UI, Lucide icons only)"
if ! python3 - "${SRC_DIRS[@]}" <<'PY'
import pathlib, re, sys
emoji = re.compile('[\U0001F300-\U0001FAFF\u2600-\u27BF]')
bad = []
for d in sys.argv[1:]:
    for p in pathlib.Path(d).rglob('*.ts*'):
        if '__tests__' in p.parts: continue
        for i, line in enumerate(p.read_text(encoding='utf-8').splitlines(), 1):
            if emoji.search(line):
                bad.append(f"{p}:{i}: {line.strip()[:80]}")
if bad:
    print('\n'.join(bad)); sys.exit(1)
PY
then
  echo "FAIL: emoji found in source"; fail=1
else
  echo "ok"
fi

echo "── guardrail: no console.log in app source (PHI could leak into device logs)"
if grep -rn --include='*.ts' --include='*.tsx' 'console\.log' apps/mobile/src | grep -v '__tests__' | grep -v 'dev/'; then
  echo "FAIL: console.log found (use nothing, or a scrubbed logger)"; fail=1
else
  echo "ok"
fi

echo "── guardrail: notification payloads must never name a person or drug"
# The planner is the single source of payload text; assert the generic string is intact.
if ! grep -q 'A medication needs attention' packages/core/src/notifications.ts; then
  echo "FAIL: generic notification payload text changed; check PHI exposure"; fail=1
else
  echo "ok"
fi

echo "── guardrail: no PII in URLs (deep links must carry ids only)"
if grep -rn --include='*.tsx' --include='*.ts' -E "router\.push\([^)]*(fullName|preferredName|phone|dob)" apps/mobile/src; then
  echo "FAIL: personal data interpolated into a route"; fail=1
else
  echo "ok"
fi

echo "── guardrail: emergency guides keep their review stamp"
if ! grep -q "review:" apps/mobile/src/content/guides.tsx; then
  echo "FAIL: guide review metadata missing"; fail=1
else
  echo "ok"
fi

exit $fail
