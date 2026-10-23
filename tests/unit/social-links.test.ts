import { describe, expect, it } from "vitest";
import { SOCIAL_LINKS } from "@/lib/social-links";

describe("SOCIAL_LINKS", () => {
  it("tiene exactamente las dos páginas de Facebook", () => {
    expect(SOCIAL_LINKS).toEqual([
      { name: "Cautiva Marketing", href: "https://www.facebook.com/cautivamarketingperu" },
      { name: "Satelcom del Sur", href: "https://www.facebook.com/satelcomdelsur" },
    ]);
  });

  it("usa solo enlaces https", () => {
    for (const link of SOCIAL_LINKS) {
      expect(new URL(link.href).protocol).toBe("https:");
    }
  });
});
