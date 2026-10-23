import { DiscardWinnerButton } from "@/components/admin/DiscardWinnerButton";
import { formatLimaDateTime } from "@/lib/format";
import type { WinnerRecord } from "@/types";

export interface WinnerHistoryProps {
  /** Ya ordenado por número de ganador, del más alto al más bajo. */
  records: WinnerRecord[];
}

/**
 * Historial de ganadores (FR-082, FR-083): número, premio, nombre, celular y empresa (si existen),
 * fecha en hora de Lima, quién realizó el giro y estado. Tras el borrado de datos solo quedan
 * premio, número, nombre, fecha y estado.
 */
export function WinnerHistory({ records }: WinnerHistoryProps) {
  // Tras el borrado definitivo los registros ya no traen celular ni empresa (FR-086).
  const hasPurgedRecords = records.some(
    (record) => record.phone === undefined && record.company === undefined,
  );
  return (
    <section aria-labelledby="winner-history-heading" className="flex flex-col gap-4">
      <h2 id="winner-history-heading" className="font-display text-xl font-bold text-ink-900">
        Historial de ganadores
      </h2>

      {hasPurgedRecords ? (
        <p className="text-base text-ink-600">
          Datos personales eliminados: solo se conservan el nombre, el número y el premio de los
          ganadores.
        </p>
      ) : null}

      {records.length === 0 ? (
        <p className="rounded-lg border border-line bg-paper px-4 py-8 text-center text-base text-ink-900">
          Aún no hay ganadores.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {records.map((record) => {
            const discarded = record.status === "discarded";
            return (
              <li
                key={record.key}
                className="flex flex-col gap-1 rounded-lg border border-line bg-paper px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-display text-lg font-bold text-ink-900">
                    {`#${record.number} · ${record.fullName}`}
                  </p>
                  <p
                    className={`text-sm font-semibold tracking-wide uppercase ${
                      discarded ? "text-danger-700" : "text-success-700"
                    }`}
                  >
                    {discarded ? "Descartado" : "Ganador"}
                  </p>
                </div>
                <p className="text-base text-ink-900">{`Premio: ${record.prizeName ?? "Sin premio"}`}</p>
                {record.phone !== undefined ? (
                  <p className="text-base text-ink-900">{`Celular: ${record.phone}`}</p>
                ) : null}
                {record.company !== undefined ? (
                  <p className="text-base text-ink-900">{`Empresa u ocupación: ${record.company}`}</p>
                ) : null}
                <p className="text-base text-ink-600">
                  {`${formatLimaDateTime(record.createdAt)} · Realizado por: ${record.createdByEmail}`}
                </p>
                {discarded && record.discardedAt ? (
                  <p className="text-base text-ink-600">
                    {`Descartado el ${formatLimaDateTime(record.discardedAt)}${
                      record.discardedByEmail ? ` por ${record.discardedByEmail}` : ""
                    }`}
                  </p>
                ) : null}
                {record.status === "active" && !record.legacy ? (
                  <div className="mt-2">
                    <DiscardWinnerButton spinId={record.key} number={record.number} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
