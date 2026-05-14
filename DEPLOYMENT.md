# Deployment Guide - Hill Country Appliance Repair

This project is built with Next.js 15 (App Router) and can be deployed to Vercel, Netlify, or any Node.js environment.

## Recommended: Vercel Deployment

1. Push the code to a GitHub repository.
2. Connect the repository to Vercel.
3. Configure the environment variables (see below).
4. Vercel will automatically detect Next.js and deploy the site.

## Environment Variables

The following environment variables are required for full functionality:

### General
- `NEXT_PUBLIC_BASE_URL`: The full URL of the site (e.g., `https://hillcountryappliancerepair.com`). Used for SEO, sitemaps, and Stripe callbacks.

### Stripe Integration
- `STRIPE_SECRET_KEY`: Your Stripe secret key from the dashboard.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key.
- `STRIPE_WEBHOOK_SECRET`: The secret used to verify webhook signatures. Obtain this after setting up a webhook endpoint in Stripe pointing to `/api/stripe/webhook`.

### Email (Nodemailer)
- `EMAIL_HOST`: SMTP host (e.g., `smtp.gmail.com` or `mail.privateemail.com`).
- `EMAIL_PORT`: SMTP port (usually `587` or `465`).
- `EMAIL_USER`: The email address used to send notifications.
- `EMAIL_PASS`: The password or app-specific password for the email account.
- `ADMIN_EMAIL`: The destination email where repair requests will be sent.

### Database (Turso/SQLite)
- The current implementation uses a utility `src/lib/db.ts` that wraps the `team-db` CLI for data persistence in this environment.
- For a real production deployment, it is recommended to use the `@libsql/client` (Turso) directly.
- Required variables if using a real Turso client:
  - `TURSO_DATABASE_URL`: The URL of your Turso database.
  - `TURSO_AUTH_TOKEN`: The auth token for your Turso database.

## Post-Deployment Steps

1. **Configure Stripe Webhooks**:
   - Go to Stripe Dashboard > Developers > Webhooks.
   - Add an endpoint: `https://yourdomain.com/api/stripe/webhook`.
   - Select the `checkout.session.completed` event.
   - Copy the Signing Secret and set it as `STRIPE_WEBHOOK_SECRET` in your hosting provider.

2. **Verify Email**:
   - Test the "Schedule Repair" form to ensure emails are being sent to both the admin and the customer.

3. **Domain Setup**:
   - Ensure the target domain `hillcountryappliancerepair.com` is correctly pointed to your hosting provider.
