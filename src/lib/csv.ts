import { formatLimaDateTime } from "@/lib/format";
import { formatPhoneCsv } from "@/lib/validation/phone";

/** Fila exportable: el celular viene en E.164 (o el valor antiguo de 9 dígitos). */
export interface CsvRow {
  fullName: string;
  phone: string;
  company: string;
  /** Interés en el CRM con Agente IA. */
  crmInterest: boolean;
  createdAt: Date;
  /** Premio del giro; `null` = «Sin premio» (ronda anterior a la feature 003). Solo importa si ganó. */
  prizeName?: string | null;
  /** Número de ganador; `null` si la persona no ganó. */
  winnerNumber?: number | null;
  /** `null` si la persona no ganó. */
  winnerStatus?: "active" | "discarded" | null;
}

/** Marca de orden de bytes UTF-8: hace que Excel lea correctamente tildes y ñ. */
const BOM = String.fromCharCode(0xfeff);
const HEADER = [
  "Nombres",
  "Celular (con código de país)",
  "Empresa u ocupación",
  "Interesado en CRM",
  "Fecha de registro",
  "Premio",
  "N.º de ganador",
  "Estado",
] as const;
const LINE_BREAK = "\r\n";

/** Texto que una hoja de cálculo interpretaría como fórmula (FR-018, SC-008). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Neutraliza la inyección de fórmulas: los textos que empiezan con `=`, `+`, `-`, `@`, tab o
 * retorno se prefijan con `'` para que la hoja de cálculo los trate como texto.
 */
export function neutralizeFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

/** Escapa una celda: encierra entre comillas dobles si hace falta y duplica las comillas. */
function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

const STATUS_LABELS = { active: "Ganador", discarded: "Descartado" } as const;

/** Celdas de ganador: premio, número y estado; vacías si la persona no ganó (FR-084). */
function winnerCells(row: CsvRow): string[] {
  const status = row.winnerStatus ?? null;
  if (status === null) {
    return ["", "", ""];
  }
  return [
    escapeCell(neutralizeFormula(row.prizeName ?? "Sin premio")),
    row.winnerNumber == null ? "" : String(row.winnerNumber),
    STATUS_LABELS[status],
  ];
}

/**
 * Serializa la lista de participantes a CSV (research D-011): BOM UTF-8, coma como separador,
 * columnas fijas y fecha de registro en hora de Lima, más premio, número y estado de quienes
 * ganaron. Los textos libres se neutralizan; el celular («51 987654321», validado) no lo necesita.
 * Sin filas devuelve solo el encabezado.
 */
export function toCsv(rows: ReadonlyArray<CsvRow>): string {
  const lines = [HEADER.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCell(neutralizeFormula(row.fullName)),
        escapeCell(formatPhoneCsv(row.phone)),
        escapeCell(neutralizeFormula(row.company)),
        row.crmInterest ? "Sí" : "No",
        escapeCell(formatLimaDateTime(row.createdAt)),
        ...winnerCells(row),
      ].join(","),
    );
  }
  return BOM + lines.join(LINE_BREAK);
}
