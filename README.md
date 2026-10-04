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
