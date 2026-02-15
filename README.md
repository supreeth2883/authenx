# AuthenX Plus - Enterprise Credentials Management System

Enterprise-grade credential issuance, verification, and management platform with cryptographic audit trails and production-ready deployment.

**Version**: 1.0.0  
**Status**: Production Ready

---

## 🎯 Features

### Core Capabilities
- **Credential Issuance**: Digitally sign and issue educational credentials
- **Credential Verification**: Instant verification of issued credentials
- **Audit Trail**: Cryptographic SHA-256 hash chaining for tamper detection
- **Enterprise Security**: Rate limiting, CORS, validation, structured logging

### Architecture
- **NestJS Backend** (cloud-api): REST API with JWT authentication and RBAC
- **Signing Service** (connector): Ed25519 digital signatures for credentials
- **Next.js Frontend**: Admin dashboard with analytics and audit visualization
- **PostgreSQL + Redis**: Persistent storage with caching and rate limiting

### Security
- ✅ Ed25519 cryptographic signing
- ✅ SHA-256 audit chain with tamper detection
- ✅ JWT with secure cookies
- ✅ Role-Based Access Control (RBAC)
- ✅ Rate limiting by endpoint tier
- ✅ Input validation and sanitization
- ✅ Security headers (Helmet)
- ✅ Structured logging with Winston

---

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
pnpm install

# Start development services
pnpm dev

# Services available at:
# - API: http://localhost:3001
# - Connector: http://localhost:3002
# - Web: http://localhost:3000
# - Database: localhost:5432 (authenx/authenx)
# - Redis: localhost:6379
```

### Development Credentials

```json
{
  "college_admin": {
    "email": "college@cvr.edu",
    "password": "College@2026"
  },
  "super_admin": {
    "email": "admin@authenx.io",
    "password": "Admin@2026"
  },
  "employer": {
    "email": "hr@acme.com",
    "password": "Employer@2026"
  }
}
```

---

## 📦 Monorepo Structure

```
authenx-plus/
├── apps/
│   ├── cloud-api/          # NestJS backend API
│   ├── connector/          # NestJS signing service
│   ├── web/               # Next.js admin dashboard
├── docker-compose.yml      # Development stack
├── docker-compose.prod.yml # Production stack
├── DEPLOYMENT.md          # Comprehensive deployment guide
└── QUICKSTART-PRODUCTION.md # Production quick start
```

---

## 🏗️ Project Setup

### Prerequisites

- **Node.js**: 25+
- **pnpm**: 10+
- **PostgreSQL**: 16+ (or via Docker)
- **Redis**: 7+ (or via Docker)
- **Docker**: Optional (for production builds and testing)

### Development Setup

```bash
# 1. Clone repository
git clone https://github.com/yourusername/authenx-plus.git
cd authenx-plus

# 2. Install dependencies
pnpm install

# 3. Start Docker services (PostgreSQL, Redis)
docker-compose up -d

# 4. Run migrations
cd apps/cloud-api
npx prisma migrate dev

# 5. Start development servers
cd ../..
pnpm dev
```

### Database

```bash
# Run migrations
cd apps/cloud-api
npx prisma migrate dev

# Seed demo data
npx prisma db seed

# View database
npx prisma studio
```

---

## 📚 Documentation

### Deployment & Operations
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Comprehensive deployment guide for Render, Railway, AWS
- **[QUICKSTART-PRODUCTION.md](QUICKSTART-PRODUCTION.md)**: 5-minute production setup

### Development
- **[apps/cloud-api/README.md](apps/cloud-api/README.md)**: API documentation
- **[apps/connector/README.md](apps/connector/README.md)**: Signing service
- **[apps/web/README.md](apps/web/README.md)**: Frontend documentation

### Testing
```bash
# Run tests
pnpm test

# Test specific service
pnpm --filter cloud-api test

# Run audit chain integrity test
./scripts/comprehensive-audit-test.sh

# Validate production configuration
./scripts/validate-production.sh
```

---

## 🔐 Security Features

### Authentication & Authorization
- JWT with HTTP-only secure cookies
- Role-Based Access Control (SUPER_ADMIN, COLLEGE_ADMIN, EMPLOYER)
- Password hashing with bcrypt
- Session management with Redis

### Credential Management
- Ed25519 digital signatures
- Versioned key rotation
- SHA-256 credential hashing
- Signature verification API

### Audit & Compliance
- Comprehensive audit logging
- SHA-256 hash chaining for immutability
- Cryptographic tamper detection
- Request/response logging

### API Security
- Rate limiting (5/min for auth, 20/min for verify, 100/min for public)
- Input validation with class-validator
- CORS restricted to specific domains
- Security headers via Helmet
- SQL injection prevention via Prisma

---

## 🏭 Production Deployment

### Quick Production Start

```bash
# Build production images
pnpm prod:build

# Start production stack
pnpm prod:up

# Initialize database
pnpm prod:migrate

# View logs
pnpm prod:logs
```

### Deployment Platforms

1. **Render.com** (Recommended for beginners)
   - See [DEPLOYMENT.md - Render](DEPLOYMENT.md#deployment-to-rendercom)
   - Push to GitHub, auto-deploy

2. **Railway.app**
   - See [DEPLOYMENT.md - Railway](DEPLOYMENT.md#deployment-to-railwayapp)
   - Docker-compose native support

3. **AWS / Self-Hosted**
   - See [DEPLOYMENT.md - AWS](DEPLOYMENT.md#deployment-to-aws--self-hosted)
   - ECS, Docker Swarm, or Kubernetes

### Environment Configuration

```bash
# Copy production template
cp .env.production.template .env.production

# Edit with your values
nano .env.production

