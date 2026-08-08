'use client';

import React from 'react';
import {
  CalendarCheck,
  Save,
  Mail,
  Repeat,
  CalendarClock,
  CalendarX,
  BellOff,
  CheckCircle2,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  canMarkScheduled,
  canSaveSchedule,
  canSendConfirmation,
  canSendUpdatedSchedule,
  canReschedule,
  canCancel,
  canSendCancellation,
  canMarkCompleted,
  type Lead,
} from '@/lib/lead-workflow';

export type BusyAction =
  | 'mark_scheduled'
  | 'save_schedule'
  | 'confirmation'
  | 'updated_schedule'
  | 'reschedule'
  | 'cancel'
  | 'cancellation'
  | 'completed'
  | null;

interface ActionBarProps {
  lead: Lead;
  busy: BusyAction;
  onAction: (action: Exclude<BusyAction, null>) => void;
  onCall: () => void;
}

export function ActionBar({ lead, busy, onAction, onCall }: ActionBarProps) {
  const btn = 'h-10 px-3 text-[13px] font-medium shadow-sm';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canMarkScheduled(lead) && (
        <Button variant="outline" size="sm" className={btn} disabled={busy !== null} onClick={() => onAction('mark_scheduled')}>
          <CalendarCheck className="mr-1.5 h-4 w-4" /> Mark Scheduled
        </Button>
      )}
      {canSaveSchedule(lead) && (
        <Button size="sm" className={`${btn} bg-green-700 hover:bg-green-800`} disabled={busy !== null} onClick={() => onAction('save_schedule')}>
          <Save className="mr-1.5 h-4 w-4" /> Save Schedule
        </Button>
      )}
      {canSendConfirmation(lead) && (
        <Button variant="outline" size="sm" className={btn} disabled={busy !== null} onClick={() => onAction('confirmation')}>
          <Mail className="mr-1.5 h-4 w-4" /> Send Confirmation
        </Button>
      )}
      {canSendUpdatedSchedule(lead) && (
        <Button variant="outline" size="sm" className={btn} disabled={busy !== null} onClick={() => onAction('updated_schedule')}>
          <Repeat className="mr-1.5 h-4 w-4" /> Resend / Updated Schedule
        </Button>
      )}
      {canReschedule(lead) && (
        <Button variant="outline" size="sm" className={btn} disabled={busy !== null} onClick={() => onAction('reschedule')}>
          <CalendarClock className="mr-1.5 h-4 w-4" /> Reschedule
        </Button>
      )}
      {canMarkCompleted(lead) && (
        <Button variant="outline" size="sm" className={btn} disabled={busy !== null} onClick={() => onAction('completed')}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark Completed
        </Button>
      )}
      {canCancel(lead) && (
        <Button variant="outline" size="sm" className={`${btn} border-red-200 text-red-600 hover:bg-red-50`} disabled={busy !== null} onClick={() => onAction('cancel')}>
          <CalendarX className="mr-1.5 h-4 w-4" /> Cancel Appointment
        </Button>
      )}
      {canSendCancellation(lead) && (
        <Button variant="outline" size="sm" className={btn} disabled={busy !== null} onClick={() => onAction('cancellation')}>
          <BellOff className="mr-1.5 h-4 w-4" /> Send Cancellation Notice
        </Button>
      )}
      <span className="ml-auto hidden sm:inline-flex">
        <Button variant="outline" size="sm" className={`${btn} border-green-200 text-green-700 hover:bg-green-50`} onClick={onCall}>
          <Phone className="mr-1.5 h-4 w-4" /> Call 830-353-0845
        </Button>
      </span>
    </div>
  );
}

/** Sticky bottom bar for mobile: call + most important current action. */
export function MobileActionBar({ lead, busy, onAction, onCall }: ActionBarProps) {
  const primary: { label: string; action: Exclude<BusyAction, null> | null } = lead.status === 'completed'
    ? { label: 'Final invoice', action: null }
    : lead.status === 'cancelled'
      ? canSendCancellation(lead)
        ? { label: 'Send Cancellation Notice', action: 'cancellation' }
        : { label: 'Call us', action: null }
      : canSaveSchedule(lead)
        ? { label: 'Save Schedule', action: 'save_schedule' }
        : canMarkScheduled(lead)
          ? { label: 'Mark Scheduled', action: 'mark_scheduled' }
          : canSendConfirmation(lead)
            ? { label: 'Send Confirmation', action: 'confirmation' }
            : canMarkCompleted(lead)
              ? { label: 'Mark Completed', action: 'completed' }
              : { label: 'Call us', action: null };

  const primaryAction = primary.action;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur sm:hidden">
      <Button
        size="sm"
        className="h-11 flex-1 bg-green-700 text-sm hover:bg-green-800"
        onClick={primaryAction !== null ? () => onAction(primaryAction) : onCall}
        disabled={busy !== null}
      >
        <Phone className="mr-1.5 h-4 w-4" />
        {primary.label}
      </Button>
    </div>
  );
}
