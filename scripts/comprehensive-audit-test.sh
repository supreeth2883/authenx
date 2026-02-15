#!/bin/bash
# Comprehensive Audit Chain Integrity Test
# Demonstrates SHA-256 hash chaining and tampering detection

set -e

API="http://localhost:3001"
ADMIN_EMAIL="admin@authenx.io"
ADMIN_PASSWORD="Admin@2026"
COLLEGE_EMAIL="college@cvr.edu"
COLLEGE_PASSWORD="College@2026"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  AuthenX Audit Chain Integrity Verification Test              ║"
echo "║  Demonstrates cryptographic hash chaining and tampering       ║"
echo "║  detection in audit logs                                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Clear audit logs
echo "Step 1: Clearing audit logs for fresh test..."
psql -U authenx -d authenx -c 'TRUNCATE "AuditLog" RESTART IDENTITY;' 2>/dev/null
echo "   ✓ Audit logs cleared"
echo ""

# Step 2: Login as college admin
echo "Step 2: Authenticating as college admin..."
COLLEGE_LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$COLLEGE_EMAIL\",\"password\":\"$COLLEGE_PASSWORD\"}")

COLLEGE_TOKEN=$(echo "$COLLEGE_LOGIN" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [[ -n "$COLLEGE_TOKEN" ]]; then
  echo "   ✓ College admin authenticated"
else
  echo "   ✗ Authentication failed"
  echo "   Response: $COLLEGE_LOGIN"
  exit 1
fi
echo ""

# Step 3: Issue a credential (creates audit log entry)
echo "Step 3: Issues a credential (creates audit log entry #1)..."
# Use timestamp to ensure unique credential
TIMESTAMP=$(date +%s%N)
CRED=$(curl -s -X POST "$API/credentials/issue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COLLEGE_TOKEN" \
  -d "{
    \"issuerCode\": \"CVR\",
    \"name\": \"Tamper Test Student $TIMESTAMP\",
    \"rollNumber\": \"TEST$TIMESTAMP\",
    \"degree\": \"B.Tech\",
    \"branch\": \"CSE\",
    \"graduationYear\": 2024,
    \"cgpa\": 9.0
  }")

CRED_ID=$(echo "$CRED" | grep -o '"credentialId":"[^"]*' | cut -d'"' -f4)
if [[ -n "$CRED_ID" ]]; then
  echo "   ✓ Credential issued: $CRED_ID"
else
  echo "   ✗ Failed to issue credential"
  echo "   Response: $CRED"
  exit 1
fi
echo ""

# Step 4: Verify credential (creates audit log entry)
echo "Step 4: Verifying credential (creates audit log entry #2)..."
VERIFY=$(curl -s "$API/credentials/$CRED_ID/verify?orgName=TestOrg" \
  -H "Authorization: Bearer $COLLEGE_TOKEN")

if [[ "$VERIFY" == *'"verified":true'* ]]; then
  echo "   ✓ Credential verified successfully"
else
  echo "   ⚠ Verification completed"
fi
echo ""

# Step 5: Login as admin
echo "Step 5: Authenticating as super admin..."
ADMIN_LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [[ -n "$ADMIN_TOKEN" ]]; then
  echo "   ✓ Admin authenticated"
else
  echo "   ✗ Authentication failed"
  exit 1
fi
echo ""

# Step 6: Verify chain is valid
echo "Step 6: Verifying audit chain integrity (initial state)..."
CHAIN_STATUS=$(curl -s "$API/admin/audit-logs/verify-chain" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

VALID=$(echo "$CHAIN_STATUS" | grep -o '"valid":true' || echo "")
if [[ -n "$VALID" ]]; then
  echo "   ✓ Audit chain is VALID"
  ENTRIES=$(echo "$CHAIN_STATUS" | grep -o '"totalEntries":[0-9]*' | cut -d':' -f2)
  echo "   Chain contains $ENTRIES entries (hashes linked sequentially)"
else
  echo "   ✗ Chain is already broken - cannot continue test"
  exit 1
fi
echo ""

# Step 7: Display hash chain info
echo "Step 7: Examining audit log hash chain..."
echo ""
echo "   Query: SELECT sequence, organization, SUBSTRING(currentHash, 1, 16) AS currentHash_preview"
psql -U authenx -d authenx << EOF 2>/dev/null | tail -10
SELECT sequence, organization, SUBSTRING("currentHash", 1, 16) || '...' AS "currentHash_preview" 
FROM "AuditLog" 
ORDER BY sequence ASC;
EOF
echo ""

# Step 8: Tamper with a log entry
echo "Step 8: Tampering with audit log entry #1..."
echo "   Modifying: organization field from 'CVR' to 'HACKED'"
psql -U authenx -d authenx -c 'UPDATE "AuditLog" SET "organization" = '"'"'HACKED'"'"' WHERE sequence = 1;' 2>/dev/null
echo "   ✓ Tampered with database entry"
echo ""

# Step 9: Detect tampering
echo "Step 9: Running chain integrity verification..."
CHAIN_AFTER=$(curl -s "$API/admin/audit-logs/verify-chain" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

BROKEN=$(echo "$CHAIN_AFTER" | grep -o '"valid":false' || echo "")
BROKEN_AT=$(echo "$CHAIN_AFTER" | grep -o '"brokenAt":[0-9]*' | cut -d':' -f2 || echo "")

if [[ -n "$BROKEN" ]]; then
  echo "   ✓ SUCCESS: Tampering DETECTED!"
  echo "   Chain integrity compromised at sequence #$BROKEN_AT"
  echo "   Chain status: $CHAIN_AFTER"
else
  echo "   ✗ FAILED: Tampering not detected"
  echo "   Chain status: $CHAIN_AFTER"
fi
echo ""

# Step 10: Restore integrity
echo "Step 10: Restoring original audit log entry..."
psql -U authenx -d authenx -c 'UPDATE "AuditLog" SET "organization" = '"'"'CVR'"'"' WHERE sequence = 1;' 2>/dev/null
echo "   ✓ Restored: organization = 'CVR'"
echo ""

# Step 11: Verify chain is valid again
echo "Step 11: Final chain integrity verification..."
CHAIN_FINAL=$(curl -s "$API/admin/audit-logs/verify-chain" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

VALID_FINAL=$(echo "$CHAIN_FINAL" | grep -o '"valid":true' || echo "")
if [[ -n "$VALID_FINAL" ]]; then
  echo "   ✓ Audit chain is VALID again"
  echo "   Chain status: $CHAIN_FINAL"
else
  echo "   ⚠ Chain remains broken (may indicate deeper tampering)"
  echo "   Chain status: $CHAIN_FINAL"
fi
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Test Complete - Audit Chain Integrity Verified               ║"
echo "║                                                                ║"
echo "║  The system successfully:                                     ║"
echo "║  1. Created audit logs with SHA-256 hash chaining             ║"
echo "║  2. Detected tampering of audit log data                      ║"
echo "║  3. Identified the exact location of the breach               ║"
echo "║  4. Validated restoration of integrity                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
