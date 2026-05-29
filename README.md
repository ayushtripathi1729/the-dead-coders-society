# The Dead Coders Society

Production-grade competitive programming championship platform built with Next.js 15, PostgreSQL, Prisma, Auth.js, TailwindCSS, Framer Motion, shadcn-style primitives, Recharts, Zod, and Cloudinary.

## Environment

Create `.env` from `.env.example`:

```env
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Use PostgreSQL only. In production, set `DATABASE_URL` to the pooled Neon connection string and `DIRECT_URL` to the direct connection string used by Prisma migrations.

## Local Setup

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

Open `http://localhost:3000`. The private admin route is `/controlroomadmin`. The first admin user is bootstrapped from `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`.

Generate the password hash with:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('replace-with-admin-password', 12).then(console.log)"
```

## Neon PostgreSQL

1. Create a Neon project.
2. Copy the pooled PostgreSQL connection string.
3. Set pooled `DATABASE_URL` and direct `DIRECT_URL` in `.env` and Vercel.
4. Run `npm run db:push` locally or from a deployment job.

## Vercel Deployment

1. Import the repository into Vercel.
2. Set all required environment variables.
3. Use the default Next.js build command: `npm run build`.
4. Set `NEXTAUTH_URL` to the production URL.
5. Keep `AUTH_SECRET` and `NEXTAUTH_SECRET` long, random, and private.

## Admin Capabilities

- Create, edit, and delete contests through protected admin API routes.
- Upload invite posters, contest banners, certificates, profile images, logos, and editorials to Cloudinary.
- Import standings from CSV, pasted tables, copied HTML table text, and Codeforces public contests.
- Correct ranks, scores, penalties, solved counts, first solves, names, usernames, and years.

## Scoring

```ts
finalScore = (contestPoints - penalty) + bonusPoints
```

Bonus points:

- 1st: +500
- 2nd: +250
- 3rd: +125
- 4th: +50
- 5th: +25

Society ELO is recalculated from placement, solved count, field size, final score, podium pressure, and first solves.
