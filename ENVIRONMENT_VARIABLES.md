# Environment Variables Reference

Complete reference for all environment variables across the AuthenX platform.

---

## Cloud API (`apps/cloud-api`)

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Prisma) | `postgresql://user:pass@host:5432/authenx` |
| `JWT_SECRET` | JWT signing secret (32+ chars, random) | `$(openssl rand -base64 32)` |
| `CONNECTOR_ADMIN_KEY` | Shared secret for Cloud API → Connector auth | `$(openssl rand -base64 32)` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `JWT_EXPIRES_IN` | `24h` | JWT token expiration (e.g., `1h`, `7d`) |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origins; comma-separated in prod |
| `CONNECTOR_URL` | `http://localhost:3002` | Connector service base URL |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Winston log level: `error`, `warn`, `info`, `debug` |
| `REDIS_URL` | — | Redis connection URL for rate limiting/caching |
| `SESSION_SECRET` | — | Session secret (recommended in production) |

### Logging Behavior

| `NODE_ENV` | Console Output | Default `LOG_LEVEL` |
|-----------|---------------|---------------------|
| `development` | All levels (error, warn, log, debug, verbose) | `debug` |
| `production` | error, warn, log only | `info` |

---

## Connector (`apps/connector`)

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `CONNECTOR_DATABASE_URL` | PostgreSQL connection for ERP data | `postgresql://user:pass@host:5432/connector` |
| `CONNECTOR_ADMIN_KEY` | Admin key for authenticating inbound requests | Must match Cloud API's `CONNECTOR_ADMIN_KEY` |
| `ISSUER_CODE` | Issuer code identifying this connector | `CVR`, `MIT`, `STANFORD` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `CLOUD_API_URL` | `http://localhost:3001` | Cloud API base URL |

### Key Management

Ed25519 signing keys. If none are set, a new keypair is auto-generated on startup.

| Variable | Description |
|----------|-------------|
| `SIGNING_PUBLIC_KEY_RAW` | Ed25519 raw public key (base64, 32 bytes). **Recommended for production.** |
| `SIGNING_PRIVATE_KEY_RAW` | Ed25519 raw private key (base64, 32 bytes). **Recommended for production.** |
| `SIGNING_PUBLIC_KEY` | Ed25519 DER-encoded public key (base64). Legacy fallback. |
| `SIGNING_PRIVATE_KEY` | Ed25519 DER-encoded private key (base64). Legacy fallback. |

**Priority**: `SIGNING_*_RAW` variables take precedence over DER-encoded `SIGNING_*` variables.

**Generate a keypair:**

```bash
# Using Node.js
node -e "
const nacl = require('tweetnacl');
const { encodeBase64 } = require('tweetnacl-util');
const kp = nacl.sign.keyPair();
console.log('SIGNING_PUBLIC_KEY_RAW=' + encodeBase64(kp.publicKey));
console.log('SIGNING_PRIVATE_KEY_RAW=' + encodeBase64(kp.secretKey.slice(0, 32)));
"
```

---

## Web Frontend (`apps/web`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_URL` | No | — | Server-side API URL (not baked at build time). Preferred in Docker. |
| `NEXT_PUBLIC_API_URL` | No | — | Client-side API URL (baked at build time). |
| `NODE_ENV` | No | `development` | Environment mode |

**URL Resolution Order** (in the API proxy route):

```
API_URL  →  NEXT_PUBLIC_API_URL  →  http://localhost:3001
```

> **Important:** `API_URL` is resolved at runtime and is ideal for Docker/Render where the backend URL varies. `NEXT_PUBLIC_API_URL` is baked into the JavaScript bundle at build time.

---

## Docker Compose / Production

Variables used in `docker-compose.prod.yml` and `.env.production.template`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_POOL_MIN` | — | Minimum database connection pool size |
| `DATABASE_POOL_MAX` | — | Maximum database connection pool size |
| `DATABASE_IDLE_TIMEOUT` | — | Idle connection timeout (ms) |
| `DATABASE_STATEMENT_TIMEOUT` | — | Statement execution timeout (ms) |

---

## Security Best Practices

### Secret Generation

```bash
# Generate a secure random secret (JWT, session, admin key)
openssl rand -base64 32

# Generate multiple secrets at once
for name in JWT_SECRET SESSION_SECRET CONNECTOR_ADMIN_KEY; do
  echo "$name=$(openssl rand -base64 32)"
done
```

### Production Checklist

- [ ] `JWT_SECRET` is a unique, random 32+ character string
- [ ] `CONNECTOR_ADMIN_KEY` matches between Cloud API and Connector
- [ ] `CORS_ORIGIN` is set to your exact production domain (no wildcards)
- [ ] `NODE_ENV=production` is set on all services
- [ ] `DATABASE_URL` uses SSL (`?sslmode=require`) in production
- [ ] `REDIS_URL` is configured for rate limiting persistence
- [ ] No default/development secrets are used in production
- [ ] `LOG_LEVEL` is set to `info` or `warn` (not `debug`)

### Example `.env.production`

```bash
# Cloud API
DATABASE_URL=postgresql://authenx:secure-password@db.host:5432/authenx?sslmode=require
JWT_SECRET=your-secure-random-secret-here
JWT_EXPIRES_IN=24h
CONNECTOR_URL=https://connector.yourdomain.com
CONNECTOR_ADMIN_KEY=shared-secret-between-api-and-connector
CORS_ORIGIN=https://app.yourdomain.com
LOG_LEVEL=info
REDIS_URL=redis://redis.host:6379
NODE_ENV=production

# Connector
CONNECTOR_DATABASE_URL=postgresql://connector:secure-password@db.host:5432/connector_erp?sslmode=require
ISSUER_CODE=YOUR-INSTITUTION
CONNECTOR_ADMIN_KEY=shared-secret-between-api-and-connector
CLOUD_API_URL=https://api.yourdomain.com
SIGNING_PUBLIC_KEY_RAW=base64-encoded-public-key
SIGNING_PRIVATE_KEY_RAW=base64-encoded-private-key
NODE_ENV=production

# Web
API_URL=http://cloud-api:3001  # Internal Docker network URL
NODE_ENV=production
```
