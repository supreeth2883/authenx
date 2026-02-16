# AuthenX Production Quick Start

## 5-Minute Setup for Local Production Testing

### 1. Prepare Environment

```bash
# Copy environment template
cp .env.production.template .env.production

# Edit with your local test values
# Use default values from docker-compose.prod.yml
nano .env.production

# Required minimum:
# DATABASE_URL=postgresql://authenx:authenx_secure_password@postgres:5432/authenx
# REDIS_URL=redis://:redis_secure_password@redis:6379
# JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
# CORS_ORIGIN=http://localhost:3000
```

### 2. Build Production Images

```bash
# Build all Docker images (requires Docker & Docker Compose)
pnpm prod:build

# Or build individual services:
docker build -f apps/cloud-api/Dockerfile.prod -t authenx-cloud-api:latest .
docker build -f apps/connector/Dockerfile.prod -t authenx-connector:latest .
docker build -f apps/web/Dockerfile.prod -t authenx-web:latest .
```

### 3. Start Services

```bash
# Start all services
pnpm prod:up

# View logs
pnpm prod:logs

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### 4. Initialize Database

```bash
# Run migrations
pnpm prod:migrate

# Or manually
docker-compose -f docker-compose.prod.yml run --rm cloud-api npx prisma migrate deploy
```

### 5. Verify Services

```bash
# Test cloud-api
curl http://localhost:3001/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"college@cvr.edu","password":"College@2026"}'

# Test web
open http://localhost:3000

# Test connector
curl http://localhost:3002/
```

---

## Production Deployment Platforms

### Render.com (Recommended for Beginners)

1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Create New → Web Service
4. Select your repository
5. Configure environment variables from `.env.production`
6. Deploy

**Full Guide:** See [DEPLOYMENT.md](DEPLOYMENT.md) → "Deployment to Render.com"

### Railway.app

1. Connect GitHub repo to Railway
2. Create services from docker-compose.prod.yml
3. Set environment variables
4. Deploy on push

**Full Guide:** See [DEPLOYMENT.md](DEPLOYMENT.md) → "Deployment to Railway.app"

### AWS / Self-Hosted

For ECS, Docker Swarm, or Kubernetes deployments, see [DEPLOYMENT.md](DEPLOYMENT.md) → "Deployment to AWS"

---

## Important Security Notes

### Before Production Deployment

1. **Secrets & Passwords**
   - Generate strong JWT_SECRET (32+ characters)
   - Use strong database password
   - Use strong Redis password
   - Store in environment variables, NEVER in code

2. **CORS Configuration**
   ```env
   # ❌ WRONG - Wildcards not allowed
   CORS_ORIGIN=*
   CORS_ORIGIN=https://*.yourdomain.com

   # ✅ CORRECT - Specific domains only
   CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
   ```

3. **Certificates & HTTPS**
   - Use SSL/TLS certificates (Let's Encrypt free)
   - Enable HSTS headers (required)
   - Force HTTPS redirects

4. **Database**
   - Use managed database service (AWS RDS, Railway Postgres, etc.)
   - Enable encryption at rest
   - Configure automated backups
   - Restrict network access to private subnet

5. **Monitoring**
   - Set up error tracking (Sentry, Rollbar)
   - Monitor logs (DataDog, New Relic, CloudWatch)
   - Set up alerts for errors and downtime

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs cloud-api

# Verify environment variables
docker-compose -f docker-compose.prod.yml config

# Rebuild images
pnpm prod:build --no-cache
```

### Database Connection Issues

```bash
# Check database health
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_isready -U authenx

# Test connection manually
docker-compose -f docker-compose.prod.yml exec cloud-api \
  psql $DATABASE_URL -c "SELECT 1"
```

### High Memory/CPU Usage

```bash
# Monitor resources
docker stats

# Check application logs for errors
docker-compose -f docker-compose.prod.yml logs --tail 100
```

---

## Common Tasks

### View Logs

```bash
# All services
pnpm prod:logs

# Specific service
pnpm prod:logs cloud-api

# Follow specific lines
docker-compose -f docker-compose.prod.yml logs -f cloud-api --tail 50
```

### Database Operations

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U authenx authenx > backup.sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U authenx authenx < backup.sql

# Connect to database shell
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U authenx authenx
```

### Apply Migrations

```bash
# Automatic on startup (recommended)
# Migrations run before app starts

# Manual
pnpm prod:migrate
```

### Restart Services

```bash
# Complete restart
pnpm prod:down && pnpm prod:up

# Restart single service
docker-compose -f docker-compose.prod.yml restart cloud-api

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build cloud-api
```

### Scale Services

```bash
# Run multiple instances of cloud-api (requires load balancer)
docker-compose -f docker-compose.prod.yml up -d --scale cloud-api=3

