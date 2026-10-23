import { COUNTRIES, getCountry, type Country, type CountryCode } from "@/lib/validation/countries";

const SEPARATORS = /[\s\-()]/g;
const MOBILE9 = /^9\d{8}$/;
const DIGITS = /^\d+$/;

/** Largo máximo del número local de un país (para detectar el prefijo pelado). */
function maxLocalLength(country: Country): number {
  return country.rule.kind === "mobile9" ? 9 : country.rule.max;
}

function matchesRule(country: Country, local: string): boolean {
  if (country.rule.kind === "mobile9") {
    return MOBILE9.test(local);
  }
  return local.length >= country.rule.min && local.length <= country.rule.max;
}

/**
 * Normaliza un celular al formato E.164 (`+{prefijo}{número}`) del país elegido, que es también
 * el ID del documento del participante (unicidad por número completo, FR-012/FR-095).
 *
 * Pasos (research D-302): (1) quita espacios, guiones y paréntesis; (2) con `+` el prefijo debe
 * ser el del país, y sin `+` el prefijo pelado solo se quita si el largo total es exacto; (3) el
 * resto son solo dígitos; (4) descarta el `0` troncal; (5) en Argentina descarta el `9` móvil;
 * (6) aplica la regla del país. Devuelve `null` si no es válido.
 */
export function normalizePhone(countryCode: CountryCode, input: string): string | null {
  const country = getCountry(countryCode);
  const compact = input.replace(SEPARATORS, "");

  let rest = compact;
  if (compact.startsWith("+")) {
    if (!compact.startsWith(`+${country.dial}`)) {
      return null;
    }
    rest = compact.slice(country.dial.length + 1);
  } else if (compact.startsWith(country.dial)) {
    const max = maxLocalLength(country);
    const total = compact.length;
    const lengths = [country.dial.length + max];
    if (country.code === "AR") {
      lengths.push(country.dial.length + 11);
    }
    if (lengths.includes(total)) {
      rest = compact.slice(country.dial.length);
    }
  }

  if (!DIGITS.test(rest)) {
    return null;
  }
  if (country.trunkZero && rest.startsWith("0")) {
    rest = rest.slice(1);
  }
  if (country.code === "AR" && rest.length === 11 && rest.startsWith("9")) {
    rest = rest.slice(1);
  }

  return matchesRule(country, rest) ? `+${country.dial}${rest}` : null;
}

/** Mensaje de error en español para un celular inválido del país elegido. */
export function phoneErrorMessage(countryCode: CountryCode): string {
  const country = getCountry(countryCode);
  if (country.code === "PE") {
    return "Ingresa un celular peruano de 9 dígitos que empiece con 9.";
  }
  if (country.code === "CL") {
    return "Ingresa un celular chileno de 9 dígitos que empiece con 9.";
  }
  const rule = country.rule;
  if (rule.kind === "length") {
    const digits =
      rule.min === rule.max ? `${rule.min} dígitos` : `${rule.min} a ${rule.max} dígitos`;
    return `Ingresa un celular válido de ${country.name} (${digits}).`;
  }
  return `Ingresa un celular válido de ${country.name}.`;
}

/**
 * Separa un celular guardado en prefijo y número local. Acepta E.164 o el valor antiguo de 9
 * dígitos (se interpreta como Perú). Los prefijos de 3 dígitos (`591`–`598`) se prueban antes que
 * los de 2. `null` si no se reconoce.
 */
function splitPhone(value: string): { dial: string; local: string } | null {
  if (/^\d{9}$/.test(value)) {
    return { dial: "51", local: value };
  }
  if (!/^\+\d+$/.test(value)) {
    return null;
  }
  const digits = value.slice(1);
  const dials = [...new Set(COUNTRIES.map((country) => country.dial))].sort(
    (a, b) => b.length - a.length,
  );
  for (const dial of dials) {
    if (digits.startsWith(dial) && digits.length > dial.length) {
      return { dial, local: digits.slice(dial.length) };
    }
  }
  return null;
}

/**
 * Muestra un celular con su prefijo: `+51 987 654 321` (9 dígitos en grupos de 3), `+56 9 1234 5678`
 * (Chile) o el número sin agrupar en los demás largos (`+57 3001234567`). Si no lo reconoce, lo
 * devuelve igual.
 */
export function formatPhoneDisplay(value: string): string {
  const parts = splitPhone(value);
  if (!parts) {
    return value;
  }
  const { dial, local } = parts;
  if (/^\d{9}$/.test(local)) {
    const grouped =
      dial === "56"
        ? local.replace(/^(\d)(\d{4})(\d{4})$/, "$1 $2 $3")
        : local.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");
    return `+${dial} ${grouped}`;
  }
  return `+${dial} ${local}`;
}

/** Celular para el CSV: `{prefijo} {número}` sin `+` (`51 987654321`). Si no lo reconoce, igual. */
export function formatPhoneCsv(value: string): string {
  const parts = splitPhone(value);
  return parts ? `${parts.dial} ${parts.local}` : value;
}

/** Solo los dígitos de un texto (para buscar por número sin importar el formato). */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Los 9 dígitos de un E.164 `+51…`; `null` si el prefijo no es el de Perú. */
export function peruNational(value: string): string | null {
  const match = /^\+51(\d{9})$/.exec(value);
  return match ? (match[1] ?? null) : null;
}
