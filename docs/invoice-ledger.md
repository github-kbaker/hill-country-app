# Final Invoice Ledger & Stripe/PayPal Sandbox Services

Extends the existing Hill Country Appliance Repair app without rebuilding any
existing workflow. All amounts are **integer cents** end-to-end.

## Canonical status flow (additive)

```
app_repair_requests.status: ... → completed ──► app_invoices.status:
    draft → final_invoice_sent → invoice_paid        (or cancelled)
```

`final_invoice_sent` is the canonical status sitting between the job being
Completed and the invoice being Paid. Payouts stay on `on_hold` until the
invoice is paid in full (payout safeguard), then flip to `released`.

## Files

| File | Purpose |
|------|---------|
| `src/lib/invoice.ts` | `InvoiceService` + pure helpers (`calculateInvoiceTotals`, `nextInvoiceNumber`, status/payout transitions). Idempotent payment application keyed by `provider_event_id` (UNIQUE). |
| `src/lib/payments/provider.ts` | Provider abstraction; `centsToDollars` / `dollarsToCents` / `addCents` (currency-safe). |
| `src/lib/payments/stripe.ts` | Stripe Checkout session creation (test mode) + `normalizeStripeEvent`. |
| `src/lib/payments/paypal.ts` | PayPal sandbox OAuth2, v2 order create/capture, **webhook transmission signature verification** (RSA-SHA256 over `auth_algo\|transmission_id\|transmission_time\|webhook_id\|rawBody` with cert fetch + 5-min freshness), `normalizePayPalWebhookEvent`. |
| `src/lib/email.ts` | Branded green/black/white templates: `renderFinalInvoiceEmail`, `renderReceiptEmail`; separated customer transport (`RESEND_API_KEY` or `SCHEDULE_EMAIL_*`; business `EMAIL_*` is never used for customers; fail-closed). |
| `src/lib/admin-auth.ts` | Bearer/`x-admin-token` auth for admin APIs (reused pattern). |
| `src/app/api/admin/invoices/route.ts` | Authenticated: GET list/detail, POST create / send / add-payment / release-payout. |
| `src/app/api/invoices/[id]/checkout/route.ts` | Customer-facing Stripe Checkout session (defaults to balance; custom partial amount allowed). |
| `src/app/api/invoices/[id]/paypal/order/route.ts` | Customer-facing PayPal sandbox order. |
| `src/app/api/invoices/lookup/route.ts` | Public-safe invoice lookup by `HCAR-YYYY-NNNN` (never leaks email/notes/events). |
| `src/app/api/paypal/webhook/route.ts` | Verifies PayPal transmission signature, then applies `PAYMENT.CAPTURE.COMPLETED` idempotently. |
| `src/app/api/stripe/webhook/route.ts` | Legacy `app_payments` insert preserved; adds idempotent invoice-ledger update when `metadata.invoiceId` present. |
| `scripts/migrate-invoices.ts` | Idempotent schema migration (safe to re-run). |

## Schema (all additive)

- `app_invoices` — canonical final invoice (subtotal/discount/tax/total/paid/
  balance cents, status, due_date, payment_methods, payout_status,
  customer_name/email, sent_at, paid_at).
- `app_invoice_payments` — canonical payment ledger (merged with the frontend
  agent's table: their `method`/`reference`/`ledger_confirmed`/`recorded_at`/
  `confirmed_at`/`request_id` + canonical `provider`/`provider_event_id`
  (UNIQUE index) /`provider_reference`/`payment_method`/`currency`/
  `customer_email`/`customer_name`/`note`/`created_at`).
- `app_invoice_events` — idempotency/event trail (`event_key` UNIQUE):
  `invoice_created`, `invoice_sent`, `payment_completed`, `invoice_paid`,
  `payout_released`.
- `app_invoice_notifications` — separate invoice notification tracking
  (`final_invoice` / `receipt` / `partial_receipt`; status sent|failed|dry_run).
- `app_final_invoices` — frontend agent's UI projection table, kept in sync
  (backend-owned writes, keyed by invoice_number; never the source of truth).

## Idempotency

Stripe webhook events and PayPal capture events are keyed by
`provider_event_id` (UNIQUE). Redeliveries return `applied: false` and never
double-apply. Manual payments accept an optional client `idempotencyKey`.

## Emails

Customer invoice mail goes out through the **customer transport only**
(`RESEND_API_KEY` or `SCHEDULE_EMAIL_*`). Business `EMAIL_*` is internal-only.
Recipient always resolves from the stored lead email (fallback: email captured
at invoice creation) — request bodies can never redirect it. Email failure is
non-fatal: state persists, notification row marked `failed`, admin can resend.
Set `EMAIL_DRY_RUN=true` to record `dry_run` rows without sending.

## Testing

`bun test tests/` — 48 tests, all mocked (no network, no real email, no live
payments). Covers: Michonne QA fixture ($350 − $75 = $275,
recipient `mbaker789@gmail.com` display/test-only), currency safety, stable
numbering, status flow, partial/manual payments, idempotency, payout
safeguard, PayPal RSA signature verification (real keypair), Stripe/PayPal
normalization, transport separation. `npx tsc --noEmit` and `npm run build`
pass.

## Env vars

| Var | Purpose |
|-----|---------|
| `STRIPE_SECRET_KEY` | Stripe key — **test mode only** in this environment |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (test mode) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal sandbox REST app creds |
| `PAYPAL_WEBHOOK_ID` | PayPal sandbox webhook id (signature verification) |
| `PAYPAL_MODE` | `sandbox` (default) or `live` — leave sandbox |
| `NEXT_PUBLIC_BASE_URL` | Return/cancel URL base |
| `RESEND_API_KEY` | Customer email via Resend (preferred) |
| `SCHEDULE_EMAIL_HOST/USER/PASS/PORT` | Alternative dedicated customer SMTP |
| `EMAIL_HOST/USER/PASS/PORT` | Business/admin SMTP only (never customer) |
| `ADMIN_API_TOKEN` | Admin API auth (dev fallback `hc-admin-dev-token-2026`) |
| `EMAIL_DRY_RUN` | `true` = record `dry_run` notifications, never send |

## Limitations

- Providers are abstractions over the Stripe SDK and PayPal REST v2 with
  injectable fetch — all tests are mocked; live/sandbox calls require the
  creds above.
- PayPal signature verification fetches the cert from `paypal-cert-url` and
  enforces a 5-minute transmission freshness window (configurable).
- Invoice cancellation and refunds are not implemented (out of scope); the
  status vocabulary is ready for them.
- Overpayment is clamped to the remaining balance.
