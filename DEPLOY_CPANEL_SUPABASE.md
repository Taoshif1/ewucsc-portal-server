# EWUCSC cPanel + Supabase deployment

## Production topology

- `https://ewucsc.com` — main React website
- `https://portal.ewucsc.com` — login/register/member portal
- `https://resources.ewucsc.com` — resources/technical hub
- `https://api.ewucsc.com` — Node.js/Express API
- Supabase — persistent data + file storage over HTTPS

The API talks to Supabase over HTTPS/443, so it does not depend on MongoDB TCP/27017.

## Supabase

The dedicated EWUCSC Supabase project has been created in `Taoshif1's Org` (project ref `xpynuvsdbfdtanjlnizl`, Mumbai region) and `supabase/schema.sql` has been applied.

Use a server-side Secret key only in the Node app:

```env
NODE_ENV=production
SUPABASE_URL=https://xpynuvsdbfdtanjlnizl.supabase.co
SUPABASE_SECRET_KEY=PASTE_THE_SERVER_ONLY_SECRET_KEY_DIRECTLY_IN_CPANEL
SUPABASE_PUBLIC_BUCKET=ewucsc-public
SUPABASE_PRIVATE_BUCKET=ewucsc-private

JWT_SECRET=YOUR_EXISTING_LONG_SECRET
FIREBASE_PROJECT_ID=smart-deals-37b05

CLIENT_URL=https://ewucsc.com
LIVE_CLIENT_URL=https://portal.ewucsc.com
ALLOWED_ORIGINS=https://ewucsc.com,https://www.ewucsc.com,https://portal.ewucsc.com,https://resources.ewucsc.com
```

Never place the Supabase Secret key in the React client.

## Migrate the old MongoDB database

Run this on a machine where Atlas still works:

```bash
npm ci
npm run migrate:supabase
```

Keep `MONGO_URI` only on the migration machine. The script preserves Mongo ObjectIds and migrates GridFS files into Supabase Storage.

## cPanel backend

Use:

- Node.js 22
- Production mode
- Application root: `ewucsc-api`
- Application URL: `api.ewucsc.com`
- Startup file: `app_wrapper.cjs`

Upload a clean server copy. Do not keep old frontend `dist/`, `public/`, `dist.zip`, `.env`, `serviceAccountKey.json`, or old deployment files in the API root.

Install:

```bash
source /home/USERNAME/nodevenv/ewucsc-api/22/bin/activate
cd /home/USERNAME/ewucsc-api
npm ci --omit=dev
```

Restart the cPanel Node app.

Verify:

```text
https://api.ewucsc.com
https://api.ewucsc.com/api/health
```

Expected root response:

```text
EWUCSC Server Running
```

Expected health data contains:

```json
{
  "ok": true,
  "database": "supabase"
}
```

## Client

Build with:

```env
VITE_API_URL=https://api.ewucsc.com/api
VITE_AUTH_PORTAL_URL=https://portal.ewucsc.com
VITE_TECHNICAL_HUB_URL=https://resources.ewucsc.com
```

plus the existing Firebase web variables.

Run:

```bash
npm ci
npm run build
```

Deploy the same `dist` contents to the document roots for:

- `ewucsc.com`
- `portal.ewucsc.com`
- `resources.ewucsc.com`

Each document root needs:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

## Firebase

Authorized Domains:

- `ewucsc.com`
- `portal.ewucsc.com`
- `resources.ewucsc.com`

## Security

- Never expose `SUPABASE_SECRET_KEY`.
- Never commit `.env` or Firebase private keys.
- The backend is the only component with elevated Supabase access.
- Public and private file uploads use separate Supabase Storage buckets.
