# AuthenX Deployment Guide

## Production Deployment

### Overview
AuthenX is a monorepo containing three main services:
- **cloud-api**: NestJS backend API (Port 3001)
- **connector**: Credential signing service (Port 3002)
- **web**: Next.js frontend (Port 3000)

All services are containerized and designed for production deployment.

---

## Prerequisites

### Local Development & Testing
- Docker & Docker Compose
- Node.js 25+
- pnpm
- PostgreSQL 16+
- Redis 7+

### Production Deployment
- Docker & Docker Compose (or Kubernetes)
- PostgreSQL 16+ (managed service recommended)
- Redis 7+ (managed service like Redis Cloud)
- Domain name with SSL certificate

---

## Local Production Build Testing

### 1. Build Docker Images Locally

```bash
# Build all images
pnpm prod:build

# Or build individual services
docker build -f apps/cloud-api/Dockerfile.prod -t authenx-cloud-api:latest .
docker build -f apps/connector/Dockerfile.prod -t authenx-connector:latest .
docker build -f apps/web/Dockerfile.prod -t authenx-web:latest .
```

### 2. Configure Environment

```bash
# Copy production environment template
cp .env.production.template .env.production

# Edit with your configuration
nano .env.production
```

**Required Variables:**
```env
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/authenx

# Redis
REDIS_URL=redis://:password@redis:6379

# JWT
JWT_SECRET=your_secret_key_min_32_chars

# CORS (specify exact domain)
CORS_ORIGIN=http://localhost:3000

# API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Run Production Stack Locally

```bash
# Start all services
pnpm prod:up

# View logs
pnpm prod:logs

# Run migrations
pnpm prod:migrate

# Stop services
pnpm prod:down
```

### 4. Test Services

```bash
# Test cloud-api health
curl http://localhost:3001/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"college@cvr.edu","password":"College@2026"}'

# Test web frontend
open http://localhost:3000

# Test connector
curl http://localhost:3002/
```

---

## Deployment to Render.com

### Step 1: Prepare Repository

1. Commit all changes to Git:
```bash
git add .
git commit -m "Production deployment configuration"
git push origin main
```

2. Ensure `.env.production` is in `.gitignore`:
```bash
echo ".env.production" >> .gitignore
```

### Step 2: Create Render Services

#### Option A: Using Render Dashboard (Recommended)

1. **Create PostgreSQL Database (cloud-api)**
   - Go to Render.com → New → PostgreSQL
   - Name: `authenx-db`
   - Configuration: At least 1GB RAM
   - Copy connection string (add to Dashboard secrets)

2. **Create PostgreSQL Database (connector)**
   - Go to Render.com → New → PostgreSQL
   - Name: `authenx-connector-db`
   - Used by the connector's ERP module (Prisma)

3. **Create Redis Instance**
   - Go to Render.com → New → Redis
   - Name: `authenx-redis`
   - Copy connection string

3. **Create cloud-api Service**
   - New → Web Service
   - Repository: Select your repo
   - Runtime: Docker
   - Dockerfile Path: `apps/cloud-api/Dockerfile.prod`
   - Docker Context: `.` (repo root)
   - Health Check Path: `/`
   - Environment Variables:
     ```
     NODE_ENV=production
     DATABASE_URL=<postgres_url_from_step_1>
     REDIS_URL=<redis_url_from_step_2>
     JWT_SECRET=<generate_secure_key>
     CORS_ORIGIN=https://authenx-web.onrender.com
     CONNECTOR_URL=https://authenx-connector.onrender.com
     CONNECTOR_ADMIN_KEY=<strong_shared_secret_64_chars>
     ```

4. **Create connector Service**
   - New → Web Service
   - Runtime: Docker
   - Dockerfile Path: `apps/connector/Dockerfile.prod`
   - Docker Context: `.` (repo root)
   - Health Check Path: `/`
   - Environment Variables:
     ```
     NODE_ENV=production
     CLOUD_API_URL=https://authenx-cloud-api.onrender.com
     CONNECTOR_DATABASE_URL=<postgres_url_from_step_2>
     ISSUER_CODE=TEST-COLLEGE
     CONNECTOR_ADMIN_KEY=<MUST_MATCH_cloud-api_CONNECTOR_ADMIN_KEY>
     LOG_LEVEL=info
     ```
   > **Build-time vs runtime:** The Dockerfile supplies a dummy
   > `CONNECTOR_DATABASE_URL` at build time so `prisma generate` passes.
   > At runtime, Render injects the real connection string from the
   > `authenx-connector-db` database (via `render.yaml` `fromDatabase`
   > or manually in the Dashboard).
   >
   > **CONNECTOR_ADMIN_KEY:** Must be the **exact same value** on both
   > cloud-api and connector. Copy the generated value from cloud-api's
   > env vars in the Render Dashboard and paste it into connector's.
   >
   > **Port binding:** The connector listens on `process.env.PORT`
   > (injected by Render) on `0.0.0.0`. No `PORT` env var is needed —
   > Render sets it automatically.

5. **Create web Service**
   - New → Static Site (or Web Service for Next.js)
   - Build Command: `pnpm install && pnpm --filter web build`
   - Start Command: (leave blank for static) or `NODE_ENV=production next start`
   - Environment Variables:
     ```
     NEXT_PUBLIC_API_URL=https://api.yourdomain.com
     ```

6. **Set up DNS**
   - Add custom domain pointing to Render
   - Enable automatic certificates

#### Option B: Using render.yaml Blueprint (Fastest)

The repo includes a `render.yaml` Blueprint that auto-creates all resources:

```bash
# 1. Push code to GitHub
git push origin main

