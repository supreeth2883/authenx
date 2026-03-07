# AuthenX Operational Runbook

Procedures for operating, monitoring, and troubleshooting the AuthenX platform in production.

---

## Table of Contents

- [Service Overview](#service-overview)
- [Health Checks](#health-checks)
- [Starting & Stopping](#starting--stopping)
- [Database Operations](#database-operations)
- [Key Management](#key-management)
- [Audit Trail](#audit-trail)
- [Monitoring & Alerts](#monitoring--alerts)
- [Troubleshooting](#troubleshooting)
- [Incident Response](#incident-response)
- [Backup & Recovery](#backup--recovery)

---

## Service Overview

| Service | Port | Purpose | Health Endpoint |
|---------|------|---------|----------------|
| Cloud API | 3001 | REST API, auth, credential management | `GET /` |
| Connector | 3002 | Ed25519 signing, ERP integration | `GET /` |
| Web | 3000 | Portal frontend (Next.js) | `GET /` |
| PostgreSQL | 5432 | Primary data store | `pg_isready` |
| Redis | 6379 | Rate limiting, caching | `redis-cli ping` |

---

## Health Checks

### Quick Health Check (All Services)

```bash
# Cloud API
curl -s http://localhost:3001/ | head -1

# Connector
curl -s http://localhost:3002/ | head -1

# Web
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/

# PostgreSQL
pg_isready -h localhost -p 5432

# Redis
redis-cli ping
```

### Deep Health Check (Admin)

Requires SUPER_ADMIN authentication:

```bash
# Login and capture cookie
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@authenx.io","password":"Admin@2026"}' \
  -c - | grep token | awk '{print $NF}')

# System health (checks Postgres, Redis, API)
curl -s -b "token=$TOKEN" http://localhost:3001/admin/health | python3 -m json.tool

# Dashboard stats
curl -s -b "token=$TOKEN" http://localhost:3001/admin/stats | python3 -m json.tool
```

### Docker Health

```bash
# Service status
docker-compose -f docker-compose.prod.yml ps

# Container resource usage
docker stats --no-stream

# Service logs (last 50 lines)
docker-compose -f docker-compose.prod.yml logs --tail 50
```

---

## Starting & Stopping

### Production (Docker Compose)

```bash
# Start all services
pnpm prod:up

# Stop all services (preserves data)
pnpm prod:down

# Restart a single service
docker-compose -f docker-compose.prod.yml restart cloud-api

# Rebuild and restart
pnpm prod:build && pnpm prod:up

# View logs (follow mode)
pnpm prod:logs

# View logs for specific service
docker-compose -f docker-compose.prod.yml logs -f cloud-api
```

### Development

```bash
# Start all services with hot reload
pnpm dev

# Start specific service
pnpm --filter cloud-api start:dev
pnpm --filter connector start:dev
pnpm --filter web dev
```

---

## Database Operations

### Migrations

```bash
# Apply pending migrations (production)
pnpm prod:migrate

# Or manually
docker-compose -f docker-compose.prod.yml run --rm cloud-api npx prisma migrate deploy

# Check migration status
docker-compose -f docker-compose.prod.yml run --rm cloud-api npx prisma migrate status
```

### Backups

```bash
# Full database backup
pg_dump -h localhost -U authenx -d authenx -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Backup specific tables
pg_dump -h localhost -U authenx -d authenx -t '"Credential"' -t '"AuditLog"' -F c -f credentials_backup.dump

# Restore from backup
pg_restore -h localhost -U authenx -d authenx -c backup_20260215.dump
```

### Common Queries

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U authenx -d authenx

# Or via Prisma Studio (development only)
cd apps/cloud-api && npx prisma studio
```

```sql
-- Count credentials by status
SELECT status, COUNT(*) FROM "Credential" GROUP BY status;

-- Recent audit log entries
SELECT action, "credentialId", organization, "createdAt"
FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 20;

-- Active users by role
SELECT role, COUNT(*) FROM "User" WHERE active = true GROUP BY role;

-- Credentials issued per day (last 30 days)
SELECT DATE("createdAt") as day, COUNT(*)
FROM "Credential"
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY day ORDER BY day;
```

---

## Key Management

### View Current Keys

```bash
# Connector's active public key
curl -s http://localhost:3002/public-key | python3 -m json.tool

# All known public keys (including rotated)
curl -s http://localhost:3002/public-keys | python3 -m json.tool

# Key diagnostics
curl -s http://localhost:3002/keys/debug | python3 -m json.tool
```

### View Issuer Keys (Cloud API)

```bash
# Public keys for an issuer (no auth required)
curl -s http://localhost:3001/issuers/CVR/public-keys | python3 -m json.tool

# Well-known endpoint
curl -s http://localhost:3001/.well-known/authenx/CVR/public-key | python3 -m json.tool

# JWKS format
curl -s http://localhost:3001/.well-known/authenx/CVR/jwks | python3 -m json.tool
```

### Key Rotation

Key rotation is performed through the Cloud API (SUPER_ADMIN):

```bash
# Rotate key for an issuer
curl -s -X POST -b "token=$TOKEN" \
  http://localhost:3001/issuers/CVR/rotate-key | python3 -m json.tool
```

**Important:**
- Old keys are retained for verifying previously-issued credentials
- New credentials use the latest key version
- The `keyVersion` field on credentials tracks which key signed them

---

## Audit Trail

### Verify Chain Integrity

```bash
# Via API (SUPER_ADMIN)
curl -s -b "token=$TOKEN" \
  http://localhost:3001/admin/audit-logs/verify-chain | python3 -m json.tool
```

Expected output:
```json
{
  "valid": true,
  "totalLogs": 150,
  "checkedCount": 150,
  "brokenAt": null
}
```

If `valid` is `false`, the `brokenAt` field indicates the first tampered entry.

### Export Audit Logs

```bash
# CSV export
curl -s -b "token=$TOKEN" \
  http://localhost:3001/admin/audit-logs/export -o audit_export.csv

# JSON query with filters
curl -s -b "token=$TOKEN" \
  "http://localhost:3001/admin/audit-logs?action=CREDENTIAL_ISSUED&limit=100" | python3 -m json.tool
```

### Audit Log Filters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `action` | `CREDENTIAL_ISSUED`, `CREDENTIAL_VERIFIED`, `CREDENTIAL_REVOKED` | Filter by action type |
| `organization` | Issuer code | Filter by org |
| `startDate` | ISO date | Start of date range |
| `endDate` | ISO date | End of date range |
| `page` | Number | Pagination page |
| `limit` | Number | Results per page |

---

## Monitoring & Alerts

### Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| API response time | Cloud API logs | > 2s p95 |
| Error rate (5xx) | Cloud API logs | > 1% of requests |
| Failed login attempts | Audit logs | > 10/min |
| Database connections | PostgreSQL | > 80% pool utilization |
| Redis memory | Redis INFO | > 80% max memory |
| Disk usage | OS | > 85% |
| Audit chain integrity | `/admin/audit-logs/verify-chain` | `valid: false` |

### Log Analysis

```bash
# Search for errors in cloud-api logs
docker-compose -f docker-compose.prod.yml logs cloud-api 2>&1 | grep -i error

# Count requests by status code (if using structured logging)
docker-compose -f docker-compose.prod.yml logs cloud-api 2>&1 | grep -oP '"statusCode":\d+' | sort | uniq -c | sort -rn

# Monitor rate limiting hits
docker-compose -f docker-compose.prod.yml logs cloud-api 2>&1 | grep -i "throttle\|rate.limit"
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs for the failing service
docker-compose -f docker-compose.prod.yml logs --tail 100 cloud-api

# Common issues:
# 1. DATABASE_URL not set or wrong
# 2. Port already in use
# 3. Missing migrations
# 4. Redis not available (non-fatal, rate limiting degrades)
```

### Database Connection Errors

```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec cloud-api \
  node -e "const { PrismaClient } = require('@prisma/client'); new PrismaClient().\$connect().then(() => console.log('OK')).catch(e => console.error(e))"

# Check connection pool
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U authenx -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'authenx';"
```

### Authentication Issues

```bash
# Test login
curl -v -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@authenx.io","password":"Admin@2026"}'

# Check cookie is being set (look for Set-Cookie header)
# Verify JWT_SECRET is the same across restarts

# Test /auth/me with cookie
curl -v -b "token=<jwt-token>" http://localhost:3001/auth/me
```

### Credential Verification Failures

```bash
# Check credential exists
curl -s http://localhost:3001/credentials/<id> | python3 -m json.tool

# Check public verification
curl -s http://localhost:3001/verify/<id> | python3 -m json.tool

# Check issuer's public keys are available
curl -s http://localhost:3001/.well-known/authenx/<issuerCode>/public-key | python3 -m json.tool

# Check connector is reachable
curl -s http://localhost:3002/public-key | python3 -m json.tool
```

### Rate Limiting Issues

```bash
# Check if Redis is connected
redis-cli ping

# If Redis is down, rate limiting falls back to in-memory (per-instance)
# Restart Redis:
docker-compose -f docker-compose.prod.yml restart redis
```

### CORS Errors

```bash
# Verify CORS_ORIGIN matches your frontend domain exactly
echo $CORS_ORIGIN

# Test CORS preflight
curl -v -X OPTIONS http://localhost:3001/auth/login \
  -H "Origin: https://your-domain.com" \
  -H "Access-Control-Request-Method: POST"
```

---

## Incident Response

### Suspected Data Breach

1. **Immediately** rotate all secrets:
   ```bash
   # Generate new secrets
   openssl rand -base64 32  # New JWT_SECRET
   openssl rand -base64 32  # New CONNECTOR_ADMIN_KEY
   openssl rand -base64 32  # New SESSION_SECRET
   ```
2. Restart all services with new secrets (this invalidates all sessions)
3. Verify audit chain integrity
4. Review audit logs for unauthorized access
5. Rotate Ed25519 signing keys for affected issuers
6. Notify affected users

### Audit Chain Tampered

1. Verify the chain: `GET /admin/audit-logs/verify-chain`
2. Export the full audit log: `GET /admin/audit-logs/export`
3. Identify the `brokenAt` sequence number
4. Restore from the most recent backup before the break
5. Investigate the cause

### Service Outage

1. Check service health (see [Health Checks](#health-checks))
2. Check logs for errors
3. Verify database and Redis connectivity
4. Restart affected services
5. If database is down, check disk space and connections
6. If all else fails, restore from backup

---

## Backup & Recovery

### Backup Schedule (Recommended)

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Full database dump | Daily | 30 days |
| Audit logs export | Weekly | 1 year |
| Configuration/secrets | On change | Indefinite |
| Application logs | Daily rotation | 14 days |

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh — run via cron: 0 2 * * * /path/to/backup.sh

BACKUP_DIR="/backups/authenx"
DATE=$(date +%Y%m%d_%H%M%S)
DB_URL="postgresql://authenx:password@localhost:5432/authenx"

mkdir -p "$BACKUP_DIR"

# Database backup
pg_dump "$DB_URL" -F c -f "$BACKUP_DIR/db_$DATE.dump"

# Audit log export (requires valid admin cookie)
# curl -s -b "token=$ADMIN_TOKEN" \
#   http://localhost:3001/admin/audit-logs/export \
#   -o "$BACKUP_DIR/audit_$DATE.csv"

# Clean old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.csv" -mtime +365 -delete

echo "Backup completed: $DATE"
```

### Recovery Procedure

1. Stop the application services
2. Restore the database:
   ```bash
   pg_restore -h localhost -U authenx -d authenx -c /backups/authenx/db_YYYYMMDD.dump
   ```
3. Apply any migrations that were created after the backup:
   ```bash
   cd apps/cloud-api && npx prisma migrate deploy
   ```
4. Restart all services
5. Verify audit chain integrity
6. Test critical flows (login, issue, verify)
