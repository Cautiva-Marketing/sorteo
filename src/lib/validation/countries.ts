/**
 * Países de Sudamérica admitidos en el registro (FR-092, research D-301). Es una tabla de datos
 * puros: ni Firebase ni React. El número se valida con la regla del país elegido y se guarda en
 * E.164 (`+{dial}{local}`), que es también el ID del documento del participante.
 */

export type CountryCode =
  "PE" | "AR" | "BO" | "BR" | "CL" | "CO" | "EC" | "GY" | "PY" | "SR" | "UY" | "VE";

/** `mobile9`: exactamente 9 dígitos y el primero es `9`. `length`: rango de largo del número local. */
export type CountryRule = { kind: "mobile9" } | { kind: "length"; min: number; max: number };

export interface Country {
  code: CountryCode;
  name: string;
  /** Prefijo telefónico sin `+`. */
  dial: string;
  rule: CountryRule;
  /** `true` si se marca un `0` troncal que se descarta al normalizar. */
  trunkZero: boolean;
  /** Ejemplo de número local válido (solo dígitos). */
  example: string;
}

/** Perú primero (predeterminado) y luego los demás por nombre. */
export const COUNTRIES: readonly Country[] = [
  {
    code: "PE",
    name: "Perú",
    dial: "51",
    rule: { kind: "mobile9" },
    trunkZero: false,
    example: "987654321",
  },
  {
    code: "AR",
    name: "Argentina",
    dial: "54",
    rule: { kind: "length", min: 10, max: 10 },
    trunkZero: true,
    example: "1112345678",
  },
  {
    code: "BO",
    name: "Bolivia",
    dial: "591",
    rule: { kind: "length", min: 8, max: 8 },
    trunkZero: false,
    example: "71234567",
  },
  {
    code: "BR",
    name: "Brasil",
    dial: "55",
    rule: { kind: "length", min: 10, max: 11 },
    trunkZero: true,
    example: "11987654321",
  },
  {
    code: "CL",
    name: "Chile",
    dial: "56",
    rule: { kind: "mobile9" },
    trunkZero: false,
    example: "912345678",
  },
  {
    code: "CO",
    name: "Colombia",
    dial: "57",
    rule: { kind: "length", min: 10, max: 10 },
    trunkZero: false,
    example: "3001234567",
  },
  {
    code: "EC",
    name: "Ecuador",
    dial: "593",
    rule: { kind: "length", min: 9, max: 9 },
    trunkZero: true,
    example: "991234567",
  },
  {
    code: "GY",
    name: "Guyana",
    dial: "592",
    rule: { kind: "length", min: 7, max: 7 },
    trunkZero: false,
    example: "6091234",
  },
  {
    code: "PY",
    name: "Paraguay",
    dial: "595",
    rule: { kind: "length", min: 9, max: 9 },
    trunkZero: true,
    example: "981123456",
  },
  {
    code: "SR",
    name: "Surinam",
    dial: "597",
    rule: { kind: "length", min: 7, max: 7 },
    trunkZero: false,
    example: "7412345",
  },
  {
    code: "UY",
    name: "Uruguay",
    dial: "598",
    rule: { kind: "length", min: 8, max: 8 },
    trunkZero: true,
    example: "94123456",
  },
  {
    code: "VE",
    name: "Venezuela",
    dial: "58",
    rule: { kind: "length", min: 10, max: 10 },
    trunkZero: true,
    example: "4141234567",
  },
];

export const DEFAULT_COUNTRY: CountryCode = "PE";

/** Códigos en el orden de `COUNTRIES`, para `z.enum`. */
export const COUNTRY_CODES = COUNTRIES.map((country) => country.code) as unknown as readonly [
  CountryCode,
  ...CountryCode[],
];

export function getCountry(code: CountryCode): Country {
  const country = COUNTRIES.find((candidate) => candidate.code === code);
  if (!country) {
    throw new Error(`País desconocido: ${code}`);
  }
  return country;
}
