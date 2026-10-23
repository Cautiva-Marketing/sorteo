import { describe, expect, it } from "vitest";
import { COUNTRIES, getCountry, type CountryCode } from "@/lib/validation/countries";
import {
  formatPhoneCsv,
  formatPhoneDisplay,
  normalizePhone,
  peruNational,
  phoneDigits,
  phoneErrorMessage,
} from "@/lib/validation/phone";

/** Ejemplos válidos del contrato (research D-301). */
const EXAMPLES: ReadonlyArray<readonly [CountryCode, string, string]> = [
  ["PE", "987654321", "+51987654321"],
  ["CL", "912345678", "+56912345678"],
  ["AR", "1112345678", "+541112345678"],
  ["BO", "71234567", "+59171234567"],
  ["BR", "11987654321", "+5511987654321"],
  ["CO", "3001234567", "+573001234567"],
  ["EC", "991234567", "+593991234567"],
  ["GY", "6091234", "+5926091234"],
  ["PY", "981123456", "+595981123456"],
  ["SR", "7412345", "+5977412345"],
  ["UY", "94123456", "+59894123456"],
  ["VE", "4141234567", "+584141234567"],
];

/** Un número local de largo incorrecto por país (uno de más dígitos que el máximo). */
const TOO_LONG: ReadonlyArray<readonly [CountryCode, string]> = [
  ["PE", "9876543210"],
  ["CL", "9123456789"],
  ["AR", "11123456789"],
  ["BO", "712345678"],
  ["BR", "119876543210"],
  ["CO", "30012345678"],
  ["EC", "9912345678"],
  ["GY", "60912345"],
  ["PY", "9811234567"],
  ["SR", "74123456"],
  ["UY", "941234567"],
  ["VE", "41412345678"],
];

describe("COUNTRIES", () => {
  it("lista los 12 países con Perú primero", () => {
    expect(COUNTRIES).toHaveLength(12);
    expect(COUNTRIES[0]?.code).toBe("PE");
    expect(getCountry("CL").dial).toBe("56");
  });
});

describe("normalizePhone", () => {
  it.each(EXAMPLES)("%s: acepta el ejemplo %s → %s", (country, local, e164) => {
    expect(normalizePhone(country, local)).toBe(e164);
  });

  it.each(TOO_LONG)("%s: rechaza un número de largo incorrecto (%s)", (country, local) => {
    expect(normalizePhone(country, local)).toBeNull();
  });

  it.each(EXAMPLES)("%s: rechaza un número demasiado corto", (country, local) => {
    expect(normalizePhone(country, local.slice(0, 4))).toBeNull();
  });

  it("Perú y Chile exigen 9 dígitos que empiecen con 9", () => {
    expect(normalizePhone("PE", "812345678")).toBeNull();
    expect(normalizePhone("CL", "812345678")).toBeNull();
    expect(normalizePhone("PE", "98765432")).toBeNull();
  });

  it.each([
    ["987 654 321"],
    ["987-654-321"],
    ["+51987654321"],
    ["51987654321"],
    ["(+51) 987 654 321"],
    ["  +51 987-654-321  "],
  ])("Perú: acepta %j y lo normaliza a +51987654321", (input) => {
    expect(normalizePhone("PE", input)).toBe("+51987654321");
  });

  it("acepta el prefijo + propio del país y rechaza el ajeno", () => {
    expect(normalizePhone("CL", "+56 9 1234 5678")).toBe("+56912345678");
    expect(normalizePhone("CL", "+51 987654321")).toBeNull();
    expect(normalizePhone("PE", "+52987654321")).toBeNull();
  });

  it("quita el prefijo pelado solo con el largo total exacto", () => {
    expect(normalizePhone("PE", "51987654321")).toBe("+51987654321");
    expect(normalizePhone("PE", "5198765432")).toBeNull();
    expect(normalizePhone("PE", "+5198765432")).toBeNull();
  });

  it("descarta el 0 troncal (Paraguay)", () => {
    expect(normalizePhone("PY", "0981 123 456")).toBe("+595981123456");
    expect(normalizePhone("PY", "0981123456")).toBe(normalizePhone("PY", "981123456"));
  });

  it("Argentina: descarta el 9 móvil y rechaza 11 dígitos que no empiezan con 9", () => {
    expect(normalizePhone("AR", "91112345678")).toBe("+541112345678");
    expect(normalizePhone("AR", "91112345678")).toBe(normalizePhone("AR", "1112345678"));
    expect(normalizePhone("AR", "541112345678")).toBe("+541112345678");
    expect(normalizePhone("AR", "5491112345678")).toBe("+541112345678");
    expect(normalizePhone("AR", "11123456789")).toBeNull();
  });

  it.each([["987654321a"], ["abc"], [""], ["   "]])("rechaza %j", (input) => {
    expect(normalizePhone("PE", input)).toBeNull();
  });
});

describe("phoneErrorMessage", () => {
  it("usa el mensaje específico de Perú y Chile", () => {
    expect(phoneErrorMessage("PE")).toBe(
      "Ingresa un celular peruano de 9 dígitos que empiece con 9.",
    );
    expect(phoneErrorMessage("CL")).toBe(
      "Ingresa un celular chileno de 9 dígitos que empiece con 9.",
    );
  });

  it("indica el largo exacto o el rango en el resto", () => {
    expect(phoneErrorMessage("CO")).toBe("Ingresa un celular válido de Colombia (10 dígitos).");
    expect(phoneErrorMessage("BR")).toBe("Ingresa un celular válido de Brasil (10 a 11 dígitos).");
  });
});

describe("formatPhoneDisplay", () => {
  it.each([
    ["+51987654321", "+51 987 654 321"],
    ["987654321", "+51 987 654 321"],
    ["+573001234567", "+57 3001234567"],
    ["+59171234567", "+591 71234567"],
    ["+56912345678", "+56 9 1234 5678"],
  ])("formatea %j como %j", (input, expected) => {
    expect(formatPhoneDisplay(input)).toBe(expected);
  });

  it.each([["+99912345678"], ["abc"], [""]])("devuelve %j tal cual", (input) => {
    expect(formatPhoneDisplay(input)).toBe(input);
  });
});

describe("formatPhoneCsv", () => {
  it.each([
    ["+51987654321", "51 987654321"],
    ["987654321", "51 987654321"],
    ["+56912345678", "56 912345678"],
    ["+59171234567", "591 71234567"],
    ["abc", "abc"],
  ])("formatea %j como %j", (input, expected) => {
    expect(formatPhoneCsv(input)).toBe(expected);
  });
});

describe("phoneDigits", () => {
  it("devuelve solo los dígitos", () => {
    expect(phoneDigits("+51 987-654 321")).toBe("51987654321");
    expect(phoneDigits("María")).toBe("");
  });
});

describe("peruNational", () => {
  it("devuelve los 9 dígitos de un +51 y null si el prefijo es otro", () => {
    expect(peruNational("+51987654321")).toBe("987654321");
    expect(peruNational("+56912345678")).toBeNull();
  });
});
