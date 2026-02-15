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

1. **Create PostgreSQL Database**
   - Go to Render.com → New → PostgreSQL
   - Name: `authenx-db`
   - Configuration: At least 1GB RAM
   - Copy connection string (add to Dashboard secrets)

2. **Create Redis Instance**
   - Go to Render.com → New → Redis
   - Name: `authenx-redis`
   - Copy connection string

3. **Create cloud-api Service**
   - New → Web Service
   - Repository: Select your repo
   - Build Command: `docker build -f apps/cloud-api/Dockerfile.prod -t authenx-cloud-api .`
   - Start Command: `node dist/src/main.js`
   - Environment Variables:
     ```
     NODE_ENV=production
     DATABASE_URL=<postgres_url_from_step_1>
     REDIS_URL=<redis_url_from_step_2>
     JWT_SECRET=<generate_secure_key>
     CORS_ORIGIN=https://yourdomain.com
     ```

4. **Create connector Service**
   - Similar to cloud-api
   - Build Command: `docker build -f apps/connector/Dockerfile.prod -t authenx-connector .`
   - Start Command: `node dist/main.js`
   - CLOUD_API_URL=<cloud-api_internal_url>

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
- [ ] Use environment variables for all secrets (never in code)
- [ ] Enable SSL/TLS certificates
- [ ] Set CORS_ORIGIN to exact domain (no wildcards)
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
```

### connector/.env.production

```env
NODE_ENV=production
PORT=3002
CLOUD_API_URL=http://cloud-api:3001
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
