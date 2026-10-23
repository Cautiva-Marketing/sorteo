import { describe, expect, it } from "vitest";
import { formatLimaDateTime } from "@/lib/format";

describe("formatLimaDateTime", () => {
  it("formatea un instante UTC en la hora de Lima (UTC-5) como YYYY-MM-DD HH:mm:ss", () => {
    expect(formatLimaDateTime(new Date("2026-10-21T20:15:09.000Z"))).toBe("2026-10-21 15:15:09");
  });

  it("cambia de día cuando la hora de Lima cae antes de la medianoche UTC", () => {
    expect(formatLimaDateTime(new Date("2026-01-01T03:30:00.000Z"))).toBe("2025-12-31 22:30:00");
  });

  it("muestra la medianoche como 00:00:00 y no como 24:00:00", () => {
    expect(formatLimaDateTime(new Date("2026-03-10T05:00:00.000Z"))).toBe("2026-03-10 00:00:00");
  });
});
