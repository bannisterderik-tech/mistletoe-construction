#!/usr/bin/env bash
# Backend smoke test — verifies each endpoint's contract (auth gates, validation,
# method guards) against the live site without sending any real data.
# Usage: bash scripts/smoke.sh [https://mistletoeconstruction.com]
set -u
BASE="${1:-https://mistletoeconstruction.com}"
pass=0; fail=0
check() { # name  expected  actual
  if [ "$2" = "$3" ]; then echo "  ok  $1 ($3)"; pass=$((pass+1));
  else echo "  FAIL $1 — expected $2 got $3"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

echo "Smoke testing $BASE"

echo "[auth gates — must reject unauthenticated]"
check "social-post admins-only"   403 "$(code -X POST "$BASE/api/social-post"   -H 'Content-Type: application/json' -d '{}')"
check "social-update admins-only" 403 "$(code -X POST "$BASE/api/social-update" -H 'Content-Type: application/json' -d '{}')"
check "set-pricing admins-only"   403 "$(code -X POST "$BASE/api/set-pricing"   -H 'Content-Type: application/json' -d '{}')"
check "create-invoice not-allowed" 403 "$(code -X POST "$BASE/api/create-invoice" -H 'Content-Type: application/json' -d '{}')"

echo "[validation — must 400 on missing input]"
check "sign-contract missing token"  400 "$(code -X POST "$BASE/api/sign-contract" -H 'Content-Type: application/json' -d '{}')"
check "get-proposal missing token"   400 "$(code "$BASE/api/get-proposal")"
check "submit-lead missing fields"   400 "$(code -X POST "$BASE/api/submit-lead" -H 'Content-Type: application/json' -d '{}')"
check "accept-proposal missing token" 400 "$(code -X POST "$BASE/api/accept-proposal" -H 'Content-Type: application/json' -d '{}')"
check "create-checkout unknown kind" 400 "$(code -X POST "$BASE/api/create-checkout" -H 'Content-Type: application/json' -d '{}')"

echo "[method guards — GET on POST-only must 405]"
check "social-post GET 405"   405 "$(code "$BASE/api/social-post")"
check "create-invoice GET 405" 405 "$(code "$BASE/api/create-invoice")"

echo "[public reads OK]"
check "pricing 200"      200 "$(code "$BASE/api/pricing")"
check "library.json 200" 200 "$(code "$BASE/social/library.json")"

echo
echo "Passed: $pass   Failed: $fail"
[ "$fail" -eq 0 ]
