# AuthenX Cloud API

Central REST API for the AuthenX digital credential platform. Manages credential issuance, verification, user authentication, issuer registration, audit logging, and admin operations.

Built with **NestJS 11**, **Prisma 5** (PostgreSQL), **JWT authentication** (HttpOnly cookies), and **Ed25519 digital signatures**.

## Architecture

```
┌────────────────────┐
│     Web Frontend   │── /api/proxy/* ──▶ Cloud API
└────────────────────┘
         │
   ┌─────▼──────┐          ┌──────────────┐
   │  Cloud API  │──────▶   │  Connector   │
   │  (port 3001)│◀──────   │  (port 3002) │
   └─────┬──────┘          └──────────────┘
         │
   ┌─────▼──────┐
   │ PostgreSQL  │
   └─────┬──────┘
         │
   ┌─────▼──────┐
   │   Redis     │  (rate limiting / caching)
   └─────────────┘
```

## Quick Start

```bash
# From monorepo root
pnpm install

# Set up environment
cp .env.example .env      # configure DATABASE_URL, JWT_SECRET, etc.

# Run database migrations
cd apps/cloud-api
npx prisma migrate dev

# Seed default admin user
pnpm db:seed

# Start in development mode
pnpm start:dev            # http://localhost:3001
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm build` | Compile TypeScript via NestJS CLI |
| `pnpm start:dev` | Watch mode with hot reload |
| `pnpm start:debug` | Watch mode with debugger attached |
| `pnpm start:prod` | Run compiled `dist/src/main.js` |
| `pnpm test` | Run unit tests (Jest) |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:cov` | Run tests with coverage |
| `pnpm migrate:dev` | Create + apply Prisma migrations |
| `pnpm migrate:prod` | Apply pending migrations (deploy) |
| `pnpm db:seed` | Seed database with default admin |
| `pnpm lint` | Lint & auto-fix with ESLint |
| `pnpm format` | Format with Prettier |

## Project Structure

```
src/
├── main.ts                  # Bootstrap (Helmet, CORS, cookie-parser)
├── app.module.ts            # Root module (ThrottlerGuard global)
├── admin/                   # Admin dashboard endpoints
│   ├── admin.controller.ts  # /admin/* routes (stats, credentials, analytics, audit, health)
│   └── admin.module.ts
├── auth/                    # Authentication
│   ├── auth.controller.ts   # /auth/login, /auth/register, /auth/logout, /auth/me
│   ├── auth.service.ts      # JWT + bcrypt logic
│   ├── jwt.strategy.ts      # Passport JWT strategy (cookie extraction)
│   ├── guards/              # JwtAuthGuard, RolesGuard
│   ├── decorators/          # @Roles() decorator
│   └── dto/                 # LoginDto, RegisterDto
├── credentials/             # Credential lifecycle
│   ├── credentials.controller.ts  # Issue, verify, revoke, public verify
│   ├── credentials.service.ts     # Signing, hash chain, connector calls
│   ├── credentials.module.ts
│   └── dto/                 # IssueCredentialDto, etc.
├── issuers/                 # Issuer management
│   ├── issuers.controller.ts   # Register, rotate keys, public keys
│   ├── issuers.service.ts
│   └── issuers.module.ts
├── audit/                   # Tamper-evident audit logging
│   ├── audit.service.ts     # SHA-256 hash chain with integrity verification
│   └── audit.module.ts
├── verify/                  # Connector ping
├── well-known/              # /.well-known/authenx/ DID/JWKS endpoints
├── config/                  # ConfigService wrapper
├── logger/                  # Winston structured logging
├── prisma/                  # PrismaService (lifecycle hooks)
├── throttle/                # Rate limiting decorators
└── middleware/              # Request logging middleware
```

## API Reference

### Authentication — `/auth`

| Method | Route | Auth | Rate Limit | Description |
|--------|-------|------|------------|-------------|
| POST | `/auth/login` | None | 5 req/min | Login, sets HttpOnly JWT cookie |
| POST | `/auth/register` | SUPER_ADMIN | — | Register new user |
| POST | `/auth/logout` | None | — | Clears token cookie |
| GET | `/auth/me` | JWT | — | Current user info |

### Credentials — `/credentials`

| Method | Route | Auth | Rate Limit | Description |
|--------|-------|------|------------|-------------|
| POST | `/credentials/issue` | COLLEGE_ADMIN | 20 req/min | Issue a signed credential |
| GET | `/credentials/:id/verify` | EMPLOYER | 20 req/min | Authenticated employer verification |
| GET | `/credentials/:id` | None | 20 req/min | Public credential lookup |

### Public Verify — `/verify`

| Method | Route | Auth | Rate Limit | Description |
|--------|-------|------|------------|-------------|
| GET | `/verify/:id` | None | 20 req/min | Public cryptographic verification |
| POST | `/verify/ping` | None | — | Ping issuer connector |

### College Credentials — `/college/credentials`

All routes require `COLLEGE_ADMIN` role (scoped to user's `issuerCode`).

| Method | Route | Rate Limit | Description |
|--------|-------|------------|-------------|
| GET | `/college/credentials` | — | Paginated list for issuer |
| PATCH | `/college/credentials/:id/revoke` | — | Revoke credential |
| POST | `/college/credentials/precheck` | — | Validate student against ERP |
| POST | `/college/credentials/issue-from-erp` | 20 req/min | Single-student issue from ERP |
| POST | `/college/credentials/publish` | 20 req/min | Batch publish from ERP data |

### Employer — `/employer`

All routes require `EMPLOYER` role.

| Method | Route | Rate Limit | Description |
|--------|-------|------------|-------------|
| GET | `/employer/verify/:id` | 20 req/min | Verification (PII-stripped response) |

### Issuers — `/issuers`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/issuers/register` | SUPER_ADMIN | Register new issuer org |
| POST | `/issuers/:issuerCode/rotate-key` | SUPER_ADMIN | Rotate Ed25519 signing key |
| GET | `/issuers/:issuerCode/public-keys` | None | List public keys |

