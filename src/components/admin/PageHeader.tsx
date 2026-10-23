import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  /** Línea de apoyo bajo el título. */
  subtitle?: ReactNode;
  /** Acciones a la derecha (botones, enlaces). */
  actions?: ReactNode;
  /** Id del `<h1>` (para `aria-labelledby` de la sección de la página). */
  headingId?: string;
}

/** Tarjeta de encabezado de cada pantalla del panel: título, subtítulo y acciones. */
export function PageHeader({ title, subtitle, actions, headingId }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-3xl border border-line bg-paper px-6 py-4">
      <div className="min-w-0">
        <h1 id={headingId} className="font-display text-xl font-extrabold text-ink-900">
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
