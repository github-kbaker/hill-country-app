'use client';

import React from 'react';
import { Bell, MailCheck, MailX, FlaskConical, Mail } from 'lucide-react';
import type { NotificationRow } from '@/lib/lead-workflow';

const TYPE_LABEL: Record<string, string> = {
  confirmation: 'Schedule Confirmation',
  updated_schedule: 'Updated Schedule',
  cancellation: 'Cancellation Notice',
  final_invoice: 'Final Invoice',
  receipt: 'Payment Receipt',
};

const STATUS_STYLE: Record<string, string> = {
  sent: 'bg-green-100 text-green-700',
  dry_run: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
};

export function NotificationPanel({ notifications }: { notifications: NotificationRow[] }) {
  if (notifications.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 py-6 text-sm text-gray-400">
        <Bell className="mr-2 h-4 w-4" />
        No notifications sent yet
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {notifications.map((n) => {
        const StatusIcon = n.status === 'dry_run' ? FlaskConical : n.status === 'failed' ? MailX : MailCheck;
        return (
          <li key={n.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <StatusIcon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-gray-800">{TYPE_LABEL[n.type] ?? n.type}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[n.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {n.status === 'dry_run' ? 'dry run (not sent)' : n.status}
                </span>
              </div>
              {n.recipient_email && <p className="mt-0.5 text-xs text-gray-500">to {n.recipient_email}</p>}
              {n.error && <p className="mt-0.5 text-xs text-red-500">{n.error}</p>}
              {n.sent_at && <p className="mt-0.5 text-[11px] text-gray-400">{new Date(n.sent_at + (n.sent_at.includes('T') ? '' : 'Z')).toLocaleString()}</p>}
            </div>
            {n.status === 'dry_run' && (
              <span className="mt-0.5 hidden shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600 sm:flex">
                <Mail className="h-3 w-3" /> simulated
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
