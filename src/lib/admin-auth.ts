/**
 * Server-side authentication for admin API routes.
 *
 * Production: set ADMIN_API_TOKEN and call the API with
 * `Authorization: Bearer <token>` or `x-admin-token: <token>`.
 *
 * Dev fallback: when ADMIN_API_TOKEN is not set, the shared DEV_ADMIN_TOKEN is
 * accepted so the existing password-gated admin UI keeps working. The fallback
 * is intentionally public and must never be used in production.
 */

import { DEV_ADMIN_TOKEN } from '@/lib/admin-constants';

export function getAdminToken(): string {
  return process.env.ADMIN_API_TOKEN || DEV_ADMIN_TOKEN;
}

export function isUsingDevFallback(): boolean {
  return !process.env.ADMIN_API_TOKEN;
}

export function isAdminRequest(req: Request): boolean {
  const expected = getAdminToken();
  const authHeader = req.headers.get('authorization') ?? '';
  const xToken = req.headers.get('x-admin-token') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const valid = bearer === expected || xToken === expected;
  if (!valid && isUsingDevFallback()) {
    console.warn(
      '[admin-auth] ADMIN_API_TOKEN is not set; accepting the dev fallback token. Set ADMIN_API_TOKEN in production.',
    );
  }
  return valid;
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
