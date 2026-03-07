# AuthenX Connector

On-premise signing and ERP integration service for the AuthenX credential platform. Each educational institution runs a Connector instance that holds Ed25519 private keys, signs credential payloads, and bridges the institution's student record system (ERP) with the central Cloud API.

Built with **NestJS 11**, **TweetNaCl** (Ed25519), and **Prisma 5** (PostgreSQL ERP store).

## Architecture

```
┌──────────────┐          ┌──────────────┐          ┌──────────┐
│   Cloud API  │──────▶   │  Connector   │──────▶   │  ERP DB  │
│  (port 3001) │◀──────   │  (port 3002) │          │ (Prisma) │
└──────────────┘          └───────┬──────┘          └──────────┘
                                  │
                           Ed25519 Keys
                         (file / env-based)
```

The Connector acts as a trust boundary — it never exposes private keys to the Cloud API. All signing happens locally, and only public keys are shared.

## Quick Start

```bash
# From monorepo root
pnpm install

# Set up environment
cd apps/connector
cp .env.example .env   # configure CONNECTOR_ADMIN_KEY, ISSUER_CODE, etc.

# Start in development mode
pnpm start:dev         # http://localhost:3002
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm build` | Generate Prisma client + compile TypeScript |
| `pnpm start:dev` | Watch mode with hot reload |
| `pnpm start:debug` | Watch mode with debugger attached |
| `pnpm start:prod` | Run compiled `dist/main.js` |
| `pnpm test` | Run unit tests (Jest) |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm test:cov` | Run tests with coverage |
| `pnpm prisma:generate` | Generate Prisma client |
| `pnpm prisma:migrate` | Apply pending migrations (deploy) |
| `pnpm prisma:seed` | Seed ERP mock data |
| `pnpm lint` | Lint & auto-fix with ESLint |
| `pnpm format` | Format with Prettier |

## Project Structure

```
src/
├── main.ts              # Bootstrap (CORS, binds 0.0.0.0)
├── app.module.ts        # Root module
├── app.controller.ts    # Root routes (health, public keys, ping, rotate-key)
├── app.service.ts       # Core logic
├── keys/                # Ed25519 key management
│   ├── keys.service.ts  # Key generation, loading (env/file), rotation
│   └── keys.module.ts
├── sign/                # Payload signing
│   ├── sign.controller.ts  # POST /sign
│   ├── sign.service.ts     # Ed25519 sign with TweetNaCl
│   └── sign.module.ts
├── erp/                 # ERP data management
│   ├── erp.controller.ts   # Student records CRUD, validation, publishing
│   ├── erp.service.ts      # ERP business logic
│   └── erp.module.ts
└── ping/                # Ping/health utilities
data/
└── mock_erp.json        # Sample ERP student records
```

## API Reference

### Root Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/` | None | Health check / hello |
| GET | `/public-key` | None | Active Ed25519 public key (base64) |
| GET | `/public-keys` | None | All known public keys (active + rotated) |
| GET | `/keys/debug` | None | Key diagnostics info |
| POST | `/rotate-key` | AdminKeyGuard | Disabled — returns instructions |
| POST | `/ping` | AdminKeyGuard | Signed ping/nonce response |

### Signing — `/sign`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/sign` | AdminKeyGuard | Sign a JSON payload with Ed25519 |

**Request body:**

```json
{
  "payload": { "name": "...", "degree": "...", "..." : "..." },
  "keyVersion": 1
}
```

**Response:**

```json
{
  "signature": "<base64-encoded Ed25519 signature>",
  "publicKey": "<base64-encoded public key>",
  "keyVersion": 1
}
```

### ERP — `/erp`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/erp/health` | None | ERP health status |
| GET | `/erp/admin/status` | AdminKeyGuard | Admin mode status |
| POST | `/erp/validate-student` | AdminKeyGuard | Validate student against ERP records |
| POST | `/erp/publish-results` | AdminKeyGuard | Publish ERP results to Cloud API |
| GET | `/erp/admin/records` | AdminKeyGuard | List all student records |
| GET | `/erp/admin/lookup/:rollNumber` | AdminKeyGuard | Lookup single student |
| POST | `/erp/admin/upsert` | AdminKeyGuard | Upsert single student record |
| POST | `/erp/admin/upsert-batch` | AdminKeyGuard | Batch upsert (max 500 records) |
| DELETE | `/erp/admin/records/:rollNumber` | AdminKeyGuard | Delete student record |

## Key Management

### Ed25519 Signing Keys

The Connector uses Ed25519 (via TweetNaCl) for all credential signing. Keys can be provided via:

1. **Environment variables** (recommended for production):
   - `SIGNING_PUBLIC_KEY_RAW` / `SIGNING_PRIVATE_KEY_RAW` — base64-encoded raw 32-byte keys
   - `SIGNING_PUBLIC_KEY` / `SIGNING_PRIVATE_KEY` — base64-encoded DER keys (legacy fallback)

2. **Auto-generated** — If no keys are provided, the service generates a new keypair on startup and logs the public key.

### Key Rotation

Key rotation is managed centrally through the Cloud API:

- `POST /issuers/:issuerCode/rotate-key` on Cloud API
- Cloud API generates a new keypair and stores it in `IssuerKey`
- Old keys remain for verification of previously-issued credentials
- The connector's local `/rotate-key` endpoint is disabled by design

## Authentication

All protected endpoints use the `AdminKeyGuard`, which validates the `x-admin-key` header against the `CONNECTOR_ADMIN_KEY` environment variable. This shared secret authenticates Cloud API to Connector calls.

```bash
# Example authenticated request
curl -H "x-admin-key: your-secret-key" http://localhost:3002/sign \
  -H "Content-Type: application/json" \
  -d '{"payload": {"name": "Test"}, "keyVersion": 1}'
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CONNECTOR_DATABASE_URL` | Yes | — | PostgreSQL connection (ERP data) |
| `PORT` | No | `3002` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `CLOUD_API_URL` | No | `http://localhost:3001` | Cloud API base URL |
| `ISSUER_CODE` | Yes | — | Issuer code for this connector |
| `CONNECTOR_ADMIN_KEY` | Yes | — | Shared secret for admin auth |
| `SIGNING_PUBLIC_KEY_RAW` | Prod | — | Ed25519 raw public key (base64) |
| `SIGNING_PRIVATE_KEY_RAW` | Prod | — | Ed25519 raw private key (base64) |
| `SIGNING_PUBLIC_KEY` | No | — | Ed25519 DER public key (legacy) |
| `SIGNING_PRIVATE_KEY` | No | — | Ed25519 DER private key (legacy) |

## Mock ERP Data

Sample student records are in [`data/mock_erp.json`](data/mock_erp.json). Seed them via:

```bash
# Seed via Prisma
pnpm prisma:seed

# Or via API
curl -X POST http://localhost:3002/erp/admin/upsert-batch \
  -H "x-admin-key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"records": [...]}'
```

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@nestjs/core` | NestJS framework |
| `@prisma/client` | Database ORM (ERP records) |
| `tweetnacl` | Ed25519 key generation + signing |
| `tweetnacl-util` | Base64/UTF-8 encoding utilities |
| `dotenv` | Environment variable loading |