# 2. Go to Render Dashboard → Blueprints → New Blueprint Instance
#    Select this repo → Render creates everything automatically:
#    - authenx-db            (PostgreSQL, free)
#    - authenx-connector-db  (PostgreSQL, free)
#    - authenx-redis         (Redis, free)
#    - authenx-cloud-api     (Web Service, Docker)
#    - authenx-connector     (Web Service, Docker)
#    - authenx-web           (Web Service, Docker)

# 3. MANUAL STEP — sync CONNECTOR_ADMIN_KEY:
#    - Go to authenx-cloud-api → Environment → copy CONNECTOR_ADMIN_KEY value
#    - Go to authenx-connector → Environment → set CONNECTOR_ADMIN_KEY to same value
#    - Redeploy authenx-connector

# 4. Wait for all services to deploy (5–10 min on free tier)
```

**Render resources created by render.yaml:**

| Resource | Type | Name | Purpose |
|---|---|---|---|
| Database | PostgreSQL | `authenx-db` | cloud-api (users, credentials, audit) |
| Database | PostgreSQL | `authenx-connector-db` | connector ERP (student records) |
| Cache | Redis | `authenx-redis` | Rate limiting, sessions |
| Service | Web (Docker) | `authenx-cloud-api` | Backend API |
| Service | Web (Docker) | `authenx-connector` | Signing + ERP service |
| Service | Web (Docker) | `authenx-web` | Next.js frontend |

### Step 3: Quick Smoke Test After Deploy

```bash
BASE=https://authenx-cloud-api.onrender.com
CONN=https://authenx-connector.onrender.com
WEB=https://authenx-web.onrender.com

# 1. Health checks (should return 200)
curl -s $CONN/
curl -s $CONN/erp/health
curl -s $BASE/

# 2. Web frontend loads
curl -s -o /dev/null -w "%{http_code}" $WEB/login  # → 200

# 3. Connector security — must return 401, NOT 200
curl -s -w "\n%{http_code}" -X POST $CONN/sign \
  -H "Content-Type: application/json" -d '{"payload":"test"}'

# 4. Login as super admin
curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@authenx.io","password":"Admin@2026"}'
```

---

## Deployment to Railway.app

### Step 1: Connect Repository

1. Login to Railway.com
2. New Project → GitHub (connect repo)
3. Create services

### Step 2: Create Services with docker-compose.prod.yml

Railway can deploy from docker-compose directly:

```bash
# Push your code
git push origin main

