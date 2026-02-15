# AuthenX Production Deployment - Quick Reference Card

## 📋 ONE-PAGE PRODUCTION DEPLOYMENT GUIDE

### Development → Production Workflow

```bash
# 1. Development (localhost)
pnpm dev                          # All services on 3000, 3001, 3002

# 2. Production Build (local test)
pnpm build                        # Builds all apps
pnpm prod:build                   # Build Docker images (requires Docker)

# 3. Production Start (Docker)
cp .env.production.template .env.production
nano .env.production              # Edit JWT_SECRET, CORS_ORIGIN, etc.
pnpm prod:up                      # Start all services
pnpm prod:logs                    # View logs
pnpm prod:migrate                 # Run database migrations

# 4. Deploy to Cloud Platform
# See DEPLOYMENT.md for platform-specific instructions
```

---

## 🔑 Environment Variables (Minimal)

```env
# REQUIRED - Change These!
JWT_SECRET=your_secure_32plus_character_key_here
CORS_ORIGIN=https://yourdomain.com
DATABASE_URL=postgresql://user:pass@host:5432/authenx
REDIS_URL=redis://:password@host:6379

# Node configs
NODE_ENV=production
PORT=3001
```

---

## 🐳 Docker Commands

```bash
# Build
docker-compose -f docker-compose.prod.yml build

# Start
docker-compose -f docker-compose.prod.yml up -d

# Logs
docker-compose -f docker-compose.prod.yml logs -f cloud-api

# Stop
docker-compose -f docker-compose.prod.yml down

# Status
docker-compose -f docker-compose.prod.yml ps
```

---

## 🌐 Deployment Platforms

| Platform | Time | Effort | Cost |
|----------|------|--------|------|
| **Render** | 10 min | Easy | $7+/mo |
| **Railway** | 10 min | Easy | $5+/mo |
| **AWS ECS** | 30 min | Medium | $0.26+/hr |
| **Self-Hosted** | 1 hr | Hard | $5+/mo VPS |

**Recommended**: Render.com for beginners → Railway.app for scaling

---

## 🔗 Service Endpoints (Production)

| Service | Port | Health Check |
|---------|------|--------------|
| cloud-api | 3001 | GET / |
| connector | 3002 | GET / |
| web | 3000 | GET / |
| postgres | 5432 | Internal |
| redis | 6379 | Internal |

---

## 📝 Essential Files

```
authenx-plus/
├── docker-compose.prod.yml       ← Production stack
├── DEPLOYMENT.md                 ← Full deployment guide
├── QUICKSTART-PRODUCTION.md      ← 5-minute start
├── README.md                     ← Project overview
│
├── apps/cloud-api/
│   ├── Dockerfile.prod           ← API container
│   └── .env.production.template  ← API config template
│
├── apps/connector/
│   ├── Dockerfile.prod           ← Signing service
│   └── .env.production.template  ← Connector config
│
└── apps/web/
    ├── Dockerfile.prod           ← Frontend container
    └── .env.production.template  ← Web config
```

---

## ✅ Pre-Production Checklist

- [ ] All builds successful (`pnpm build`)
- [ ] Tests passing
- [ ] Environment variables prepared
- [ ] JWT_SECRET generated (32+ chars)
- [ ] CORS_ORIGIN set to actual domain
- [ ] Database backups configured
- [ ] Monitoring/alerts setup
- [ ] SSL certificate ready
- [ ] DNS records updated

---

## 🚀 Quick Deploy (Render.com)

1. Push code to GitHub
2. Go to render.com → Create services
3. PostgreSQL: Create database
4. Redis: Create redis
5. cloud-api: Web Service from Dockerfile.prod
   - Environment: Add JWT_SECRET, CORS_ORIGIN, etc.
6. connector: Same as cloud-api
7. web: Same as cloud-api
8. Configure custom domain
9. Done! ✅

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Services fail to start | Check `pnpm prod:logs` |
| Cannot connect to DB | Verify DATABASE_URL, check pg_isready |
| CORS errors | Check CORS_ORIGIN equals browser domain |
| JWT invalid | Generate new JWT_SECRET (32+ chars) |
| Out of memory | Increase container RAM limits |
| High CPU | Check for runaway processes in logs |

---

## 📞 Documentation

- **Main**: [README.md](README.md) - Start here
- **Production**: [DEPLOYMENT.md](DEPLOYMENT.md) - All platforms
- **Quick**: [QUICKSTART-PRODUCTION.md](QUICKSTART-PRODUCTION.md) - 5 min
- **API**: [apps/cloud-api/README.md](apps/cloud-api/README.md)
- **Web**: [apps/web/README.md](apps/web/README.md)

---

## 🔐 Security Reminders

✅ **DO:**
- Enable HTTPS/SSL
- Use unique strong passwords
- Set CORS_ORIGIN exactly
- Enable monitoring
- Backup database regularly
- Rotate secrets periodically

❌ **DON'T:**
- Commit .env files
- Use `*` for CORS_ORIGIN  
- Use default passwords
- Expose secrets in logs
- Disable security headers
- Run as root in containers

---

## 📊 Monitoring Services

```bash
# View all service status
docker-compose -f docker-compose.prod.yml ps

# Monitor resources
docker stats

# Follow logs real-time
docker-compose -f docker-compose.prod.yml logs -f

# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U authenx
```

---

## 💾 Database Operations

```bash
# Backup
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U authenx authenx > backup.sql

# Restore
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U authenx authenx < backup.sql

# Verify migrations
docker-compose -f docker-compose.prod.yml exec cloud-api \
  npx prisma migrate status
```

---

## 🎯 Performance Tuning

**Quick Wins:**
- Enable Redis caching (already configured)
- Use CDN for static assets (Cloudflare)
- Enable gzip compression (next.config.ts)
- Configure database connection pooling
- Monitor slow queries

**Scaling:**
- Add more cloud-api instances (requires load balancer)
- Use read replicas for database
- Cache frequently accessed data in Redis

---

## 📈 Monitoring Stack (Optional)

```
Logs:       CloudWatch / DataDog / Papertrail
Errors:     Sentry
APM:        DataDog / New Relic
Metrics:    Prometheus / CloudWatch
Alerts:     PagerDuty / Opsgenie
```

---

## Version Info

- **Node**: 25+
- **Next.js**: 16.1.6
- **NestJS**: 11.x
- **PostgreSQL**: 16
- **Redis**: 7
- **pnpm**: 10+

---

## 📍 Keep This Handy!

Print this card or save to bookmarks. Reference when:
- Deploying to new environment
- Troubleshooting issues
- Adding team members
- Scaling infrastructure

---

**Last Updated**: February 15, 2026
**Status**: Production Ready ✅