# Then configure load balancer (Nginx, Traefik, etc.)
```

---

## Performance Optimization

### Caching

- Redis is configured for rate limiting and sessions
- Consider adding HTTP caching headers
- Use CDN (Cloudflare, CloudFront) for static assets

### Database

- Indices created automatically via Prisma migrations
- Connection pooling configured
- For high traffic, use read replicas

### Application

- Node.js cluster mode (optional)
- Horizontal scaling via load balancer
- Monitor and optimize slow queries

### Frontend

- Next.js bundle analysis: `ANALYZE=true pnpm --filter web build`
- Image optimization enabled
- Static generation where possible

---

## Scaling to Production

### Single Instance (Small)

```yaml
# docker-compose.prod.yml with 1GB RAM
Services: 1 cloud-api, 1 connector, 1 web
Database: 1GB Postgres
Cache: Free tier Redis
```

### Multi-Instance (Medium)

```yaml
# Multiple instances with load balancer
Services: 3 cloud-api, 1 connector, 1 web
Database: 2GB Postgres with read replicas
Cache: Redis with persistence
Load Balancer: Nginx or cloud provider ALB
```

### Highly Available (Large)

```yaml
# Kubernetes or managed container orchestration
Services: Auto-scaling cloud-api, connector, web
Database: Managed RDS with multi-AZ
Cache: ElastiCache or Redis Cloud
Load Balancer: Cloud provider ALB/NLB
CDN: Cloudflare or CloudFront
Monitoring: Full observability stack
```

---

## Environment Variables Reference

### Cloud API
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://:password@host:6379
JWT_SECRET=<secure_32+_char_key>
JWT_EXPIRATION=86400
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

### Connector
```env
NODE_ENV=production
PORT=3002
CLOUD_API_URL=http://cloud-api:3001
LOG_LEVEL=info
```

### Web
```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## Security Checklist

- [ ] All passwords changed from defaults
- [ ] JWT_SECRET is secure and random (32+ chars)
- [ ] CORS_ORIGIN set to exact domains only
- [ ] SSL/TLS certificates installed
- [ ] Database backups automated
- [ ] Logs aggregated and archived
- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Monitoring and alerts configured
- [ ] Rate limiting tested
- [ ] HTTPS redirects working
- [ ] Security headers present
- [ ] Database encryption enabled

---

## Super Admin — User Management

SUPER_ADMIN users can create and manage other users directly from the web UI.

### Three-Portal Architecture

AuthenX enforces strict role-based access control across three isolated portals:

| Portal | URL | Allowed Role | Features |
|--------|-----|-------------|----------|
| **Admin** | `/admin/*` | SUPER_ADMIN only | Dashboard, Users, Audit, Credential Explorer |
| **College** | `/college/*` | COLLEGE_ADMIN only | Dashboard, Issue Credentials, List/Revoke |
| **Employer** | `/employer/*` | EMPLOYER only | Verify credentials (VERIFIED / REVOKED / TAMPERED) |

RBAC is enforced at **both** layers:
- **UI Middleware** — redirects wrong roles before page renders
- **API Guards** — NestJS `@Roles()` decorator returns 403 on every endpoint

### Default Seed Logins

| Email | Password | Role | Portal |
|-------|----------|------|--------|
| `admin@authenx.io` | `Admin@2026` | SUPER_ADMIN | `/admin` |
| `college@cvr.edu` | `College@2026` | COLLEGE_ADMIN (CVR) | `/college` |
| `hr@acme.com` | `Employer@2026` | EMPLOYER | `/employer` |

### Demo Walkthrough

**1. SUPER_ADMIN — Monitor & Manage**
1. Login as `admin@authenx.io` → lands on `/admin`
2. View system stats, credential explorer, analytics charts
3. Click **Manage Users →** to create/edit/deactivate users
4. Click **Audit Trail →** to view hash-chained audit logs, export CSV

**2. COLLEGE_ADMIN — Issue & Revoke**
1. Login as `college@cvr.edu` → lands on `/college`
2. Click **Issue Credentials →** to open the credential manager
3. Add records manually or upload CSV (format: `rollNumber,name,degree,branch,graduationYear,cgpa`)
4. Click **Publish Results** — credentials are auto-issued with Ed25519 signatures
5. Switch to **Issued Credentials** tab → copy IDs, share QR codes
6. Click the revoke icon on any credential → enter reason → confirm

**3. EMPLOYER — Verify**
1. Login as `hr@acme.com` → lands on `/employer`
2. Paste a credential ID → click **Verify Credential**
3. See three possible results:
   - **VERIFIED** (green) — hash + signature valid, credential active
   - **REVOKED** (amber) — credential was revoked, shows reason + date
   - **TAMPERED** (red) — hash mismatch, data integrity compromised

### Cold Start Note

On Render free tier, services spin down after 15 min of inactivity. First request may take 10-15 seconds. The employer portal shows a "Waking server…" indicator automatically.

### How to use User Management

1. **Login** as the Super Admin at `/login`:
   - Email: `admin@authenx.io` / Password: `Admin@2026` (default seed)
