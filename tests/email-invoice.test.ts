import { describe, expect, test, afterEach } from 'bun:test';
import {
  renderFinalInvoiceEmail,
  renderReceiptEmail,
  sendEmail,
  createCustomerTransport,
  createEmailTransport,
  createResendTransport,
} from '../src/lib/email';

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('invoice email renderers (branded green/black/white)', () => {
  const base = {
    customerName: 'Michonne',
    invoiceNumber: 'HCAR-2026-0001',
    totalCents: 35000,
    paidCents: 7500,
    balanceCents: 27500,
    dueDate: '2026-08-15',
  };

  test('final invoice shows number, total, paid, and balance in $', () => {
    const mail = renderFinalInvoiceEmail(base);
    expect(mail.subject).toContain('HCAR-2026-0001');
    expect(mail.html).toContain('$350.00');
    expect(mail.html).toContain('$275.00');
    expect(mail.html).toContain('#2e7d32'); // brand green
    expect(mail.text).toContain('Balance due: $275.00');
  });

  test('HTML-escapes user content (no injection into markup)', () => {
    const mail = renderFinalInvoiceEmail({ ...base, customerName: '<script>alert(1)</script> & Friends' });
    expect(mail.html).not.toContain('<script>alert(1)</script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  test('receipt says paid in full when balance is zero', () => {
    const mail = renderReceiptEmail({ ...base, paidCents: 35000, balanceCents: 0 });
    expect(mail.html).toContain('Paid in full');
    expect(mail.subject).toContain('Receipt');
  });

  test('partial receipt states the remaining balance', () => {
    const mail = renderReceiptEmail({ ...base, paidCents: 7500, balanceCents: 27500 });
    expect(mail.html).toContain('Remaining balance: $275.00');
    expect(mail.subject).toContain('Receipt');
  });
});

describe('transport separation (business vs customer mail)', () => {
  test('customer transport FAILS CLOSED with business EMAIL_* only — business mail is never used for customers', async () => {
    process.env.EMAIL_HOST = 'smtp.business.example';
    process.env.EMAIL_USER = 'admin@business.example';
    process.env.EMAIL_PASS = 'secret';
    delete process.env.RESEND_API_KEY;
    delete process.env.SCHEDULE_EMAIL_HOST;
    delete process.env.SCHEDULE_EMAIL_USER;
    delete process.env.SCHEDULE_EMAIL_PASS;
    const customerTransport = createCustomerTransport();
    await expect(
      sendEmail(customerTransport, { to: 'mbaker789@gmail.com', subject: 'x', html: 'x', text: 'x' }),
    ).rejects.toThrow(/not configured/);
  });

  test('business transport works from EMAIL_* (no customer leakage)', () => {
    process.env.EMAIL_HOST = 'smtp.business.example';
    process.env.EMAIL_USER = 'admin@business.example';
    process.env.EMAIL_PASS = 'secret';
    const t = createEmailTransport();
    expect(t).toBeTruthy();
  });

  test('RESEND_API_KEY selects the Resend HTTP transport with base64 attachments', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    const originalFetch = globalThis.fetch;
    const captured: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = async (url: any, init?: any) => {
      captured.push({ url: String(url), init: init ?? {} });
      return { ok: true, status: 200, json: async () => ({ id: 'resend-msg-1' }) } as Response;
    };
    try {
      const t = createCustomerTransport();
      const result = await sendEmail(t, {
        from: 'Hill Country Appliance Repair <billing@hillcountryappliancerepair.com>',
        to: 'mbaker789@gmail.com',
        subject: 'Final Invoice',
        html: '<p>Hi</p>',
        text: 'Hi',
        attachments: [{ filename: 'invoice.pdf', content: Buffer.from('PDFDATA') }],
      });
      expect(result.accepted).toBe(true);
      expect(result.messageId).toBe('resend-msg-1');
      expect(captured[0].url).toBe('https://api.resend.com/emails');
      const body = JSON.parse(String(captured[0].init?.body));
      expect(body.attachments[0].content).toBe(Buffer.from('PDFDATA').toString('base64')); // base64 of PDFDATA
      expect(captured[0].init?.headers).toMatchObject({ Authorization: 'Bearer re_test_key' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('SCHEDULE_EMAIL_* selects the dedicated customer SMTP transport', () => {
    delete process.env.RESEND_API_KEY;
    process.env.SCHEDULE_EMAIL_HOST = 'smtp.customer.example';
    process.env.SCHEDULE_EMAIL_USER = 'billing@customer.example';
    process.env.SCHEDULE_EMAIL_PASS = 'secret';
    const t = createCustomerTransport();
    expect(t).toBeTruthy();
  });
});
