/** Esqueleto inmediato mientras el servidor prepara la sección del panel. */
export default function PanelLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="h-24 rounded-3xl border border-line bg-paper" />
      <div className="h-72 rounded-3xl border border-line bg-paper" />
    </div>
  );
}
