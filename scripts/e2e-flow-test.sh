#!/bin/bash
#
# AuthenX E2E Flow Test
# Tests the full credential lifecycle:
#   SUPER_ADMIN registers issuer + seeds ERP →
#   COLLEGE_ADMIN publishes credential →
#   EMPLOYER verifies →
#   PUBLIC verify →
#   COLLEGE_ADMIN revokes →
#   Re-verify shows REVOKED
#
# Usage:
#   ./scripts/e2e-flow-test.sh                          # default: http://localhost:3001
#   ./scripts/e2e-flow-test.sh https://api.authenx.io   # production
#
set -euo pipefail

API="${1:-http://localhost:3001}"
COOKIE_DIR=$(mktemp -d)
trap 'rm -rf "$COOKIE_DIR"' EXIT

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0
TOTAL=0

# ─── Helpers ───────────────────────────────────────────

step() {
  TOTAL=$((TOTAL + 1))
  echo ""
  echo -e "${CYAN}${BOLD}[$TOTAL] $1${NC}"
  echo -e "    ${YELLOW}$2${NC}"
}

pass() {
  PASS=$((PASS + 1))
  echo -e "    ${GREEN}✓ PASS${NC} — $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo -e "    ${RED}✗ FAIL${NC} — $1"
}

skip() {
  SKIP=$((SKIP + 1))
  echo -e "    ${YELLOW}⏭ SKIP${NC} — $1"
}

# JSON-safe extraction (uses python3 as fallback if jq not found)
json_get() {
  local json="$1" key="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r "$key" 2>/dev/null || echo ""
  else
    echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(eval('d$key'.replace('.','[\"').replace('[\"','[\"',1) + '\"]'))" 2>/dev/null || echo ""
  fi
}

# HTTP request with cookie jar
api_call() {
  local method="$1" path="$2" cookie_jar="$3"
  shift 3
  local body="${1:-}"

  local args=(-s -w "\n%{http_code}" -b "$cookie_jar" -c "$cookie_jar")
  args+=(-X "$method")
  args+=(-H "Content-Type: application/json")
  if [[ -n "$body" ]]; then
    args+=(-d "$body")
  fi
  curl "${args[@]}" "$API$path"
}

# Parse response: body + http code
parse_response() {
  local response="$1"
  BODY=$(echo "$response" | sed '$d')
  HTTP_CODE=$(echo "$response" | tail -1)
}

# ─── Credentials ───────────────────────────────────────

ADMIN_JAR="$COOKIE_DIR/admin.cookies"
COLLEGE_JAR="$COOKIE_DIR/college.cookies"
EMPLOYER_JAR="$COOKIE_DIR/employer.cookies"
touch "$ADMIN_JAR" "$COLLEGE_JAR" "$EMPLOYER_JAR"

CRED_ID=""
ISSUER_CODE="CVR"
QA_ROLL="E2E-TEST-$(date +%s)"

echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "${BOLD}  AuthenX End-to-End Flow Test${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "  API: ${CYAN}$API${NC}"
echo -e "  Issuer: ${CYAN}$ISSUER_CODE${NC}"
echo -e "  Test Roll: ${CYAN}$QA_ROLL${NC}"

# ─── Phase 1: Authentication ──────────────────────────

step "Login as SUPER_ADMIN" "POST /auth/login (admin@authenx.io)"
parse_response "$(api_call POST /auth/login "$ADMIN_JAR" '{"email":"admin@authenx.io","password":"Admin@2026"}')"
if [[ "$HTTP_CODE" == "200" ]]; then
  ADMIN_EMAIL=$(json_get "$BODY" '.email')
  pass "Authenticated as $ADMIN_EMAIL"
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

step "Login as COLLEGE_ADMIN" "POST /auth/login (college@cvr.edu)"
parse_response "$(api_call POST /auth/login "$COLLEGE_JAR" '{"email":"college@cvr.edu","password":"College@2026"}')"
if [[ "$HTTP_CODE" == "200" ]]; then
  COLLEGE_EMAIL=$(json_get "$BODY" '.email')
  pass "Authenticated as $COLLEGE_EMAIL"
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

step "Login as EMPLOYER" "POST /auth/login (hr@acme.com)"
parse_response "$(api_call POST /auth/login "$EMPLOYER_JAR" '{"email":"hr@acme.com","password":"Employer@2026"}')"
if [[ "$HTTP_CODE" == "200" ]]; then
  EMPLOYER_EMAIL=$(json_get "$BODY" '.email')
  pass "Authenticated as $EMPLOYER_EMAIL"
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

