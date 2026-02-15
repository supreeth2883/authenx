#!/usr/bin/env bash
#
# AuthenX Demo Setup Script
# ─────────────────────────
# Boots the full production stack, seeds users, registers CVR issuer,
# issues credentials for 10 mock students, and prints a summary.
#
# Prerequisites: docker, docker compose, jq, curl
#
set -euo pipefail

API="http://localhost:3001"
WEB="http://localhost:3000"
COMPOSE_FILE="docker-compose.prod.yml"

# ── Colours ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${CYAN}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✔${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
fail()  { echo -e "${RED}✖${NC}  $*"; exit 1; }
header(){ echo -e "\n${BOLD}── $* ──${NC}"; }

# ── Pre-flight checks ───────────────────────────────────────────────
for cmd in docker jq curl; do
  command -v "$cmd" &>/dev/null || fail "$cmd is required but not installed"
done
docker compose version &>/dev/null || fail "docker compose plugin required"

# ── 1. Boot the stack ───────────────────────────────────────────────
header "Starting production stack"
docker compose -f "$COMPOSE_FILE" up -d --build 2>&1 | tail -5
ok "Docker compose started"

# ── 2. Wait for ALL containers healthy ──────────────────────────────
header "Waiting for services to become healthy"
SERVICES=(postgres redis cloud-api connector web)
MAX_WAIT=180
ELAPSED=0

for svc in "${SERVICES[@]}"; do
  printf "  Waiting for %-14s" "$svc…"
  while true; do
    STATUS=$(docker compose -f "$COMPOSE_FILE" ps --format json "$svc" 2>/dev/null \
      | jq -r '.Health // .State' 2>/dev/null || echo "starting")
    if [[ "$STATUS" == "healthy" ]]; then
      echo -e " ${GREEN}healthy${NC}"
      break
    fi
    if (( ELAPSED >= MAX_WAIT )); then
      echo -e " ${RED}timeout${NC}"
      fail "Service $svc did not become healthy within ${MAX_WAIT}s"
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
  done
done
ok "All services healthy"

# ── 3. Login as SUPER_ADMIN ─────────────────────────────────────────
header "Authenticating"
ADMIN_RESP=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@authenx.io","password":"Admin@2026"}')
ADMIN_TOKEN=$(echo "$ADMIN_RESP" | jq -r '.access_token')
[[ -n "$ADMIN_TOKEN" && "$ADMIN_TOKEN" != "null" ]] || fail "Super-admin login failed"
ok "Logged in as admin@authenx.io (SUPER_ADMIN)"

# ── 4. Register CVR issuer ──────────────────────────────────────────
header "Registering CVR Issuer"
ISSUER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/issuers/register" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "issuerCode": "CVR",
    "name": "CVR College of Engineering",
    "connectorBaseUrl": "http://connector:3002"
  }')
ISSUER_HTTP=$(echo "$ISSUER_RESP" | tail -1)
ISSUER_BODY=$(echo "$ISSUER_RESP" | sed '$d')

if [[ "$ISSUER_HTTP" == "201" ]]; then
  ok "CVR issuer registered"
elif [[ "$ISSUER_HTTP" == "409" ]]; then
  warn "CVR issuer already registered (skipping)"
else
  warn "Issuer registration returned HTTP $ISSUER_HTTP: $(echo "$ISSUER_BODY" | jq -r '.message // .' 2>/dev/null)"
fi

# ── 5. Login as COLLEGE_ADMIN ───────────────────────────────────────
COLLEGE_RESP=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"college@cvr.edu","password":"College@2026"}')
COLLEGE_TOKEN=$(echo "$COLLEGE_RESP" | jq -r '.access_token')
[[ -n "$COLLEGE_TOKEN" && "$COLLEGE_TOKEN" != "null" ]] || fail "College-admin login failed"
ok "Logged in as college@cvr.edu (COLLEGE_ADMIN)"

