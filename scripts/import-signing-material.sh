#!/usr/bin/env bash
# Import iOS signing material (distribution cert + provisioning profile) on a CI macOS runner.
#
# Standard GitHub/Apple CI signing pattern: decode base64 secrets, import the
# distribution certificate into a *temporary, dedicated* keychain, and install
# the provisioning profile where Xcode looks for it. Run before `xcodebuild archive`.
#
# Reads these env vars (set by the calling workflow step from GitHub Secrets):
#   BUILD_CERTIFICATE_BASE64        — base64 of the .p12 distribution cert+key
#                                     (workflow maps this from secrets.IOS_BUILD_CERTIFICATE_BASE64)
#   P12_PASSWORD                    — password protecting the .p12
#                                     (from secrets.IOS_P12_PASSWORD)
#   BUILD_PROVISION_PROFILE_BASE64  — base64 of the .mobileprovision file
#                                     (from secrets.IOS_PROVISION_PROFILE_BASE64)
#
# Usage (locally or in CI):
#   BUILD_CERTIFICATE_BASE64=... P12_PASSWORD=... BUILD_PROVISION_PROFILE_BASE64=... \
#     ./scripts/import-signing-material.sh

set -euo pipefail

# Fail early with a clear message if any required secret is missing/empty.
: "${BUILD_CERTIFICATE_BASE64:?Set BUILD_CERTIFICATE_BASE64 (base64 .p12)}"
: "${P12_PASSWORD:?Set P12_PASSWORD (.p12 password)}"
: "${BUILD_PROVISION_PROFILE_BASE64:?Set BUILD_PROVISION_PROFILE_BASE64 (base64 .mobileprovision)}"

# A dedicated temp keychain keeps CI signing isolated from the runner's login
# keychain and is trivially discarded when the ephemeral runner is destroyed.
# A random password is fine: nothing outside this job needs to reopen it.
KEYCHAIN_PATH="$RUNNER_TEMP/signing.keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -base64 24)"

CERT_PATH="$RUNNER_TEMP/build_certificate.p12"
PROFILE_PATH="$RUNNER_TEMP/build_pp.mobileprovision"

# Decode secrets to disk (temp dir, cleaned up with the runner).
echo "$BUILD_CERTIFICATE_BASE64" | base64 --decode -o "$CERT_PATH"
echo "$BUILD_PROVISION_PROFILE_BASE64" | base64 --decode -o "$PROFILE_PATH"

# Create and unlock the temp keychain.
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
# Disable the relock-on-idle timeout so the keychain stays usable for the whole job.
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

# Import the cert+key. -A allows any app to access it without prompting, which
# pairs with set-key-partition-list below — the reliable, non-flaky pattern on
# headless CI runners (avoids "user interaction is not allowed" codesign errors).
security import "$CERT_PATH" \
  -P "$P12_PASSWORD" \
  -A \
  -t cert \
  -f pkcs12 \
  -k "$KEYCHAIN_PATH"

# Allow codesign/productbuild to use the key without an interactive UI prompt.
security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

# Add the temp keychain to the search list so xcodebuild can find the identity.
# Keep the user login keychain in the list to avoid breaking other tooling.
security list-keychain -d user -s "$KEYCHAIN_PATH" login.keychain-db

# Install the provisioning profile where Xcode looks for it.
PROFILES_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$PROFILES_DIR"
cp "$PROFILE_PATH" "$PROFILES_DIR/"

echo "Signing material imported into $KEYCHAIN_PATH and profile installed in $PROFILES_DIR"
