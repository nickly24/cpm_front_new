This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Student deletion workflow

The students tab uses server preview and durable deletion-job endpoints instead of
`/api/delete-user` for students. The API contract and fail-closed checks live in
`lib/admin/student-deletion.ts`. Preview counts must be known and nonnegative,
with no blockers and a live confirmation token. Changed or expired previews need
a fresh, explicit confirmation. Closing the dialog before starting makes no
mutation; closing it afterward leaves the server job running.

Progress is polled from the server every two seconds. Only a completed server job
can show 100%. Retrying uses the same job ID. A lost creation response is recovered
through the per-student job list; duplicate clicks reuse an idempotency key.
Minimal job references (no student names or confirmation tokens) are stored in
localStorage, scoped to the admin identity, to restore monitoring after reload.
The file count covers distinct known storage keys, including temporary and
historical references, not a verified physical object inventory. The confirmation
explains that active stores are purged while a minimal operational receipt remains;
backup/version retention is governed separately by storage policy.
Failed jobs remain visible. Completion refreshes the table without resetting its
filters; pagination only clamps when the current last page disappears.

Synthetic unit and DOM tests (no real API, database, or storage calls):

```bash
npm ci
npm test -- lib/admin/student-deletion.test.ts lib/admin/student-deletion-api.test.ts components/admin/users/admin-student-deletion.test.tsx
npx tsc --noEmit
```

## Production Go backend

The live UI at `https://cpm-lms.ru` uses the organization/division-aware Go BFF.
Set these public variables in the Timeweb application **before** `npm run build`:

```dotenv
NEXT_PUBLIC_CPM_BFF_ENABLED=1
NEXT_PUBLIC_CPM_BFF_BASE_URL=/bff
NEXT_PUBLIC_CPM_BFF_EXTERNAL_TESTS_ENABLED=1
NEXT_PUBLIC_CPM_S3_ORIGINS=https://s3.twcstorage.ru
```

Next.js embeds these variables in the client bundle at build time; changing only the
running process environment does not update an existing bundle. Rebuild after changing
an endpoint. Requests include the BFF session cookie and the existing context headers;
they do not forward browser bearer tokens. The HTTPS UI and BFF share the `cpm-lms.ru`
site, with exact CORS origins configured on BFF and Secure/HttpOnly/SameSite=Strict cookies.
The temporary `twc1.net` preview hostname is a different site and is not an authenticated
production entry point. Use `https://cpm-lms.ru` to verify login.

For the local contour, keep `NEXT_PUBLIC_CPM_BFF_DEV=1` and base URL `/bff`.
Development rewrite/CSP are enabled only by the development Next.js server. Production uses
`.next` and a loopback proxy carried over SSH to the backend.
The original `BFF_DEV` export is retained as an adapter compatibility name; production
uses the Go BFF unconditionally. Production always uses
`/bff/` on the website origin. Next forwards requests to a loopback SSH transport; the public browser no longer connects directly to the backend. Production ignores a stale `NEXT_PUBLIC_CPM_BFF_BASE_URL`.
The BFF flags remain compatible only for development and tests.

Homework PDF URLs use the actual external HTTPS S3 endpoint. Only configured storage origins
are accepted; local MinIO is a development default. Upload requests do not carry BFF cookies.

### Production SSH transport

`npm start` runs `server/start.cjs`, establishes the pinned SSH connection, then starts the standard Next server. The hosting start command must first create `/tmp/cpm-bff-transport.key` with mode 0600 from the separately supplied deployment key. Never put that command or key in this public repository. Existing hosting environment variables do not need changes.

Public transport addresses and the SSH host fingerprint are fixed in `server/tunnel-config.json`. On AdminVPS the dedicated user accepts only the frontend server IP and loopback, can forward only to `127.0.0.1:80`, and cannot open shell sessions, other destination ports, reverse tunnels, agent forwarding or a PTY. BFF retains all existing authentication, context and origin checks. The HTTP hop is entirely inside the encrypted channel and server loopback.

On SSH disconnect the transport reconnects automatically and closes affected streams; it never retries or replays HTTP requests. Production browser cookies are now host-only on the website domain, so users must sign in again after cutover. Stored application data is unchanged.

Validate with `node --test server/ssh-tunnel.test.cjs` and the production BFF configuration tests. Before changing the transport host, re-pin its verified SSH host key and update the source-IP restriction.
