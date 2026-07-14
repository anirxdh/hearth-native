#!/usr/bin/env bash
# Run the Maestro E2E flows against the iOS simulator, free and local.
# Usage: ./scripts/e2e-local.sh [--build]
#   --build  rebuild the Release simulator app first (otherwise reuses the
#            installed dev/Release build already on the booted simulator)
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v maestro >/dev/null; then
  echo "Maestro is not installed. Install with:"
  echo "  curl -fsSL https://get.maestro.mobile.dev | bash"
  exit 1
fi

if [[ "${1:-}" == "--build" ]]; then
  echo "── Building Release app for the simulator"
  (cd apps/mobile && npx expo prebuild -p ios --no-install)
  (cd apps/mobile/ios && LANG=en_US.UTF-8 pod install)
  (cd apps/mobile/ios && xcodebuild -workspace Hearth.xcworkspace -scheme Hearth \
    -configuration Release -sdk iphonesimulator -derivedDataPath build | tail -5)
  UDID=$(xcrun simctl list devices available -j | python3 -c "import json,sys; d=json.load(sys.stdin)['devices']; print(next(dev['udid'] for devs in d.values() for dev in devs if dev['name'].startswith('iPhone')))")
  xcrun simctl bootstatus "$UDID" -b || xcrun simctl boot "$UDID"
  xcrun simctl install "$UDID" apps/mobile/ios/build/Build/Products/Release-iphonesimulator/Hearth.app
fi

echo "── Running flows in .maestro/"
maestro test .maestro/
