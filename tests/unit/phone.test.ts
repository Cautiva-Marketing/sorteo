import { describe, expect, it } from "vitest";
import { formatNationalPhone, normalizePhone, toNational } from "@/lib/validation/phone";

describe("normalizePhone", () => {
  it.each([
    ["987654321"],
    ["987 654 321"],
    ["987-654-321"],
    ["+51987654321"],
    ["51987654321"],
    ["(+51) 987 654 321"],
    ["  +51 987-654-321  "],
  ])("acepta %j y lo normaliza a +51987654321", (input) => {
    expect(normalizePhone(input)).toBe("+51987654321");
  });

  it.each([
    ["812345678", "no empieza con 9"],
    ["98765432", "8 dígitos"],
    ["9876543210", "10 dígitos"],
    ["abc", "letras"],
    ["", "vacío"],
    ["   ", "solo espacios"],
    ["+52987654321", "prefijo de otro país"],
    ["+5198765432", "prefijo con 8 dígitos"],
    ["5198765432", "prefijo sin + con 8 dígitos"],
    ["987654321a", "letra al final"],
  ])("rechaza %j (%s)", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("toNational", () => {
  it("devuelve los 9 dígitos del formato E.164", () => {
    expect(toNational("+51987654321")).toBe("987654321");
  });
});

describe("formatNationalPhone", () => {
  it.each([["+51987654321"], ["987654321"]])("agrupa %j como «987 654 321»", (input) => {
    expect(formatNationalPhone(input)).toBe("987 654 321");
  });

  it.each([["98765432"], ["9876543210"], ["abc"], [""]])(
    "devuelve %j tal cual si no son 9 dígitos",
    (input) => {
      expect(formatNationalPhone(input)).toBe(input);
    },
  );
});
