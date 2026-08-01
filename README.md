This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Development

The shared live review environment is a full-stack runtime served from the primary review
checkout. Start the existing development commands in separate terminals:

```bash
# Terminal 1
cd backend
pnpm dev

# Terminal 2, from the repository root
pnpm dev
```

Keep [http://localhost:3000/](http://localhost:3000/) available with HMR for human review
and keep the API healthy at
[http://localhost:4000/health](http://localhost:4000/health). The review URL represents
only changes intentionally integrated into the primary checkout; an unmerged worker branch
is not part of it.

Development uses ports 3000/4000 and `backend/.wrangler/state`. Playwright and Cypress use
separate ports and D1 state and must never reuse the review runtime. See the complete
[live review environment contract](docs/SPEC.md#35-live-review-environment) for handoff,
health-check, ownership, restart, and test-isolation requirements.

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
- Secret `RESEND_API_KEY`: API key used by the API Worker to deliver learner magic links.
- API Worker vars `MAGIC_LINK_FROM` (a verified sender, such as `Vocab <login@example.com>`)
  and `APP_URL` (the public web origin). Never enable `MAGIC_LINK_DEV_MODE` in production;
  it intentionally returns the sign-in URL in the API response for local development.
- Variable `NEXT_PUBLIC_GA_MEASUREMENT_ID`: the GA4 ID beginning with `G-` (optional).
- Variable `API_ORIGIN`: the **api Worker's own origin** (required for live data). Never
  this Worker's `/api` path — the browser already calls `/api/*` on this origin and the
  forwarder in `app/api/[...path]/route.ts` relays it. Pointing it back here is what made
  sign-up answer 404. Once `vocab-api` has been deployed once, prefer the service binding:
  uncomment `API` in `wrangler.jsonc` and this variable stops being read.
- Variable `NEXT_PUBLIC_SITE_URL`: set this to the resulting `workers.dev` URL after the
  first deploy, then rerun the workflow so canonical and sitemap URLs are correct.

Run **Actions → Deploy web to Cloudflare → Run workflow**. The deployment log prints the
new `workers.dev` URL.
