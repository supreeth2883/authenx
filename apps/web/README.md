# AuthenX Web

Role-based portal frontend for the AuthenX digital credential platform. Provides dashboards for administrators, college credential managers, and employer verifiers.

Built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, **Framer Motion**, and **Chart.js**.

## Architecture

```
                                    ┌───────────────────┐
                                    │    Cloud API       │
                                    │   (port 3001)      │
                                    └────────▲──────────┘
                                             │
┌─────────────┐   ┌────────────────┐   ┌─────┴──────────┐
│   Browser   │──▶│  Next.js App   │──▶│  /api/proxy/*  │
│             │   │  (port 3000)   │   │  (catch-all)   │
└─────────────┘   └────────┬───────┘   └────────────────┘
                           │
                    Middleware RBAC
                  (JWT cookie check)
```

The frontend never calls the Cloud API directly from the browser. All requests go through the `/api/proxy/[...path]` catch-all route, which:

- Forwards requests to the Cloud API server-side
- Injects the JWT from the cookie as an auth header
- Adds `x-request-id` for observability
- Never exposes backend secrets to the browser

## Quick Start

```bash
# From monorepo root
pnpm install

# Start in development mode
cd apps/web
pnpm dev               # http://localhost:3000
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Development mode with hot reload |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm start:prod` | Start with `NODE_ENV=production` |
| `pnpm lint` | Lint with ESLint |

## Project Structure

```
src/
├── middleware.ts              # RBAC route protection (JWT + role checks)
├── app/
│   ├── page.tsx              # Landing / role-based redirect
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Tailwind v4 imports
│   ├── login/
│   │   └── page.tsx          # Login page
│   ├── admin/                # SUPER_ADMIN portal
│   │   ├── page.tsx          # Admin dashboard (stats, charts, analytics)
│   │   ├── issuers/page.tsx  # Issuer management (register, ping, ERP)
│   │   ├── users/page.tsx    # User management (CRUD)
│   │   ├── audit/page.tsx    # Audit log viewer (chain verification, CSV export)
│   │   └── qa/page.tsx       # QA tools (mock data seeding, issue testing)
│   ├── college/              # COLLEGE_ADMIN portal
│   │   ├── page.tsx          # College dashboard
│   │   └── issue/page.tsx    # Credential issuance (ERP lookup, batch publish)
│   ├── employer/             # EMPLOYER portal
│   │   ├── page.tsx          # Employer dashboard
│   │   └── verify/[id]/page.tsx  # Credential verification detail
│   ├── verify/
│   │   └── [id]/page.tsx     # Public verification page (no auth)
│   └── api/
│       └── proxy/[...path]/route.ts  # API proxy catch-all
├── components/
│   ├── ui/                   # Shared UI component library
│   │   ├── index.ts          # Barrel exports
│   │   ├── spinner.tsx       # Spinner, PageSpinner
│   │   ├── modal.tsx         # Modal dialog
│   │   ├── cards.tsx         # StatCard, Card, Badge, RoleBadge, StatusDot, EmptyState
│   │   ├── form.tsx          # Button, Field, Pagination, inputCls, selectCls
│   │   ├── toast.tsx         # Toast, ToastContainer, useToast hook
│   │   └── qr-modal.tsx      # QR code modal (copy link, PNG download)
│   ├── layout/
│   │   ├── portal-header.tsx # PortalHeader (title, nav, logout, accent color)
│   │   └── portal-shell.tsx  # PortalShell (header + max-w-7xl content wrapper)
│   └── shells/
│       ├── admin-shell.tsx   # AdminShell (indigo accent, shield icon)
│       ├── college-shell.tsx # CollegeShell (emerald accent, issuer info)
│       └── employer-shell.tsx # EmployerShell (blue accent)
└── lib/
    └── api.ts                # Centralized API client
```

## Component Library

All shared components are exported from `@/components/ui`:

