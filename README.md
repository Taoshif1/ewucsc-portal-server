# EWUCSC Portal — Server

Express API for the East West University Cyber Security Club public website and approved-member portal.

## Production architecture

- Node.js 22 + Express 5
- Supabase over HTTPS for persistent data
- Supabase Storage for uploaded media and attachments
- Firebase Authentication for identity verification
- Backend-issued JWT for EWUCSC membership access
- Helmet + CORS

MongoDB is no longer required by the production API. The `mongodb` package remains temporarily because existing route/controller code uses `ObjectId`, and the migration script uses `MongoClient` to copy legacy Atlas data.

## Production domains

- `https://ewucsc.com`
- `https://portal.ewucsc.com`
- `https://resources.ewucsc.com`
- `https://api.ewucsc.com`

## Environment

```env
NODE_ENV=production

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PUBLIC_BUCKET=ewucsc-public
SUPABASE_PRIVATE_BUCKET=ewucsc-private

JWT_SECRET=
FIREBASE_PROJECT_ID=smart-deals-37b05

CLIENT_URL=https://ewucsc.com
LIVE_CLIENT_URL=https://portal.ewucsc.com
ALLOWED_ORIGINS=https://ewucsc.com,https://www.ewucsc.com,https://portal.ewucsc.com,https://resources.ewucsc.com
```

`SUPABASE_SECRET_KEY` is server-only. Never put it in the React client or commit it.

`MONGO_URI` is only needed temporarily when running the legacy migration from a machine that can still reach MongoDB Atlas.

## Database

Apply:

```text
supabase/schema.sql
```

The API keeps its existing Mongo-style controller interface through a Supabase-backed compatibility layer, so existing client API contracts and ObjectId-shaped IDs do not have to change.

## Migrate old MongoDB data

Run this locally, where Atlas connectivity still works:

```bash
npm ci
npm run migrate:supabase
```

The migration copies the EWUCSC collections and GridFS media into Supabase while preserving existing IDs.

## Health

```text
GET /api/health
```

A healthy response reports:

```json
{
  "ok": true,
  "service": "ewucsc-portal-server",
  "database": "supabase"
}
```

The Express process starts before the remote database warm-up, so a temporary Supabase outage does not make Passenger kill the entire API process.

## cPanel

Use:

- Node.js 22
- Production mode
- Application root: `ewucsc-api`
- Application URL: `api.ewucsc.com`
- Startup file: `app_wrapper.cjs`

See `DEPLOY_CPANEL_SUPABASE.md` for the full deployment checklist.

## Security

The current Firebase token-verification flow does not require `serviceAccountKey.json`. Do not upload a Firebase private-key file to the public web root or commit it.

Supabase's secret key is used only by this trusted backend. The `documents` table has RLS enabled and browser roles are not granted access.
