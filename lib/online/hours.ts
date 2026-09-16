// Business hours for online ordering (Malaysia time, UTC+8).
// Manual `outlet_settings.intake_paused` remains an override on top of this
// (for holidays / early closes). Edit SCHEDULE to change regular hours.
//
// Mon–Fri: 8:00am – 8:30pm · Sat: 8:00am – 4:00pm · Sun: closed

type DayHours = { open: number; close: number } | null; // minutes from midnight MYT

const SCHEDULE: DayHours[] = [
  null,                        // 0 Sunday — closed
  { open: 8 * 60, close: 20 * 60 + 30 }, // 1 Monday
  { open: 8 * 60, close: 20 * 60 + 30 }, // 2 Tuesday
  { open: 8 * 60, close: 20 * 60 + 30 }, // 3 Wednesday
  { open: 8 * 60, close: 20 * 60 + 30 }, // 4 Thursday
  { open: 8 * 60, close: 20 * 60 + 30 }, // 5 Friday
  { open: 8 * 60, close: 16 * 60 },      // 6 Saturday — closes 4pm
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function mytNow(): Date {
  return new Date(Date.now() + 8 * 3600_000); // UTC fields now read as MYT
}

function fmtTime(mins: number): string {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
}

// Whether online ordering is open right now, and if not, a customer-facing
// message telling them when it reopens.
export function storeStatus(): { open: boolean; message: string } {
  const now = mytNow();
  const day = now.getUTCDay();
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const today = SCHEDULE[day];

  if (today && mins >= today.open && mins < today.close) {
    return { open: true, message: '' };
  }

  // Closed, but opens later today
  if (today && mins < today.open) {
    return { open: false, message: `We’re closed right now — online ordering opens today at ${fmtTime(today.open)}.` };
  }

  // Otherwise find the next day that has hours
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const sched = SCHEDULE[d];
    if (sched) {
      const label = i === 1 ? 'tomorrow' : DAY_NAMES[d];
      return { open: false, message: `We’re closed right now — online ordering reopens ${label} at ${fmtTime(sched.open)}.` };
    }
  }

  return { open: false, message: 'We’re closed right now.' };
}
