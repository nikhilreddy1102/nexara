// src/lib/chatTime.ts
//
// All comparisons happen against Central Time specifically (this app's
// existing convention everywhere else -- schedule windows, analytics,
// etc.), NOT the browser's local timezone. A user viewing this from a
// different timezone should still see "Today"/"Yesterday" based on CT's
// calendar day, not their own -- otherwise two people looking at the same
// message could see different labels for it.

const CT_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function ctDateString(d: Date): string {
  return CT_DATE_FMT.format(d)
}

function isSameCTDay(a: Date, b: Date): boolean {
  return ctDateString(a) === ctDateString(b)
}

function ctYesterday(now: Date): Date {
  // Absolute-time subtraction (not calendar subtraction) -- Date math is
  // timezone-agnostic internally, only the FORMATTING below is CT-aware.
  // Using getTime() instead of setDate() avoids subtly depending on the
  // browser's own local calendar for figuring out "one day before."
  return new Date(now.getTime() - 24 * 60 * 60 * 1000)
}

/** For the sidebar conversation list: "3:45 PM" if today, "Yesterday" if
 * yesterday, otherwise a short date ("Aug 2" or "Aug 2, 2025" if not this
 * year). */
export function formatSidebarTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()

  if (isSameCTDay(date, now)) {
    return date.toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })
  }
  if (isSameCTDay(date, ctYesterday(now))) {
    return 'Yesterday'
  }
  const sameYear = ctDateString(date).slice(0, 4) === ctDateString(now).slice(0, 4)
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
}

/** For day-divider lines inside an open thread ("Today" / "Yesterday" /
 * "August 2, 2026"), same logic as above but full-length for a divider
 * rather than a compact sidebar label. */
export function formatDayDivider(iso: string): string {
  const date = new Date(iso)
  const now = new Date()

  if (isSameCTDay(date, now)) return 'Today'
  if (isSameCTDay(date, ctYesterday(now))) return 'Yesterday'
  return date.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' })
}

/** Per-message time label inside a thread -- always just the time, in CT,
 * since the day divider above each group already carries the date. */
export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })
}

/** True if `iso` falls on a different CT calendar day than `previousIso`
 * (or previousIso is undefined, i.e. this is the very first message) --
 * used to decide where to insert a day-divider line. */
export function isNewCTDay(iso: string, previousIso: string | undefined): boolean {
  if (!previousIso) return true
  return !isSameCTDay(new Date(iso), new Date(previousIso))
}