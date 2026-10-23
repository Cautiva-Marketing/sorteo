const DIACRITICS = /\p{M}/gu;

/** Minúsculas, sin tildes ni diéresis y con los espacios colapsados (búsqueda del panel, FR-017). */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Campos por los que se busca en el listado de participantes. */
export interface Searchable {
  fullName: string;
  /** Celular nacional de 9 dígitos. */
  phone: string;
  company: string;
}

/** Dígitos de la consulta sin el prefijo del país (`+51` o `51` delante de 9 dígitos). */
function phoneQueryDigits(normalizedQuery: string): string {
  const digits = normalizedQuery.replace(/\D/g, "");
  if (normalizedQuery.startsWith("+51") || (digits.length > 9 && digits.startsWith("51"))) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Filtra por nombre, celular (9 dígitos, también con `+51`) o empresa, sin distinguir mayúsculas
 * ni tildes. Una consulta vacía devuelve todas las filas.
 */
export function filterParticipants<T extends Searchable>(rows: readonly T[], query: string): T[] {
  const normalized = normalizeForSearch(query);
  if (normalized === "") {
    return [...rows];
  }
  const phoneQuery = phoneQueryDigits(normalized);
  return rows.filter(
    (row) =>
      normalizeForSearch(row.fullName).includes(normalized) ||
      normalizeForSearch(row.company).includes(normalized) ||
      (phoneQuery !== "" && row.phone.includes(phoneQuery)),
  );
}
