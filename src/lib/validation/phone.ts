const SEPARATORS = /[\s\-()]/g;
const NATIONAL_MOBILE = /^9\d{8}$/;

/**
 * Normaliza un celular peruano al formato E.164 (`+51XXXXXXXXX`), que es también el ID del
 * documento del participante (unicidad, FR-012).
 *
 * Quita espacios, guiones y paréntesis; acepta el prefijo `+51` o `51` solo si el resto son 9
 * dígitos y exige que el número nacional cumpla `^9\d{8}$`. Devuelve `null` si no es válido.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(SEPARATORS, "");

  let national = compact;
  if (compact.startsWith("+51")) {
    national = compact.slice(3);
  } else if (compact.startsWith("51") && compact.length === 11) {
    national = compact.slice(2);
  }

  return NATIONAL_MOBILE.test(national) ? `+51${national}` : null;
}

/** Devuelve los 9 dígitos nacionales de un celular en formato E.164 (`+51XXXXXXXXX`). */
export function toNational(e164: string): string {
  return e164.replace(/^\+51/, "");
}

/**
 * Muestra un celular (E.164 o de 9 dígitos) agrupado como `XXX XXX XXX`. Si tras quitar el
 * prefijo `+51` no son exactamente 9 dígitos, devuelve el texto original sin cambios.
 */
export function formatNationalPhone(value: string): string {
  const national = toNational(value);
  return /^\d{9}$/.test(national) ? national.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3") : value;
}
