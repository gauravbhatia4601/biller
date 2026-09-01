// UTC date helpers for the notification system. These mirror the
// module-private helpers in src/lib/recurring-invoices.ts (deliberately not
// refactored out of there — it is concurrency-sensitive). If you change the
// format contract here, change it there too.

export const parseDateString = (value?: string | null): Date | null => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export const formatDateString = (value: Date): string => value.toISOString().slice(0, 10)

/** UTC 'YYYY-MM-DD' — consistent with processInternal's todayDate. */
export const todayDateString = (): string => formatDateString(new Date())

export const isIsoDayString = (value?: string | null): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** Whole days between two YYYY-MM-DD strings (b - a). Never throws:
 *  calendar-impossible strings (e.g. '2026-00-00' pass a regex but not Date
 *  parsing) yield 0 — callers validate before using the result. */
export const diffDays = (a: string, b: string): number => {
  const from = parseDateString(a)
  const to = parseDateString(b)
  if (!from || !to) return 0
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
}