# Railway will automatically detect docker-compose.prod.yml
```

### Step 3: Configure Environment Variables

In Railway UI:
- Set database and redis URLs in service environment
- Set JWT_SECRET and other secrets
- Configure CORS_ORIGIN

### Step 4: Deploy

```bash
# Railway automatically deploys on push to main
# Monitor in Railway dashboard
```

---

## Deployment to AWS / Self-Hosted

### Option 1: ECS (Elastic Container Service)

1. Build and push images to ECR:
```bash
# Configure AWS CLI
aws configure

# Create ECR repositories
aws ecr create-repository --repository-name authenx-cloud-api
aws ecr create-repository --repository-name authenx-connector
aws ecr create-repository --repository-name authenx-web

# Build and push
docker build -f apps/cloud-api/Dockerfile.prod -t authenx-cloud-api .
docker tag authenx-cloud-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/authenx-cloud-api:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/authenx-cloud-api:latest
```

2. Create ECS task definitions
3. Create ECS services
4. Set up RDS for PostgreSQL
5. Set up ElastiCache for Redis

### Option 2: Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Create secrets
echo "your_jwt_secret" | docker secret create jwt_secret -
echo "your_db_password" | docker secret create db_password -

# Deploy stack
docker stack deploy -c docker-compose.prod.yml authenx
```

### Option 3: Kubernetes

Create helm chart or use kubectl:

```bash
# Build and push images to registry
docker build -f apps/cloud-api/Dockerfile.prod -t registry.example.com/authenx-cloud-api .
docker push registry.example.com/authenx-cloud-api

# Apply manifests
kubectl apply -f k8s/
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET (minimum 32 characters)
- [ ] Generate strong CONNECTOR_ADMIN_KEY (minimum 32 characters) — **must match on cloud-api and connector**
- [ ] Use environment variables for all secrets (never in code)
- [ ] Enable SSL/TLS certificates
- [ ] Set CORS_ORIGIN to exact domain (no wildcards)
- [ ] Verify connector `/sign`, `/rotate-key`, `/ping`, `/erp/validate-student`, `/erp/publish-results` return 401 without valid bearer token
- [ ] Only `/`, `/erp/health`, `/public-key`, `/public-keys` are publicly accessible on the connector
- [ ] Enable database encryption at rest
- [ ] Enable Redis AUTH password
- [ ] Use VPC/private networking where possible
- [ ] Set up WAF (Web Application Firewall)
- [ ] Enable CloudTrail/audit logging
- [ ] Regular backups of database
- [ ] Monitor logs and set up alerts

---

## Production Environment Variables

### cloud-api/.env.production

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/authenx
REDIS_URL=redis://:<password>@<host>:6379
JWT_SECRET=<generate_secure_32+_char_key>
JWT_EXPIRATION=86400
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
CONNECTOR_URL=http://connector:3002
CONNECTOR_ADMIN_KEY=<generate_secure_64+_char_key>
```

### connector/.env.production

```env
NODE_ENV=production
PORT=3002
CLOUD_API_URL=http://cloud-api:3001
CONNECTOR_DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/authenx_connector
CONNECTOR_ADMIN_KEY=<must_match_cloud-api>
ISSUER_CODE=TEST-COLLEGE
LOG_LEVEL=info
```

### web/.env.production

```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Root .env.production

All variables from above, plus:
```env
DB_USER=authenx
DB_PASSWORD=<strong_password>
DB_NAME=authenx
REDIS_PASSWORD=<strong_password>
```

---

## Database Migrations

### First Deployment

```bash
# Before starting services
docker-compose -f docker-compose.prod.yml run --rm cloud-api \
  npx prisma migrate deploy

# Or
pnpm prod:migrate
```

### Subsequent Deployments

Migrations run automatically via Dockerfile CMD:
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
```

---

## Monitoring & Maintenance

### Health Checks

Services include Docker health checks that verify:
- HTTP endpoints respond
- Database connectivity
- Redis connectivity

```bash
# View health status
docker-compose -f docker-compose.prod.yml ps
```

### Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f cloud-api
```

### Database Backup

```bash
# PostgreSQL backup
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U authenx authenx > backup.sql