```typescript
import {
  Spinner, PageSpinner,
  Modal,
  StatCard, Card, Badge, RoleBadge, StatusDot, EmptyState,
  Button, Field, Pagination, inputCls, selectCls,
  Toast, ToastContainer, useToast,
  QrModal,
} from "@/components/ui";
```

### Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Spinner` | `size?`, `label?` | Inline loading spinner |
| `PageSpinner` | `gradient?` | Full-screen centered spinner |
| `Modal` | `open`, `onClose`, `title`, `subtitle?`, `maxWidth?` | Dialog overlay |
| `Button` | `variant`, `size`, `loading?`, `disabled?` | Styled button (primary/secondary/danger/ghost) |
| `StatCard` | `title`, `value`, `color` | Dashboard metric card (9 color variants) |
| `Card` | `padding?`, `children` | Generic card wrapper |
| `Badge` | `label`, `color` | Colored badge pill |
| `RoleBadge` | `role` | Role-specific badge (auto-colored) |
| `StatusDot` | `active` | Green/red status indicator |
| `EmptyState` | `icon`, `title`, `description` | Empty data placeholder |
| `Field` | `label`, `error?`, `children` | Form field wrapper |
| `Pagination` | `page`, `totalPages`, `total`, `limit`, `onPageChange` | Page navigation |
| `QrModal` | `open`, `onClose`, `credentialId`, `name` | QR code with copy/download |
| `Toast` / `useToast` | — | Toast notifications (success/error/info) |

### Layout Shells

| Shell | Accent | Purpose |
|-------|--------|---------|
| `AdminShell` | Indigo | Wraps all `/admin/*` pages with nav + header |
| `CollegeShell` | Emerald | Wraps all `/college/*` pages, shows issuer info |
| `EmployerShell` | Blue | Wraps all `/employer/*` pages |

## API Client

Centralized in `lib/api.ts`. All pages use these functions instead of raw `fetch()`:

```typescript
import { apiGet, apiPost, apiPatch, apiDelete, apiRaw, ApiError } from "@/lib/api";

// Typed GET request
const data = await apiGet<StatsResponse>("/admin/stats");

// POST with body
const result = await apiPost("/credentials/issue", { payload });

// Error handling
try {
  await apiGet("/auth/me");
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    // Redirect to login
  }
}
```

Features:
- Automatic `/api/proxy/` prefix
- `x-request-id` generation for tracing
- 401 detection with redirect to `/login`
- Retry on 502/503 (transient errors)
- `ApiError` class with `status` and `data` properties

## Middleware RBAC

Defined in `src/middleware.ts`. Runs on every request:

**Public paths** (no auth): `/login`, `/_next`, `/favicon.ico`, `/api/`

**Role-based routing:**

| Path Prefix | Required Role | Unauthorized Redirect |
|-------------|--------------|----------------------|
| `/admin/*` | `SUPER_ADMIN` | User's own portal |
| `/college/*` | `COLLEGE_ADMIN` | User's own portal |
| `/employer/*` | `EMPLOYER` | User's own portal |

**Root redirect (`/`):** Authenticated users are sent to their role's portal.

## Styling

- **Tailwind CSS v4** — uses `@import "tailwindcss"` syntax (no `tailwind.config.js`)
- **Framer Motion** — page transitions and micro-animations
- **Consistent theme** — each portal has a distinct accent color applied via shells
- **Dark mode** — dark background (`bg-gray-950`) with light text

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_URL` | No | — | Server-side Cloud API URL (takes priority, not baked at build) |
| `NEXT_PUBLIC_API_URL` | No | — | Client-side API URL (baked at build time) |
| `NODE_ENV` | No | `development` | Environment mode |

> **Note:** The proxy route resolves the API URL as: `API_URL` > `NEXT_PUBLIC_API_URL` > `http://localhost:3001`

## Dependencies

| Package | Purpose |
|---------|---------|
| `next` | React framework (App Router) |
| `react` / `react-dom` | UI library |
| `tailwindcss` | Utility-first CSS |
| `framer-motion` | Animations |
| `chart.js` / `react-chartjs-2` | Dashboard charts |
| `qrcode.react` | QR code generation |
