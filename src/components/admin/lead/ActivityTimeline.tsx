'use client';

import React from 'react';
import {
  Activity,
  CheckCircle2,
  Mail,
  MailCheck,
  MailX,
  CalendarClock,
  CalendarOff,
  CalendarCheck,
  DollarSign,
  Receipt,
  FileText,
  CircleDot,
} from 'lucide-react';
import type { ActivityRow } from '@/lib/lead-workflow';

function iconFor(action: string) {
  if (action === 'email_sent' || action === 'invoice_sent' || action === 'receipt_sent') return MailCheck;
  if (action === 'email_failed' || action === 'invoice_email_failed' || action === 'receipt_email_failed') return MailX;
  if (action.startsWith('email_dry_run') || action === 'invoice_email_dry_run' || action === 'receipt_email_dry_run') return Mail;
  if (action === 'scheduled' || action === 'marked_scheduled' || action === 'schedule_saved') return CalendarCheck;
  if (action === 'rescheduled') return CalendarClock;
  if (action === 'cancelled') return CalendarOff;
  if (action === 'completed') return CheckCircle2;
  if (action === 'payment_recorded' || action === 'invoice_paid') return DollarSign;
  if (action === 'receipt_sent' || action === 'receipt_email_dry_run') return Receipt;
  if (action === 'invoice_generated' || action === 'invoice_sent' || action === 'invoice_email_dry_run') return FileText;
  return CircleDot;
}

const TONE: Record<string, string> = {
  email_sent: 'bg-green-100 text-green-700',
  invoice_sent: 'bg-green-100 text-green-700',
  receipt_sent: 'bg-green-100 text-green-700',
  email_dry_run: 'bg-amber-100 text-amber-700',
  invoice_email_dry_run: 'bg-amber-100 text-amber-700',
  receipt_email_dry_run: 'bg-amber-100 text-amber-700',
  email_failed: 'bg-red-100 text-red-700',
  invoice_email_failed: 'bg-red-100 text-red-700',
  receipt_email_failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
  payment_recorded: 'bg-blue-100 text-blue-700',
  invoice_paid: 'bg-green-100 text-green-700',
  invoice_generated: 'bg-violet-100 text-violet-700',
};

export function ActivityTimeline({ activities }: { activities: ActivityRow[] }) {
  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 py-8 text-sm text-gray-400">
        <Activity className="mr-2 h-4 w-4" />
        No activity recorded yet
      </div>
    );
  }
  return (
    <ol className="space-y-0">
      {activities.map((a, i) => {
        const Icon = iconFor(a.action);
        const tone = TONE[a.action] ?? 'bg-gray-100 text-gray-600';
        const isLast = i === activities.length - 1;
        return (
          <li key={a.id} className="relative flex gap-3 pb-5">
            {!isLast && <span className="absolute left-[13px] top-7 h-full w-px bg-gray-200" aria-hidden="true" />}
            <span className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-gray-800">
                {a.action.replace(/_/g, ' ')}
              </p>
              {a.detail && <p className="mt-0.5 break-words text-xs leading-relaxed text-gray-500">{a.detail}</p>}
              <p className="mt-1 text-[11px] text-gray-400">
                {a.created_at ? new Date(a.created_at + (a.created_at.includes('T') ? '' : 'Z')).toLocaleString() : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
