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
# Vocab Learning App

## Google Analytics

Create a Google Analytics 4 web data stream, then add its measurement ID to the web
Worker's build environment:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Analytics is disabled when the variable is absent or invalid, and admin pages are
excluded. In the GA data stream, keep **Enhanced measurement → Page views → Page changes
based on browser history events** enabled so client-side navigation is counted.

After deploying, open **Reports → Realtime** in Google Analytics and visit the deployed
site to verify data collection.

## Deploy the web Worker to Cloudflare

The GitHub Actions workflow in `.github/workflows/deploy-cloudflare.yml` builds the
Next.js app with OpenNext and deploys it as the `vocab-learning-app` Worker.

Add these repository settings before running it:

- Secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token with Workers Scripts edit access.
- Secret `CLOUDFLARE_ACCOUNT_ID`: the account ID shown in the Cloudflare dashboard.
- Secret `JWT_SECRET`: the same strong signing secret configured on the API Worker.
- Variable `NEXT_PUBLIC_GA_MEASUREMENT_ID`: the GA4 ID beginning with `G-` (optional).
- Variable `NEXT_PUBLIC_API_URL`: the production API origin (required for live data).
- Variable `NEXT_PUBLIC_SITE_URL`: set this to the resulting `workers.dev` URL after the
  first deploy, then rerun the workflow so canonical and sitemap URLs are correct.

Run **Actions → Deploy web to Cloudflare → Run workflow**. The deployment log prints the
new `workers.dev` URL.
