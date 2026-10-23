import { DiscardWinnerButton } from "@/components/admin/DiscardWinnerButton";
import { formatLimaDateTime } from "@/lib/format";
import type { WinnerRecord } from "@/types";

export interface WinnerHistoryProps {
  /** Ya ordenado por número de ganador, del más alto al más bajo. */
  records: WinnerRecord[];
}

/**
 * Historial de ganadores (FR-082, FR-083) en tarjetas: número, hora de Lima, nombre, premio,
 * celular y empresa (si existen), quién realizó el giro y estado. Tras el borrado de datos solo
 * quedan premio, número, nombre, fecha y estado.
 */
export function WinnerHistory({ records }: WinnerHistoryProps) {
  // Tras el borrado definitivo los registros ya no traen celular ni empresa (FR-086).
  const hasPurgedRecords = records.some(
    (record) => record.phone === undefined && record.company === undefined,
  );
  return (
    <section aria-label="Historial de ganadores" className="flex flex-col gap-4">
      {hasPurgedRecords ? (
        <p className="text-base text-ink-600">
          Datos personales eliminados: solo se conservan el nombre, el número y el premio de los
          ganadores.
        </p>
      ) : null}

      {records.length === 0 ? (
        <p className="rounded-3xl border border-line bg-paper px-4 py-10 text-center text-base text-ink-900">
          Aún no hay ganadores.
        </p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {records.map((record) => {
            const discarded = record.status === "discarded";
            return (
              <li
                key={record.key}
                className={`flex flex-col gap-3 rounded-3xl border bg-paper p-5 ${
                  discarded ? "border-line opacity-80" : "border-line"
                }`}
              >
                <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                  <p className="text-xs font-extrabold tracking-wide text-ink-900 uppercase">
                    {`Ganador #${record.number}`}
                  </p>
                  <p className="text-xs text-ink-500">
                    {formatLimaDateTime(record.createdAt).slice(11, 16)}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-display text-lg leading-tight font-extrabold break-words text-ink-900 uppercase">
                    {record.fullName}
                  </p>
                  <p className="text-sm font-semibold text-gold-700">
                    <span className="sr-only">Premio: </span>
                    {record.prizeName ?? "Sin premio"}
                  </p>
                </div>
                {record.phone !== undefined || record.company !== undefined ? (
                  <div className="flex flex-col gap-1.5 rounded-2xl bg-paper-soft px-3 py-2.5">
                    {record.phone !== undefined ? (
                      <p className="text-sm text-ink-900">
                        <span className="text-xs text-ink-500">Celular:</span> {record.phone}
                      </p>
                    ) : null}
                    {record.company !== undefined ? (
                      <p className="text-sm text-ink-900">
                        <span className="text-xs text-ink-500">Empresa u ocupación:</span>{" "}
                        {record.company}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <p
                  className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase ${
                    discarded ? "bg-danger-100 text-danger-700" : "bg-gold-100 text-gold-700"
                  }`}
                >
                  {discarded ? "Descartado" : "Ganador"}
                </p>
                <p className="text-xs text-ink-500">
                  {`${formatLimaDateTime(record.createdAt)} · Realizado por: ${record.createdByEmail}`}
                </p>
                {discarded && record.discardedAt ? (
                  <p className="text-xs text-ink-500">
                    {`Descartado el ${formatLimaDateTime(record.discardedAt)}${
                      record.discardedByEmail ? ` por ${record.discardedByEmail}` : ""
                    }`}
                  </p>
                ) : null}
                {record.status === "active" && !record.legacy ? (
                  <div className="mt-auto border-t border-line pt-3">
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