### Admin — `/admin`

All routes require `SUPER_ADMIN` role.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/admin/stats` | Dashboard statistics |
| GET | `/admin/credentials` | Paginated credential list (search/filter) |
| GET | `/admin/credentials/:id` | Credential detail |
| GET | `/admin/analytics` | Issued/day, verification rate, top orgs |
| GET | `/admin/logs` | Verification logs |
| GET | `/admin/audit-logs` | Paginated audit logs (filter by action/org/date) |
| GET | `/admin/audit-logs/verify-chain` | Verify audit hash chain integrity |
| GET | `/admin/audit-logs/export` | Export audit logs as CSV |
| GET | `/admin/health` | System health (API, Postgres, Redis) |

### Admin Users — `/admin/users`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/admin/users` | List users (filter: role, issuerCode, active) |
| POST | `/admin/users` | Create user |
| PATCH | `/admin/users/:id` | Update user |
| DELETE | `/admin/users/:id` | Deactivate user |

### Admin Issuers — `/admin/issuers`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/admin/issuers` | List all issuers |
| POST | `/admin/issuers/register` | Register issuer |
| POST | `/admin/issuers/check-connector` | Health-check connector URL |
| POST | `/admin/issuers/:issuerCode/ping` | Ping connector |
| GET | `/admin/issuers/:issuerCode/erp/status` | ERP admin mode status |
| GET | `/admin/issuers/:issuerCode/erp/records` | List ERP records |
| POST | `/admin/issuers/:issuerCode/erp/upsert-batch` | Seed ERP records |
| POST | `/admin/issuers/:issuerCode/credentials/issue` | Issue from ERP (Model A) |
| GET | `/admin/issuers/:issuerCode/credentials` | List credentials by issuer |
| GET | `/admin/issuers/:issuerCode/credentials/:id` | Credential detail by issuer |
| POST | `/admin/issuers/:issuerCode/credentials/:id/revoke` | Revoke credential |