# Restore
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U authenx authenx < backup.sql
```

### Performance Tuning

#### PostgreSQL
- Increase connection pool in DATABASE_URL
- Enable slow query logging
- Index frequently queried columns

#### Redis
- Monitor memory usage
- Configure eviction policy
- Enable persistence (RDB or AOF)

#### Application
- Monitoring with DataDog, New Relic, or Sentry
- Set appropriate LOG_LEVEL for production (info, not debug)
- Use CDN for static assets (Cloudflare, CloudFront)

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Verify environment variables
docker-compose -f docker-compose.prod.yml config

# Rebuild images
pnpm prod:build
```

### Database Connection Issues

```bash
# Test connection
docker-compose -f docker-compose.prod.yml exec cloud-api \
  psql $DATABASE_URL -c "SELECT 1"

# Check migrations
docker-compose -f docker-compose.prod.yml run --rm cloud-api \
  npx prisma migrate status
```

### High Memory/CPU Usage

```bash
# Check container resources
docker stats

# Review logs for errors
docker-compose -f docker-compose.prod.yml logs --tail 100
```

---

## Scaling

### Vertical Scaling
Increase container resource allocations in docker-compose.prod.yml or cloud provider settings

### Horizontal Scaling

For load-balanced deployments:

1. Use container orchestration (Kubernetes, Docker Swarm)
2. Set up load balancer (Nginx, HAProxy, AWS ALB)
3. Configure session management via Redis
4. Use managed database (RDS, Cloud SQL)

Example Nginx config:
```nginx
upstream authenx_api {
  server cloud-api-1:3001;
  server cloud-api-2:3001;
  server cloud-api-3:3001;
}

server {
  listen 80;
  location / {
    proxy_pass http://authenx_api;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

---

## Support & Issues

For issues or questions:
1. Check logs: `pnpm prod:logs`
2. Verify environment variables
3. Review health checks: `docker-compose -f docker-compose.prod.yml ps`
4. Check system resources: `docker stats`
5. Review Render/Railway/AWS deployment logs

---

## E2E Smoke Test — Model A (College → Employer → Super Admin)

Run this checklist after every deployment to confirm the full credential
lifecycle works end-to-end.

### Prerequisites

```bash
# Set base URLs (adjust for your deployment)
BASE=https://authenx-cloud-api.onrender.com
CONN=https://authenx-connector.onrender.com
WEB=https://authenx-web.onrender.com
```

### Phase 0 — Health & Security

```bash
# Connector root health (public, 200)
curl -sf $CONN/              # → "Hello World!"
curl -sf $CONN/erp/health    # → {"status":"ok", ...}

# Public keys (public, 200) — these ARE public by design
curl -sf $CONN/public-key    # → {"issuerCode":"TEST-COLLEGE","publicKeyEd25519":"..."}

# Protected routes WITHOUT admin key → expect 401
curl -s -o /dev/null -w "%{http_code}" -X POST $CONN/sign \
  -H "Content-Type: application/json" -d '{"payload":"test"}'
# → 401

curl -s -o /dev/null -w "%{http_code}" -X POST $CONN/rotate-key
# → 401

curl -s -o /dev/null -w "%{http_code}" -X POST $CONN/erp/validate-student \
  -H "Content-Type: application/json" -d '{}'
# → 401
```

### Phase 1 — Super Admin Setup

**UI path:** `$WEB/login` → email: `admin@authenx.io`, password: `Admin@2026`

```bash
# 1. Login as super admin
ADMIN_TOKEN=$(curl -sf -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@authenx.io","password":"Admin@2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Register issuer (if not already done)
curl -sf -X POST $BASE/admin/issuers/register \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"issuerCode":"TEST-COLLEGE","name":"Test College","connectorBaseUrl":"'$CONN'"}'
# → 201 or 409 (already registered)

