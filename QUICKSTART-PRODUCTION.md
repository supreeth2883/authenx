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

## Need Help?

1. **Development Questions**: See [DEPLOYMENT.md](DEPLOYMENT.md)
2. **Docker Issues**: Check [Docker Docs](https://docs.docker.com/)
3. **NestJS Docs**: [docs.nestjs.com](https://docs.nestjs.com)
4. **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
5. **Prisma Docs**: [prisma.io/docs](https://prisma.io/docs)

---

Last Updated: February 15, 2026
