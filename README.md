# Unaabs Smart Events

Mobile-first, multi-tenant business app for Nigerian event businesses (caterers, small-chops vendors, planners, decorators). Next.js 14 (App Router) · TypeScript · Supabase (Postgres, Auth, Storage, RLS) · Tailwind. Vercel-ready.

## 1. Setup
```bash
npm install
cp .env.example .env.local      # fill in the 4 values below
npm run build                   # FIRST THING TO RUN: the UI has not been compiled yet (see Known limitations)
npm run dev
```

### Environment variables
| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used only by the customer-portal and public-page routes. Never prefix with NEXT_PUBLIC. |
| `NEXT_PUBLIC_APP_URL` | client+server | e.g. `https://yourapp.vercel.app` (used to build portal links) |

## 2. Supabase configuration
1. Create a project.
2. SQL Editor: run `sql/001_schema.sql`, `002_rls.sql`, `003_portal.sql`, `004_storage.sql`, `005_demo.sql`, `006_booking_rpc.sql` **in that order**.
3. Authentication → Providers: enable Email. Decide whether to require email confirmation (if on, set Site URL to `NEXT_PUBLIC_APP_URL` and add `<APP_URL>/**` to Redirect URLs; the sign-up screen handles both modes).
4. Storage: migration 004 creates public buckets `branding` and `event-images`; writes are limited to the `<business_id>/` folder of the caller's own business.
5. Copy URL, anon key and service-role key into the env vars.

## 3. Deploy (Vercel)
Import the repo, add the 4 env vars (service-role key as a non-public variable), deploy. Add the Vercel URL to Supabase Auth redirect URLs.

## 4. Security model
- Every business table carries `business_id`; RLS is on everywhere and policies use `is_member()` / `has_role()`. Composite FKs `(id, business_id)` stop cross-tenant references.
- Payments are append-only (no update/delete policy); overpayment is blocked by trigger unless the booking opts in. Balances are always computed (`event_financials` view), never stored.
- Customer portal `/portal/<token>`: 256-bit random token, only its SHA-256 hash is stored, 90-day expiry, revocable/regeneratable. Served by `get_portal()` (service-role only) which returns a whitelist: no internal notes, vendor costs, expenses, profit, ids, or other customers. No IPs stored.
- The raw link is shown **once** at generation; afterwards only regenerate.

## 5. Testing
```bash
npm test        # 16 pure-logic tests (money, token, phone, journey, costing, colour)
npm run test:db # 101 DB security assertions; needs a THROWAWAY local Postgres 15/16 superuser
                # PGHOST=localhost PGPORT=5432 PGUSER=postgres npm run test:db
```
Manual checklist: sign up → onboarding → add customer → create booking (₦500,000) → record ₦300,000 then ₦200,000 (balance ₦0, Paid in Full) → try overpaying (blocked) → generate portal link, open in a private window (no notes/costs/profit visible) → revoke (link shows revoked) → regenerate → second account cannot see first account's data → WhatsApp button opens wa.me with a normalised number → upload logo → public page `/business/<slug>`.

## 6. Known limitations
- **UI never compiled here** (npm registry was unreachable in the build environment). Only the SQL layer and pure logic were executed. Expect to fix a few type/build errors on first `npm run build`.
- Unused leftover components from an earlier draft: `BookingWizard`, `QuoteEditor`, `WhatsAppSheet`, `ExpenseForm`, `event/Journey`, `event/types.ts`, and `app/app/events/[id]/edit/page.tsx`. Safe to delete or keep; the live flows use `EditEventModal`, `QuoteForm`, `WhatsAppDialog`.
- WhatsApp is click-to-chat only (no API, no automatic sending). No online payment gateway: payments are recorded manually.
- v1 is owner-only; `business_members` roles (manager/staff) are schema-ready, with no invite UI.
- Supabase Auth email delivery/templates are not configured by this repo.
