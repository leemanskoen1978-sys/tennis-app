/** Hourly HH:00 slots from 09:00 up to (excluding) endTime, e.g. '21:00'. */
export function generateSlots(endTime: string): string[] {
  const startHour = 9;
  const endHour = parseInt(endTime.slice(0, 2), 10);
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

/** Booking is not allowed on the day itself or in the past. */
export function isDateBookable(date: Date, now: Date = new Date()): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() > t.getTime();
}
