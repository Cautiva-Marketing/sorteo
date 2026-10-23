"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button, buttonClassName } from "@/components/ui/Button";
import { DownloadIcon } from "@/components/ui/icons";
import { TextField } from "@/components/ui/TextField";
import { formatLimaDateTime } from "@/lib/format";
import { filterParticipants } from "@/lib/search";
import type { ParticipantListItem } from "@/types";

/** Participantes por página (FR-016). */
export const PAGE_SIZE = 50;

export interface ParticipantsTableProps {
  rows: ParticipantListItem[];
  /** Total de participantes (agregación `count()` del servidor). */
  total: number;
}

const headerCell = "px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase";
const bodyCell = "px-4 py-3 text-sm text-ink-900";

/**
 * Tabla de participantes: recibe todas las filas del servidor y filtra (sin tildes ni
 * mayúsculas) y pagina en el navegador (research D-007).
 */
export function ParticipantsTable({ rows, total }: ParticipantsTableProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);

  const matches = useMemo(() => filterParticipants(rows, query), [rows, query]);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section aria-labelledby="participants-heading" className="flex flex-col gap-4">
      <PageHeader
        headingId="participants-heading"
        title="Participantes"
        subtitle={`Total de participantes: ${total}`}
        actions={
          <>
            <Button
              variant="secondary"
              loading={refreshing}
              onClick={() => startRefresh(() => router.refresh())}
            >
              {refreshing ? "Actualizando…" : "Actualizar"}
            </Button>
            {rows.length === 0 ? (
              <Button variant="secondary" disabled aria-describedby="export-help">
                <DownloadIcon />
                Exportar CSV
              </Button>
            ) : (
              <a
                href="/api/admin/participants/export"
                download
                aria-describedby="export-help"
                className={buttonClassName("secondary")}
              >
                <DownloadIcon />
                Exportar CSV
              </a>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-paper p-5">
        <p id="export-help" className="text-sm text-ink-600">
          {rows.length === 0
            ? "No hay datos para exportar"
            : "Exporta siempre la lista completa, aunque haya una búsqueda activa."}
        </p>
        <TextField
          label="Buscar por nombre, celular o empresa"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setRequestedPage(1);
          }}
        />
        <p role="status" aria-live="polite" className="text-base text-ink-600">
          {`Coincidencias: ${matches.length}`}
        </p>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-line bg-paper-soft px-4 py-8 text-center text-base text-ink-900">
            Aún no hay participantes
          </p>
        ) : matches.length === 0 ? (
          <p className="rounded-2xl border border-line bg-paper-soft px-4 py-8 text-center text-base text-ink-900">
            No hay resultados
          </p>
        ) : (
          // Región con desplazamiento horizontal: enfocable para que el teclado pueda recorrerla.
          <div
            role="region"
            aria-label="Listado de participantes"
            tabIndex={0}
            className="overflow-x-auto rounded-2xl border border-line bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700"
          >
            <table className="w-full min-w-xl border-collapse">
              <caption className="sr-only">
                Participantes registrados, del más reciente al más antiguo
              </caption>
              <thead className="border-b border-line">
                <tr>
                  <th scope="col" className={headerCell}>
                    Nombres
                  </th>
                  <th scope="col" className={headerCell}>
                    Celular
                  </th>
                  <th scope="col" className={headerCell}>
                    Empresa u ocupación
                  </th>
                  <th scope="col" className={headerCell}>
                    Fecha de registro
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.phone} className="border-b border-line last:border-b-0">
                    <th scope="row" className={`${bodyCell} text-left font-medium`}>
                      {row.fullName}
                    </th>
                    <td className={bodyCell}>{row.phone}</td>
                    <td className={bodyCell}>{row.company}</td>
                    <td className={`${bodyCell} whitespace-nowrap`}>
                      {formatLimaDateTime(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 ? (
          <nav
            aria-label="Paginación"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setRequestedPage(page - 1)}
            >
              Anterior
            </Button>
            <p className="text-base text-ink-900">{`Página ${page} de ${pageCount}`}</p>
            <Button
              variant="secondary"
              disabled={page >= pageCount}
              onClick={() => setRequestedPage(page + 1)}
            >
              Siguiente
            </Button>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