2. Navigate to **`/admin/users`** (or click "Manage Users →" in the dashboard header).
3. **Create a user** — click "Create User", fill in email, password, role, and issuerCode (for COLLEGE_ADMIN).
4. **Edit a user** — click "Edit" on any row to change role, issuerCode, status, or reset password.
5. **Deactivate a user** — click "Deactivate" to soft-disable an account (no hard delete).

### Strict Role Isolation

| Action | SUPER_ADMIN | COLLEGE_ADMIN | EMPLOYER |
|--------|:-----------:|:------------:|:--------:|
| `/admin` dashboard | ✅ | 🚫 redirect | 🚫 redirect |
| User CRUD | ✅ | 🚫 403 | 🚫 403 |
| Audit logs | ✅ | 🚫 403 | 🚫 403 |
| `/college` dashboard | 🚫 redirect | ✅ | 🚫 redirect |
| Issue credentials | 🚫 403 | ✅ | 🚫 403 |
| Revoke credentials | 🚫 403 | ✅ | 🚫 403 |
| `/employer` verify | 🚫 redirect | 🚫 redirect | ✅ |
| `/verify/:id` (legacy) | ➡️ redirects to `/employer/verify/:id` | ➡️ redirects | ➡️ redirects |

### API Endpoints (via proxy)

All frontend requests go through `/api/proxy/...` (never directly to cloud-api):

```
# Admin (SUPER_ADMIN only)
GET    /api/proxy/admin/stats
GET    /api/proxy/admin/credentials?page=&limit=&search=
GET    /api/proxy/admin/analytics
GET    /api/proxy/admin/audit-logs?page=&limit=&action=
GET    /api/proxy/admin/audit-logs/export
GET    /api/proxy/admin/users?role=&q=&page=&limit=
POST   /api/proxy/admin/users          { email, password, role, issuerCode? }
PATCH  /api/proxy/admin/users/:id      { role?, issuerCode?, active?, password? }
DELETE /api/proxy/admin/users/:id      (deactivates user)

# College (COLLEGE_ADMIN only)
GET    /api/proxy/college/credentials?page=&limit=&search=
POST   /api/proxy/college/credentials/publish  { issuerCode, records: [...] }
PATCH  /api/proxy/college/credentials/:id/revoke  { reason }

# Employer (EMPLOYER only)
GET    /api/proxy/employer/verify/:id?orgName=

# Public verify is DISABLED — all verification requires employer login
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 403 on any endpoint | Wrong role for that portal | Login with correct role |
| 409 on publish | Credential already issued | Check "ALREADY_ISSUED" status in results |
| Slow first request | Render cold start (free tier) | Wait 10-15s, server wakes automatically |
| Redirect loop | Cookie from wrong role | Clear cookies, login again |

### curl examples (direct to cloud-api, for debugging)

```bash
# Login as super admin
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@authenx.io","password":"Admin@2026"}' | jq -r .access_token)

# List users
curl -s http://localhost:3001/admin/users -H "Authorization: Bearer $TOKEN" | jq

# Create a college admin
curl -s -X POST http://localhost:3001/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"newcollege@example.com","password":"College@2026","role":"COLLEGE_ADMIN","issuerCode":"TEST"}' | jq

# Update a user
curl -s -X PATCH http://localhost:3001/admin/users/<USER_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"active":false}' | jq
```

---

## Built-in QA Checklist

AuthenX includes a built-in platform QA page accessible at `/admin/qa` (requires SUPER_ADMIN login).

### What it tests (11 sequential checks):

| # | Check | Endpoint |
|---|-------|----------|
| 1 | Auth Session | `GET /auth/me` |
| 2 | Cloud API Health | `GET /admin/health` |
| 3 | PostgreSQL | Extracted from health response |
| 4 | Registered Issuers | `GET /admin/issuers` |
| 5 | Connector Ping | `POST /admin/issuers/:code/ping` |
| 6 | Platform Stats | `GET /admin/stats` |
| 7 | Credential Explorer | `GET /admin/credentials` |
| 8 | Public Verify Blocked | Confirm `/public/verify/:id` returns 404 |
| 9 | Audit Chain Integrity | `GET /admin/audit-logs/verify-chain` |
| 10 | Analytics | `GET /admin/analytics` |
| 11 | Audit Export | `GET /admin/audit-logs/export` |

### Running QA after deployment:
1. Log in as SUPER_ADMIN at `/login`
2. Navigate to the **QA →** link in the admin dashboard header
3. Click **Run All Checks** — all 11 steps execute sequentially
4. Green checkmarks = healthy, red X = needs attention

### System Status Widget

The admin dashboard (`/admin`) now includes a **System Status** bar showing real-time health of:
- Cloud API service
- PostgreSQL database (with latency)
- Registered issuer count

---

## Need Help?

1. **Development Questions**: See [DEPLOYMENT.md](DEPLOYMENT.md)
2. **Docker Issues**: Check [Docker Docs](https://docs.docker.com/)
3. **NestJS Docs**: [docs.nestjs.com](https://docs.nestjs.com)
4. **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
5. **Prisma Docs**: [prisma.io/docs](https://prisma.io/docs)

---

Last Updated: February 16, 2026
