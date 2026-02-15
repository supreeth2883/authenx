#!/bin/bash
set -e

API="http://localhost:3001"

echo "=========================================="
echo "  AuthenX Credential Issuance E2E Test"
echo "=========================================="

# 1. Register issuer (may already exist, that's ok)
echo ""
echo ">>> Step 1: Register issuer CVR"
REGISTER=$(curl -s -w "\n%{http_code}" "$API/issuers/register" \
  -H "Content-Type: application/json" \
  -d '{"issuerCode":"CVR","name":"CVR College of Engineering","connectorBaseUrl":"http://localhost:3002"}')
HTTP_CODE=$(echo "$REGISTER" | tail -1)
BODY=$(echo "$REGISTER" | head -n -1)
echo "HTTP $HTTP_CODE"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

# 2. Issue a credential
echo ""
echo ">>> Step 2: Issue a credential"
ISSUE=$(curl -s -w "\n%{http_code}" "$API/credentials/issue" \
  -H "Content-Type: application/json" \
  -d '{
    "issuerCode": "CVR",
    "name": "Supreeth Chaluvadi",
    "rollNumber": "21B81A0501",
    "degree": "B.Tech",
    "branch": "Computer Science",
    "graduationYear": 2025,
    "cgpa": 8.75
  }')
HTTP_CODE=$(echo "$ISSUE" | tail -1)
BODY=$(echo "$ISSUE" | head -n -1)
echo "HTTP $HTTP_CODE"
echo "$BODY" | python3 -m json.tool

# Extract credential ID
CRED_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['credentialId'])")
echo "Credential ID: $CRED_ID"

# 3. Verify the credential
echo ""
echo ">>> Step 3: Verify credential $CRED_ID"
VERIFY=$(curl -s "$API/credentials/$CRED_ID/verify")
echo "$VERIFY" | python3 -m json.tool

echo ""
echo "=========================================="
echo "  E2E Test Complete!"
echo "=========================================="
