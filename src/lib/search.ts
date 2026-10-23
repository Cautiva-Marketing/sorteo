import { phoneDigits } from "@/lib/validation/phone";

const DIACRITICS = /\p{M}/gu;

/** Minúsculas, sin tildes ni diéresis y con los espacios colapsados (búsqueda del panel, FR-017). */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Campos por los que se busca en el listado de participantes. */
export interface Searchable {
  fullName: string;
  /** Celular en E.164 (o el valor antiguo de 9 dígitos). */
  phone: string;
  company: string;
}

/**
 * Filtra por nombre, celular (los dígitos del número, con o sin prefijo de país) o empresa, sin
 * distinguir mayúsculas ni tildes. Una consulta vacía devuelve todas las filas.
 */
export function filterParticipants<T extends Searchable>(rows: readonly T[], query: string): T[] {
  const normalized = normalizeForSearch(query);
  if (normalized === "") {
    return [...rows];
  }
  // Solo se busca por celular si la consulta tiene algún dígito: con "" todas las filas coincidirían.
  const phoneQuery = phoneDigits(normalized);
  return rows.filter(
    (row) =>
      normalizeForSearch(row.fullName).includes(normalized) ||
      normalizeForSearch(row.company).includes(normalized) ||
      (phoneQuery !== "" && phoneDigits(row.phone).includes(phoneQuery)),
  );
}
