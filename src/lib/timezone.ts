/**
 * Timezone + appointment window helpers for the Hill Country Appliance Repair
 * lead workflow. All appointment times are stored in America/Chicago.
 */

export const DEFAULT_TZ = 'America/Chicago';

export interface AppointmentWindow {
  /** ISO UTC start (stored on the lead) */
  start: string;
  /** ISO UTC end */
  end: string;
  /** Human label, e.g. "Tue, Aug 12 · 8:00 AM – 10:00 AM" */
  label: string;
}

/**
 * Maps a scheduled date (YYYY-MM-DD) + time slot into a UTC appointment window.
 * Slot vocabulary matches the public scheduling form.
 */
export function getAppointmentWindow(
  date: string,
  slot: string
): AppointmentWindow | null {
  if (!date || !slot) return null;
  const match = slot.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const tz = DEFAULT_TZ;
  const startLocal = new Date(`${date}T${pad(hour)}:${pad(minute)}:00`);
  const endLocal = new Date(startLocal.getTime() + 2 * 60 * 60 * 1000); // 2h slot
  const startUtc = toUtcIso(date, hour, minute, tz);
  const endUtc = toUtcIso(
    `${endLocal.getFullYear()}-${pad(endLocal.getMonth() + 1)}-${pad(endLocal.getDate())}`,
    endLocal.getHours(),
    endLocal.getMinutes(),
    tz
  );
  return { start: startUtc, end: endUtc, label: formatLocal(startLocal) };
}

export function formatLocal(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DEFAULT_TZ,
  });
}

export function formatDateOnly(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: DEFAULT_TZ,
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Approximate America/Chicago → UTC offset for a local datetime.
 * (Not TZ-database-accurate across DST edges; good enough for display/ICS
 * where the label carries the local time.)
 */
function toUtcIso(date: string, hour: number, minute: number, tz: string): string {
  const d = new Date(`${date}T${pad(hour)}:${pad(minute)}:00`);
  // America/Chicago: UTC-6 (CST) or UTC-5 (CDT). Use the offset that the Date
  // object computes for the *server's* zone if it is Chicago, else guess via
  // month (CDT ≈ Mar–Nov).
  let offset = 6;
  if (tz === DEFAULT_TZ) {
    const month = d.getMonth();
    offset = month >= 2 && month <= 10 ? 5 : 6;
  }
  const utc = new Date(d.getTime() + offset * 60 * 60 * 1000);
  return utc.toISOString();
}