# ─── Phase 2: Infrastructure ─────────────────────────

step "Cloud API Health" "GET /admin/health"
parse_response "$(api_call GET /admin/health "$ADMIN_JAR")"
if [[ "$HTTP_CODE" == "200" ]]; then
  pass "API + PostgreSQL healthy"
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

step "Connector Ping" "POST /admin/issuers/$ISSUER_CODE/ping"
parse_response "$(api_call POST "/admin/issuers/$ISSUER_CODE/ping" "$ADMIN_JAR")"
if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "201" ]]; then
  PING_OK=$(json_get "$BODY" '.ok')
  if [[ "$PING_OK" == "true" ]]; then
    pass "Connector reachable"
  else
    fail "Connector unreachable: $BODY"
  fi
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

# ─── Phase 3: Mock ERP Seed ──────────────────────────

step "Seed Test Student into Mock ERP" "POST /admin/issuers/$ISSUER_CODE/erp/upsert-batch"
ERP_BODY=$(cat <<EOF
{
  "records": [
    {
      "rollNumber": "$QA_ROLL",
      "name": "E2E Test Student",
      "degree": "B.Tech",
      "branch": "Computer Science",
      "graduationYear": 2025,
      "cgpa": 9.0
    }
  ]
}
EOF
)
parse_response "$(api_call POST "/admin/issuers/$ISSUER_CODE/erp/upsert-batch" "$ADMIN_JAR" "$ERP_BODY")"
if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "201" ]]; then
  pass "Seeded $QA_ROLL into mock ERP"
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

step "Verify ERP Records Populated" "GET /admin/issuers/$ISSUER_CODE/erp/records"
parse_response "$(api_call GET "/admin/issuers/$ISSUER_CODE/erp/records" "$ADMIN_JAR")"
if [[ "$HTTP_CODE" == "200" ]]; then
  if echo "$BODY" | grep -qi "$QA_ROLL"; then
    pass "Found $QA_ROLL in ERP records"
  else
    fail "$QA_ROLL not found in ERP response"
  fi
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

# ─── Phase 4: Credential Issuance (COLLEGE_ADMIN) ────

step "Precheck Student Against ERP" "POST /college/credentials/precheck"
PRECHECK_BODY=$(cat <<EOF
{
  "issuerCode": "$ISSUER_CODE",
  "rollNumber": "$QA_ROLL",
  "name": "E2E Test Student",
  "degree": "B.Tech",
  "branch": "Computer Science",
  "graduationYear": 2025,
  "cgpa": 9.0
}
EOF
)
parse_response "$(api_call POST /college/credentials/precheck "$COLLEGE_JAR" "$PRECHECK_BODY")"
if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "201" ]]; then
  MATCHED=$(json_get "$BODY" '.matched')
  if [[ "$MATCHED" == "true" ]]; then
    pass "ERP precheck matched"
  else
    REASON=$(json_get "$BODY" '.reason')
    fail "ERP precheck not matched: $REASON"
  fi
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

