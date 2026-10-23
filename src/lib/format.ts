const LIMA_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Fecha y hora de Lima (UTC−5) con el formato `YYYY-MM-DD HH:mm:ss`. */
export function formatLimaDateTime(date: Date): string {
  const parts: Record<string, string> = {};
  for (const part of LIMA_FORMAT.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
