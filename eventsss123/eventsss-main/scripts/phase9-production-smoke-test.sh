#!/usr/bin/env bash
# Safe unauthenticated smoke test for explicitly supplied HTTPS API and web URLs.
# Does not send credentials, mutate data, or print full URLs.
set -Eeuo pipefail

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_https_base() {
  local name="$1"
  local value="$2"
  [[ -n "$value" ]] || fail "$name is required."
  [[ "$value" == https://* ]] || fail "$name must use HTTPS."
  [[ "$value" != *"@"* && "$value" != *$'\n'* && "$value" != *$'\r'* ]] \
    || fail "$name contains an unsafe URL component."
  [[ "$value" != *" "* ]] || fail "$name must not contain spaces."
}

API_BASE_URL="${API_BASE_URL%/}"
WEB_BASE_URL="${WEB_BASE_URL%/}"
require_https_base "API_BASE_URL" "$API_BASE_URL"
require_https_base "WEB_BASE_URL" "$WEB_BASE_URL"

timeout="${SMOKE_TIMEOUT_SECONDS:-15}"
[[ "$timeout" =~ ^[0-9]+$ ]] || fail "SMOKE_TIMEOUT_SECONDS must be an integer."
(( timeout >= 1 && timeout <= 120 )) || fail "SMOKE_TIMEOUT_SECONDS must be between 1 and 120."

check_endpoint() {
  local label="$1"
  local url="$2"
  local status
  status="$(curl --silent --show-error --location --output /dev/null \
    --write-out '%{http_code}' --connect-timeout 8 --max-time "$timeout" "$url")" \
    || fail "$label request failed (network/TLS/HTTP error)."
  [[ "$status" =~ ^2[0-9][0-9]$ ]] || fail "$label returned HTTP $status; expected 2xx."
  printf 'PASS: %-16s HTTP %s\n' "$label" "$status"
}

check_endpoint "API liveness" "$API_BASE_URL/health"
check_endpoint "API readiness" "$API_BASE_URL/ready"
check_endpoint "Web application" "$WEB_BASE_URL/"

printf 'SUCCESS: all three configured HTTPS smoke checks passed.\n'
