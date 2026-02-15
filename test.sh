#!/bin/bash
set -e

echo "=== Cleaning DB ==="
psql -U authenx -d authenx -c 'DELETE FROM "Issuer"; DELETE FROM "Org";' 2>/dev/null || true

echo ""
echo "=== Test 1: Register Issuer ==="
curl -s -X POST http://localhost:3001/issuers/register \
  -H "Content-Type: application/json" \
  -d '{"issuerCode":"CVR","name":"CVR College","connectorBaseUrl":"http://localhost:3002"}' | python3 -m json.tool

echo ""
echo "=== Test 2: Verify Ping ==="
curl -s -X POST http://localhost:3001/verify/ping \
  -H "Content-Type: application/json" \
  -d '{"issuerCode":"CVR"}' | python3 -m json.tool

echo ""
echo "=== All tests complete ==="
