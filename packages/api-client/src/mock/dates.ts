const pad = (n: number) => String(n).padStart(2, "0");

export const toIsoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const toIsoMonth = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;

export const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

/** First day of the month, `offset` months from `d`. */
export const monthStart = (d: Date, offset = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));

export const daysInMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