step "Publish Credential" "POST /college/credentials/publish"
PUBLISH_BODY=$(cat <<EOF
{
  "issuerCode": "$ISSUER_CODE",
  "records": [
    {
      "rollNumber": "$QA_ROLL",
      "name": "E2E Test Student",
      "degree": "B.Tech",
      "branch": "Computer Science",
      "graduationYear": 2025,
      "cgpa": 9.0
    }
  ]
}
EOF
)
parse_response "$(api_call POST /college/credentials/publish "$COLLEGE_JAR" "$PUBLISH_BODY")"
if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "201" ]]; then
  # Extract credential ID from results array
  CRED_ID=$(echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('results', [])
for r in results:
    if r.get('status') == 'issued' and r.get('credentialId'):
        print(r['credentialId'])
        break
" 2>/dev/null || echo "")
  if [[ -n "$CRED_ID" ]]; then
    pass "Credential issued: $CRED_ID"
  else
    # May already exist (duplicate)
    DETAIL=$(json_get "$BODY" '.results[0].status')
    if [[ "$DETAIL" == "duplicate" ]]; then
      CRED_ID=$(json_get "$BODY" '.results[0].credentialId')
      pass "Already exists (duplicate): $CRED_ID"
    else
      fail "No credentialId in response: $BODY"
    fi
  fi
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

# ─── Phase 5: Verification ───────────────────────────

step "Employer Verify" "GET /employer/verify/$CRED_ID"
if [[ -n "$CRED_ID" ]]; then
  parse_response "$(api_call GET "/employer/verify/$CRED_ID?orgName=E2E-Test" "$EMPLOYER_JAR")"
  if [[ "$HTTP_CODE" == "200" ]]; then
    VERIFIED=$(json_get "$BODY" '.verification.verified')
    HASH_OK=$(json_get "$BODY" '.verification.hashValid')
    SIG_OK=$(json_get "$BODY" '.verification.signatureValid')
    if [[ "$VERIFIED" == "true" ]]; then
      pass "VERIFIED — hash:$HASH_OK sig:$SIG_OK"
    else
      fail "Not verified: $BODY"
    fi
  else
    fail "HTTP $HTTP_CODE — $BODY"
  fi
else
  skip "No credential ID"
fi

step "Public Verify (no auth)" "GET /public/verify/$CRED_ID"
if [[ -n "$CRED_ID" ]]; then
  # Public verify — no cookie jar needed, but curl needs one for syntax
  parse_response "$(curl -s -w "\n%{http_code}" -X GET "$API/public/verify/$CRED_ID")"
  if [[ "$HTTP_CODE" == "200" ]]; then
    VERIFIED=$(json_get "$BODY" '.verification.verified')
    HASH_OK=$(json_get "$BODY" '.verification.hashValid')
    SIG_OK=$(json_get "$BODY" '.verification.signatureValid')
    if [[ "$VERIFIED" == "true" ]]; then
      pass "VERIFIED (public) — hash:$HASH_OK sig:$SIG_OK"
    else
      fail "Not verified: $BODY"
    fi
  else
    fail "HTTP $HTTP_CODE — $BODY"
  fi
else
  skip "No credential ID"
fi

# ─── Phase 6: Revocation ─────────────────────────────

step "Revoke Credential" "PATCH /college/credentials/$CRED_ID/revoke"
if [[ -n "$CRED_ID" ]]; then
  parse_response "$(api_call PATCH "/college/credentials/$CRED_ID/revoke" "$COLLEGE_JAR" '{"reason":"E2E test revocation"}')"
  if [[ "$HTTP_CODE" == "200" ]]; then
    pass "Credential revoked"
  elif [[ "$HTTP_CODE" == "409" ]] || [[ "$HTTP_CODE" == "400" ]]; then
    # Already revoked from a previous test run — acceptable
    pass "Already revoked (expected if re-running)"
  else
    fail "HTTP $HTTP_CODE — $BODY"
  fi
else
  skip "No credential ID"
fi

step "Re-verify Shows REVOKED" "GET /public/verify/$CRED_ID"
if [[ -n "$CRED_ID" ]]; then
  parse_response "$(curl -s -w "\n%{http_code}" -X GET "$API/public/verify/$CRED_ID")"
  if [[ "$HTTP_CODE" == "200" ]]; then
    REVOKED=$(json_get "$BODY" '.verification.revoked')
    if [[ "$REVOKED" == "true" ]]; then
      pass "Correctly shows REVOKED"
    else
      fail "Expected revoked=true, got: $BODY"
    fi
  else
    fail "HTTP $HTTP_CODE — $BODY"
  fi
else
  skip "No credential ID"
fi

# ─── Phase 7: Audit Integrity ────────────────────────

step "Audit Chain Integrity" "GET /admin/audit-logs/verify-chain"
parse_response "$(api_call GET /admin/audit-logs/verify-chain "$ADMIN_JAR")"
if [[ "$HTTP_CODE" == "200" ]]; then
  CHAIN_VALID=$(json_get "$BODY" '.valid')
  TOTAL_ENTRIES=$(json_get "$BODY" '.totalEntries')
  if [[ "$CHAIN_VALID" == "true" ]]; then
    pass "Chain intact — $TOTAL_ENTRIES entries"
  else
    fail "Chain broken: $BODY"
  fi
else
  fail "HTTP $HTTP_CODE — $BODY"
fi

# ─── Summary ─────────────────────────────────────────

echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "  ${GREEN}$PASS passed${NC}  ${RED}$FAIL failed${NC}  ${YELLOW}$SKIP skipped${NC}  (${TOTAL} total)"
echo -e "${BOLD}══════════════════════════════════════════${NC}"

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "  ${RED}${BOLD}E2E FLOW: FAILED${NC}"
  exit 1
else
  echo -e "  ${GREEN}${BOLD}E2E FLOW: ALL PASSED${NC}"
  exit 0
fi
