# EWUCSC Portal — Server

Express/MongoDB API for the EWU Cyber Security Club public content and approved-member portal.

## Stack

- Node.js 22
- Express 5
- MongoDB
- Firebase Admin SDK
- JWT
- Helmet
- CORS

## Security model

Firebase proves identity. MongoDB stores membership/roles. The API issues its own JWT **only after** membership requirements are satisfied.

New-member flow:

```text
Student ID
→ @std.ewubd.edu Firebase account
→ email verification
→ approvalStatus: pending
→ Admin approval
→ backend JWT
→ protected portal APIs
```

New users never receive a backend JWT during registration.

Existing legacy users without an `approvalStatus` are treated as approved during migration so current staff accounts are not locked out.

## Roles

- `admin`
- `executive`
- `sub-executive`
- `member`

Authorization is checked against the current MongoDB user record on protected requests, so suspending/rejecting an account invalidates access even when an older JWT still exists.

## Membership states

- `pending`
- `approved`
- `rejected`
- `suspended`

## Main APIs

### Authentication / membership

- `POST /api/users` — register verified Firebase identity as pending member
- `POST /api/login` — issue JWT only to eligible approved account
- `GET /api/profile`
- `GET /api/dashboard/overview`
- `GET /api/leaderboard`

Admin:

- `GET /api/admin/users`
- `PATCH /api/admin/users/:uid/approval`
- `PATCH /api/admin/users/:uid/role`

### CTF

Public tournament discovery:

- `GET /api/ctf/upcoming` — cached CTFtime feed

Approved-member challenge system:

- `GET /api/challenges`
- `POST /api/challenges/:id/submit`

Admin / Executive:

- `GET /api/challenges/admin/all`
- `POST /api/challenges/admin`
- `PATCH /api/challenges/admin/:id`

Flags are SHA-256 hashed before storage and are never returned by public/member challenge projections. A member can receive points for a challenge only once.

### Homework

Members:

- `GET /api/homeworks`
- `POST /api/homeworks/:id/submit`

Admin / Executive:

- `GET /api/homeworks/admin/all`
- `POST /api/homeworks/admin`
- `PATCH /api/homeworks/admin/:id`

Admin / Executive / Sub-Executive:

- `GET /api/homeworks/admin/submissions`
- `PATCH /api/homeworks/admin/submissions/:id`

### Announcements and blogs

Public:

- `GET /api/content/announcements`
- `GET /api/content/blogs`
- `GET /api/content/blogs/:slug`

Admin / Executive:

- `GET /api/content/:type/admin/all`
- `POST /api/content/:type/admin`
- `PATCH /api/content/:type/admin/:id`

Supported types are `announcements` and `blogs`.

## CTFtime

The server fetches upcoming events from CTFtime and caches them for 30 minutes. The client never needs to scrape CTFtime directly.

## Environment

Copy `.env.example`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=
JWT_SECRET=

FIREBASE_PROJECT_ID=smart-deals-37b05

CLIENT_URL=http://localhost:5173
LIVE_CLIENT_URL=
ALLOWED_ORIGINS=
```

### Firebase token verification

The server does not need a Firebase service-account private key for its current authentication flow.

The client signs in with Firebase and sends its Firebase ID token to the API. The API verifies that JWT against Google's published Firebase signing certificates and validates the expected project ID, issuer, audience, timestamps and subject.

The current project defaults to `smart-deals-37b05`; `FIREBASE_PROJECT_ID` can override it for another Firebase project.

No `serviceAccountKey.json`, `FIREBASE_PRIVATE_KEY`, or `FIREBASE_CLIENT_EMAIL` is required for token verification.

## Health check

```text
GET /api/health
```

Returns 200 when MongoDB is reachable.

## Run locally

```bash
npm ci
npm run dev
```

Production:

```bash
npm start
```

## Verification

```bash
npm run check:syntax
npm test
```

GitHub Actions runs syntax checks and Node tests.

Current tests cover EWU Student-ID/email normalization and flag hashing behavior.

## Production hosting

The API is designed for a normal Node host such as Render or Railway.

Recommended final URL:

```text
https://api.ewucsc.org
```

Allowed browser origins should include only deployed EWUCSC client domains, for example:

```text
https://ewucsc.org
https://portal.ewucsc.org
https://resources.ewucsc.org
```

Do not merge/deploy a frontend that expects these new APIs until the corresponding server release is reachable.


## Deployment recovery

The current `main` branch includes the empty-database auth recovery and bootstrap-admin flow. A fresh production deployment should be triggered after any Vercel build-rate-limit window clears.