# ── 6. Issue credentials for mock students ──────────────────────────
header "Issuing credentials"
CREDENTIAL_IDS=()
ROWS=()
TOTAL=$(jq length apps/connector/data/mock_erp.json)
ISSUED=0
SKIPPED=0

for i in $(seq 0 $((TOTAL - 1))); do
  STUDENT=$(jq -c ".[$i]" apps/connector/data/mock_erp.json)
  NAME=$(echo "$STUDENT" | jq -r '.name')
  ROLL=$(echo "$STUDENT" | jq -r '.rollNumber')

  # Add issuerCode to payload
  PAYLOAD=$(echo "$STUDENT" | jq -c '. + {issuerCode: "CVR"}')

  RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/credentials/issue" \
    -H "Authorization: Bearer $COLLEGE_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$PAYLOAD")

  HTTP_CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')

  if [[ "$HTTP_CODE" == "201" ]]; then
    CID=$(echo "$BODY" | jq -r '.credentialId')
    CREDENTIAL_IDS+=("$CID")
    ROWS+=("$(printf '  %-22s  %-14s  %s' "$NAME" "$ROLL" "$CID")")
    ISSUED=$((ISSUED + 1))
    echo -e "  ${GREEN}✔${NC} $ROLL  $NAME → $CID"
  elif [[ "$HTTP_CODE" == "409" ]]; then
    # Already issued — extract the ID from the error message
    CID=$(echo "$BODY" | jq -r '.message' | grep -oP 'id=\K[^\)]+' || echo "unknown")
    CREDENTIAL_IDS+=("$CID")
    ROWS+=("$(printf '  %-22s  %-14s  %s (existing)' "$NAME" "$ROLL" "$CID")")
    SKIPPED=$((SKIPPED + 1))
    echo -e "  ${YELLOW}⏭${NC}  $ROLL  $NAME (already issued)"
  else
    echo -e "  ${RED}✖${NC}  $ROLL  $NAME — HTTP $HTTP_CODE"
  fi
done

ok "Issued: $ISSUED, Skipped (existing): $SKIPPED"

# ── 7. Summary ──────────────────────────────────────────────────────
header "Demo Ready!"

echo -e "\n${BOLD}Login URLs:${NC}"
echo -e "  Web app:         ${CYAN}$WEB/login${NC}"
echo -e "  Admin dashboard: ${CYAN}$WEB/admin${NC}"
echo -e "  Employer portal: ${CYAN}$WEB/employer${NC}"

echo -e "\n${BOLD}Seeded Users:${NC}"
printf "  %-24s %-18s %s\n" "EMAIL" "PASSWORD" "ROLE"
printf "  %-24s %-18s %s\n" "───────────────────────" "────────────────" "───────────"
printf "  %-24s %-18s %s\n" "admin@authenx.io" "Admin@2026" "SUPER_ADMIN"
printf "  %-24s %-18s %s\n" "college@cvr.edu" "College@2026" "COLLEGE_ADMIN"
printf "  %-24s %-18s %s\n" "hr@acme.com" "Employer@2026" "EMPLOYER"

echo -e "\n${BOLD}Issued Credentials (${#CREDENTIAL_IDS[@]}):${NC}"
printf "  %-22s  %-14s  %s\n" "NAME" "ROLL NUMBER" "CREDENTIAL ID"
printf "  %-22s  %-14s  %s\n" "──────────────────────" "──────────────" "─────────────────────────"
for row in "${ROWS[@]}"; do
  echo "$row"
done

echo -e "\n${BOLD}QR Verification URLs (scan as employer):${NC}"
for CID in "${CREDENTIAL_IDS[@]}"; do
  echo -e "  ${CYAN}$WEB/employer?credentialId=$CID${NC}"
done

echo -e "\n${GREEN}${BOLD}Demo is ready! Open ${WEB}/login to start.${NC}\n"
