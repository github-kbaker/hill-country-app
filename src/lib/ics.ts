/**
 * RFC-5545 iCalendar builder for appointment invites sent with schedule
 * confirmation/update emails. Pure function — no external deps.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO UTC
  end: string; // ISO UTC
  organizerName?: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail: string;
}

function dt(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function esc(s: string): string {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildAppointmentIcs(ev: IcsEvent): Buffer {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hill Country Appliance Repair//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${esc(ev.uid)}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(ev.start)}`,
    `DTEND:${dt(ev.end)}`,
    `SUMMARY:${esc(ev.summary)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
  lines.push(
    `ORGANIZER;CN=${esc(ev.organizerName ?? 'Hill Country Appliance Repair')}:mailto:${esc(ev.organizerEmail ?? 'service@hillcountryappliancerepair.com')}`,
    `ATTENDEE;CN=${esc(ev.attendeeName ?? 'Customer')};RSVP=TRUE:mailto:${esc(ev.attendeeEmail)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  );
  return Buffer.from(lines.join('\r\n'), 'utf-8');
}