# Required variables:
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET (secure random, 32+ chars)
# - CORS_ORIGIN (exact domain, no wildcards)
```

---

## 🔄 CI/CD Pipeline

### Automated Checks

```bash
# Format code
pnpm format

# Lint
pnpm lint

# Type check
pnpm typecheck

# Tests
pnpm test

# Production build
pnpm build
```

### GitHub Actions (Optional)

```yaml
# .github/workflows/deploy.yml
- Run tests
- Build Docker images
- Push to registry
- Deploy to production
```

---

## 📊 API Endpoints Overview

### Authentication
```
POST   /auth/login               - User login
POST   /auth/register            - User registration
POST   /auth/logout              - User logout
POST   /auth/refresh             - Refresh JWT token
```

### Credentials
```
POST   /credentials/issue        - Issue credential
GET    /credentials/:id          - Get credential
GET    /credentials/:id/verify   - Verify credential
POST   /credentials/:id/revoke   - Revoke credential
```

### Admin
```
GET    /admin/audit-logs         - View audit logs
GET    /admin/audit-logs/verify-chain - Verify chain integrity
GET    /admin/stats              - System statistics
GET    /admin/credentials        - List all credentials
GET    /admin/users              - List users
```

### Issuer (connector)
```
POST   /sign                     - Sign data with Ed25519
GET    /public-keys              - Get issuer public keys
```

---

## 🛠️ Common Tasks

### Development

```bash
# Start dev servers with hot reload
pnpm dev

# Watch specific service
pnpm --filter cloud-api start:dev

# Build specific service
pnpm --filter web build
```

### Database

```bash
# Create migration
cd apps/cloud-api
npx prisma migrate dev --name <migration_name>

# Reset database (dev only)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm --filter cloud-api test

# Test with coverage
pnpm test:cov

# E2E tests
pnpm test:e2e
```

### Deployment

```bash
# Build production images
pnpm prod:build

# Start production stack
pnpm prod:up

# View logs
pnpm prod:logs

# Stop services
pnpm prod:down

# Migrate production database
pnpm prod:migrate
```

---

## 🎓 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser / Client                  │
├─────────────────────────────────────────────────────┤
│                   Next.js Web (3000)                │
│  (Admin Dashboard, Audit Logs, Analytics)           │
├─────────────────────────────────────────────────────┤
│                Cache & Session Layer                 │
│                   Redis (6379)                       │
├─────────────────────────────────────────────────────┤
│              API & Business Logic Layer              │
│  ┌──────────────────┐    ┌──────────────────┐       │
│  │ cloud-api (3001) │    │ connector (3002)  │       │
│  │  (REST API)     │    │  (Signing Svc)   │       │
│  │  (Admin Auth)   │    │  (Ed25519 Keys)  │       │
│  │  (Audit Logs)   │    │                  │       │
│  └──────────────────┘    └──────────────────┘       │
├─────────────────────────────────────────────────────┤
│              Data Persistence Layer                  │
│                PostgreSQL (5432)                     │
│  (Users, Credentials, Issuers, Audit Logs)          │
└─────────────────────────────────────────────────────┘
```

---

## 📈 Monitoring & Logging

### Health Checks

All services include Docker health checks:

```bash
# Check service health
docker-compose -f docker-compose.prod.yml ps

# Manually test endpoints
curl http://localhost:3001/
curl http://localhost:3002/
curl http://localhost:3000/
```

### Structured Logging

Winston JSON logging with:
- Request/response logging
- Error tracking
- Audit events
- Performance metrics

Configure via `LOG_LEVEL` environment variable:
- `error` - Errors only
- `warn` - Warnings and errors
- `info` - General information
- `debug` - Detailed debugging (dev only)

### Monitoring Integration

Easily integrate with:
- **Sentry**: Error tracking
- **DataDog**: Full observability
- **New Relic**: Performance monitoring
- **CloudWatch**: AWS logging

---

## 🔒 Security Checklist

- [x] CORS restricted to specific domains
- [x] Rate limiting implemented
- [x] Input validation enforced
- [x] Security headers via Helmet
- [x] JWT authentication with secure cookies
- [x] Password hashing with bcrypt
- [x] SQL injection prevention (Prisma ORM)
- [x] XSS protection enabled
- [x] CSRF protection via same-site cookies
- [x] Audit logging with hash chaining
- [x] Cryptographic signatures (Ed25519)
- [x] Environment-based configuration

### Before Production
- [ ] Generate all secrets (JWT, session, passwords)
- [ ] Update CORS_ORIGIN to production domain
- [ ] Enable HTTPS/SSL
- [ ] Configure automatic backups
- [ ] Set up error tracking
- [ ] Enable monitoring and alerts
- [ ] Review security headers
- [ ] Test all authentication flows

---

## 🤝 Contributing

1. Create a feature branch
2. Make changes and test
3. Commit with clear messages
4. Push and create pull request
5. Ensure CI/CD passes

### Code Style

```bash
# Format code
pnpm format

# Lint
pnpm lint

# Type check
npm run typecheck
```

---

## 📝 License

Proprietary - All rights reserved

---

## 📞 Support

For issues, questions, or deployment help:

1. Check [DEPLOYMENT.md](DEPLOYMENT.md)
2. Review [QUICKSTART-PRODUCTION.md](QUICKSTART-PRODUCTION.md)
3. Check service-specific READMEs
4. Review logs: `pnpm prod:logs`

---

## 🔄 Changelog

### v1.0.0 (February 15, 2026)
- ✅ Enterprise security hardening
- ✅ Audit chain integrity verification
- ✅ Production-ready Dockerfiles
- ✅ Multi-platform deployment support
- ✅ Comprehensive documentation

---

**Last Updated**: February 15, 2026  
**Maintained by**: AuthenX Team