# 3. Seed ERP with sample students
curl -sf -X POST $BASE/admin/issuers/TEST-COLLEGE/erp/upsert-batch \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"records":[
    {"rollNumber":"22B81A0501","name":"Alice Johnson","degree":"B.Tech","branch":"Computer Science","graduationYear":2026,"cgpa":9.1},
    {"rollNumber":"22B81A0502","name":"Bob Smith","degree":"B.Tech","branch":"Electronics","graduationYear":2026,"cgpa":8.5}
  ]}'
# → 200 with upserted count
```

**UI path:** `$WEB/admin` → Issuers tab → Register Issuer / Seed ERP

### Phase 2 — College Issues Credential

**UI path:** `$WEB/login` → college admin credentials → `$WEB/college/issue`

```bash
# 1. Login as college admin
COLLEGE_TOKEN=$(curl -sf -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"college@cvr.edu","password":"College@2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Issue credential from ERP by roll number
ISSUE_RESULT=$(curl -sf -X POST $BASE/college/credentials/issue-from-erp \
  -H "Authorization: Bearer $COLLEGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rollNumber":"22B81A0501"}')
echo "$ISSUE_RESULT"
# → {"credentialId":"clx...","hash":"...","signature":"...","keyVersion":1,...}

CRED_ID=$(echo "$ISSUE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['credentialId'])")
echo "Credential ID: $CRED_ID"
```

**UI path:** `$WEB/college/issue` → enter roll number → click "Issue from ERP"
→ credential card appears with QR code

### Phase 3 — Employer Verifies Credential

**UI path:** `$WEB/employer`

#### Option A: Verify by credential ID

```bash
# Verify credential (no auth required — public verification endpoint)
curl -sf $BASE/credentials/$CRED_ID/verify
# → {"credentialId":"...","verification":{"hashValid":true,"signatureValid":true,"verified":true,...}}
```

**UI path:** `$WEB/employer` → paste credential ID → click Verify
→ green "Verified" card with student details

#### Option B: QR code scanning

1. Open `$WEB/employer` on a phone
2. Click "Scan QR Code"
3. Point camera at the QR code shown on the college issue page
4. QR payload is `authenx:<credentialId>` — app auto-verifies

#### Option C: Image upload fallback

1. Screenshot the QR code from the college issue page
2. Open `$WEB/employer` → click "Upload QR Image"
3. Select the screenshot → auto-verifies

**Expected result:** All three methods show the same verified credential card.

### Phase 4 — Super Admin Sees Analytics & Audit

**UI path:** `$WEB/admin`

```bash
# 1. Dashboard stats
curl -sf $BASE/admin/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# → {"totalCredentials":N,"totalVerifications":M,...}

# 2. Audit log (latest entries)
curl -sf "$BASE/admin/audit?limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# → entries with action=CREDENTIAL_ISSUED, CREDENTIAL_VERIFIED, etc.
```

**UI path:**
- `$WEB/admin` → stat cards show credential count, verification count
- `$WEB/admin/audit` → table shows issuance + verification events
- `$WEB/admin/qa` → QA summary bar

### Phase 5 — Revocation (Optional)

```bash
# Revoke the credential (college admin)
curl -sf -X PATCH $BASE/college/credentials/$CRED_ID/revoke \
  -H "Authorization: Bearer $COLLEGE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Test revocation"}'
# → {"status":"REVOKED",...}

# Re-verify — should show revoked
curl -sf $BASE/credentials/$CRED_ID/verify
# → {"verification":{"verified":true,"revoked":true,...}}
```

### Summary of Expected Status Codes

| Step | Endpoint | Method | Expected |
|---|---|---|---|
| Health | `GET /` (connector) | GET | 200 |
| Security | `POST /sign` (no auth) | POST | 401 |
| Login | `POST /auth/login` | POST | 201 |
| Register issuer | `POST /admin/issuers/register` | POST | 201 / 409 |
| Seed ERP | `POST /admin/issuers/:code/erp/upsert-batch` | POST | 200 |
| Issue credential | `POST /college/credentials/issue-from-erp` | POST | 201 |
| Verify | `GET /credentials/:id/verify` | GET | 200 |
| Audit log | `GET /admin/audit` | GET | 200 |
| Revoke | `PATCH /college/credentials/:id/revoke` | PATCH | 200 |