### Well-Known — `/.well-known/authenx`

Public endpoints for credential verification infrastructure.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/.well-known/authenx/:issuerCode/public-key` | Ed25519 public keys |
| GET | `/.well-known/authenx/:issuerCode/jwks` | JWK Set format |
| GET | `/.well-known/authenx/:issuerCode/did.json` | W3C DID Document |

## Database Schema

Managed with Prisma ORM. See [`prisma/schema.prisma`](prisma/schema.prisma) for the full schema.

### Models

| Model | Purpose |
|-------|---------|
| `User` | Platform users (SUPER_ADMIN, COLLEGE_ADMIN, EMPLOYER) |
| `Org` | Organizations (issuers, employers) |
| `Issuer` | Registered issuer with connector URL and keys |
| `IssuerKey` | Versioned Ed25519 key pairs per issuer |
| `Token` | Issued credential tokens |
| `Credential` | Full credential records (name, degree, hash, signature) |
| `Verification` | Verification attempt records |
| `VerificationLog` | Detailed verification results |
| `AuditLog` | Tamper-evident audit chain (SHA-256 linked) |

### Key Enums

- **UserRole**: `SUPER_ADMIN`, `COLLEGE_ADMIN`, `EMPLOYER`
- **CredentialStatus**: `ISSUED`, `REVOKED`
- **AuditAction**: `CREDENTIAL_ISSUED`, `CREDENTIAL_VERIFIED`, `CREDENTIAL_REVOKED`
- **VerifyOutcome**: `ISSUANCE_VERIFIED`, `LIVE_VERIFIED`, `NOT_FOUND`, `OFFLINE`, `MISMATCH`, `ERROR`

## Security

### Authentication Flow

1. `POST /auth/login` — validates credentials via bcrypt, returns JWT in HttpOnly cookie
2. JWT extracted from cookie on subsequent requests via Passport strategy
3. `RolesGuard` enforces role-based access per route

### Rate Limiting

Applied globally via `@nestjs/throttler` with tiered decorators:

| Tier | Limit | Applied To |
|------|-------|------------|
| **Default** | 100 req/min | All endpoints (global) |
| **Public** | 100 req/min | Public endpoints |
| **Verify** | 20 req/min | Issue / verify operations |
| **Auth** | 5 req/min | Login (brute-force protection) |

### Security Headers

Helmet middleware applies in production:

- Content Security Policy (strict directives)
- HSTS (1 year, includeSubDomains)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Hidden X-Powered-By

### Audit Trail

Every credential operation creates a SHA-256 hash-chained `AuditLog` entry:

- `previousHash` references the prior log's `currentHash`
- Tamper detection via `/admin/audit-logs/verify-chain`
- CSV export for compliance

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | dev fallback | JWT signing secret |
| `JWT_EXPIRES_IN` | No | `24h` | Token expiration |
| `PORT` | No | `3001` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed origins (comma-separated in prod) |
| `LOG_LEVEL` | No | `debug` / `info` | Winston log level |
| `CONNECTOR_URL` | Yes | `http://localhost:3002` | Connector service URL |
| `CONNECTOR_ADMIN_KEY` | Yes | — | Shared secret for connector auth |
| `REDIS_URL` | No | — | Redis URL (rate limiting/caching) |
| `SESSION_SECRET` | Prod | — | Session secret key |

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:cov
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/core` | NestJS framework |
| `@nestjs/jwt` | JWT generation/validation |
| `@nestjs/passport` | Passport integration |
| `@nestjs/throttler` | Rate limiting |
| `@prisma/client` | Database ORM |
| `bcrypt` | Password hashing |
| `tweetnacl` | Ed25519 signing/verification |
| `helmet` | Security headers |
| `cookie-parser` | JWT cookie extraction |
| `winston` | Structured logging |
| `class-validator` | DTO validation |
