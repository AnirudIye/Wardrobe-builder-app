// Local-date formatting. `Date.toISOString()` renders in UTC, which silently
// shifts the calendar day for anyone west of UTC during evening/night hours -
// use this instead anywhere a "what day is it for the user" string is needed.
export function localISODate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
