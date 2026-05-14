import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const requests = query('SELECT * FROM app_repair_requests ORDER BY created_at DESC');
    const payments = query('SELECT * FROM app_payments ORDER BY created_at DESC');

    return NextResponse.json({
      requests,
      payments
    });
  } catch (error: any) {
    console.error('Admin Data API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
