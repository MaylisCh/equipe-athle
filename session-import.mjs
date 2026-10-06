// One-time update from the detailed 2026–2027 workbook. Keep stable IDs so
// comments stay attached to their sessions. Future rest cards are archived,
// not deleted, so their records and any associated comments remain in storage.
export const detailedImportMarker = 'detailed_sessions_2026_2027';

export const legacyRestDates = {
  'Cycle 1-B-4':'2026-10-02', 'Cycle 1-B-6':'2026-10-04',
  'Cycle 1-D-4':'2026-10-09', 'Cycle 1-D-6':'2026-10-11',
  'Cycle 1-F-4':'2026-10-16', 'Cycle 1-F-6':'2026-10-18',
  'Cycle 1-H-1':'2026-10-20', 'Cycle 1-H-4':'2026-10-23', 'Cycle 1-H-6':'2026-10-25',
  'Cycle 2-B-6':'2026-11-01', 'Cycle 2-D-6':'2026-11-08',
  'Cycle 2-F-6':'2026-11-15', 'Cycle 2-H-6':'2026-11-22',
  'Cycle 3-B-4':'2026-11-27', 'Cycle 3-B-6':'2026-11-29',
  'Cycle 3-D-4':'2026-12-04', 'Cycle 3-D-6':'2026-12-06',
  'Cycle 3-F-4':'2026-12-11', 'Cycle 3-F-6':'2026-12-13',
  'Cycle 3-H-0':'2026-12-14', 'Cycle 3-H-3':'2026-12-17',
  'cycle compétition-B-5':'2026-12-26', 'cycle compétition-B-6':'2026-12-27',
  'cycle compétition-D-1':'2026-12-29', 'cycle compétition-D-3':'2026-12-31',
  'cycle compétition-D-5':'2027-01-02', 'cycle compétition-F-4':'2027-01-08'
};

export function nextWeekStartParis(now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=name=>parts.find(value=>value.type===name).value;
  const day=new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  const weekday=day.getUTCDay();
  day.setUTCDate(day.getUTCDate()+(weekday===1?7:(8-weekday)%7));
  return day.toISOString().slice(0,10);
}
