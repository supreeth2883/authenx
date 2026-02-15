#!/bin/bash
# AuthenX Production Validation Script
# Checks that all production files are in place and correctly configured

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  AuthenX Production Deployment Validation                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

check_file() {
  local file=$1
  local desc=$2
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $desc"
  else
    echo -e "${RED}✗${NC} $desc - NOT FOUND: $file"
    ((ERRORS++))
  fi
}

check_dir() {
  local dir=$1
  local desc=$2
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✓${NC} $desc"
  else
    echo -e "${RED}✗${NC} $desc - NOT FOUND: $dir"
    ((ERRORS++))
  fi
}

check_contains() {
  local file=$1
  local pattern=$2
  local desc=$3
  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $desc"
  else
    echo -e "${RED}✗${NC} $desc"
    ((ERRORS++))
  fi
}

echo "1. Checking Dockerfiles..."
check_file "apps/cloud-api/Dockerfile.prod" "cloud-api Dockerfile.prod"
check_file "apps/connector/Dockerfile.prod" "connector Dockerfile.prod"
check_file "apps/web/Dockerfile.prod" "web Dockerfile.prod"
echo ""

echo "2. Checking Docker Compose..."
check_file "docker-compose.prod.yml" "docker-compose.prod.yml"
echo ""

echo "3. Checking Environment Templates..."
check_file ".env.production.template" "Root .env.production.template"
check_file "apps/cloud-api/.env.production.template" "cloud-api .env.production.template"
check_file "apps/connector/.env.production.template" "connector .env.production.template"
check_file "apps/web/.env.production.template" "web .env.production.template"
echo ""

echo "4. Checking Build Artifacts..."
check_dir "apps/cloud-api/dist" "cloud-api dist/"
check_dir "apps/web/.next" "web .next/"
check_dir "apps/connector/dist" "connector dist/"
echo ""

echo "5. Checking package.json Scripts..."
check_contains "package.json" "prod:build" "Root package.json - prod:build script"
check_contains "package.json" "prod:up" "Root package.json - prod:up script"
check_contains "package.json" "prod:down" "Root package.json - prod:down script"
check_contains "apps/cloud-api/package.json" "migrate:prod" "cloud-api package.json - migrate:prod script"
check_contains "apps/web/package.json" "start:prod" "web package.json - start:prod script"
echo ""

echo "6. Checking Configuration Files..."
check_file ".dockerignore" ".dockerignore"
check_file "DEPLOYMENT.md" "DEPLOYMENT.md documentation"
check_contains "apps/web/next.config.ts" "output.*standalone" "web next.config.ts - standalone output"
echo ""

echo "7. Checking Security Configuration..."
check_contains "docker-compose.prod.yml" "POSTGRES_INITDB_ARGS" "PostgreSQL secure initialization"
check_contains "docker-compose.prod.yml" "requirepass" "Redis password authentication"
check_contains "docker-compose.prod.yml" "healthcheck" "Health checks configured"
echo ""

echo "8. Checking Service Ports..."
check_contains "docker-compose.prod.yml" "3001" "cloud-api port 3001"
check_contains "docker-compose.prod.yml" "3002" "connector port 3002"
check_contains "docker-compose.prod.yml" "3000" "web port 3000"
echo ""

echo "9. Checking Volume Configuration..."
check_contains "docker-compose.prod.yml" "postgres_data" "PostgreSQL volume"
check_contains "docker-compose.prod.yml" "redis_data" "Redis volume"
echo ""

echo "10. Checking Network Configuration..."
check_contains "docker-compose.prod.yml" "authenx-network" "Docker network"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo -e "║  ${GREEN}✓ All production files validated successfully${NC}         ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Next steps:"
  echo "  1. Copy .env.production.template to .env.production"
  echo "  2. Update all passwords and secrets in .env.production"
  echo "  3. Run: pnpm prod:build"
  echo "  4. Run: pnpm prod:up"
  echo "  5. Check: pnpm prod:logs"
  exit 0
else
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo -e "║  ${RED}✗ Validation failed - $ERRORS errors found${NC}              ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  exit 1
fi
