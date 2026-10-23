/** Aviso que reemplaza al formulario cuando las inscripciones están cerradas (FR-028). */
export function ClosedNotice() {
  return (
    <section
      role="status"
      className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-8 text-center"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-14 text-ink-900"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <h2 className="font-display text-2xl font-bold text-ink-900">
        Las inscripciones están cerradas
      </h2>
      <p className="text-base text-ink-600">
        Ya no estamos recibiendo nuevos registros para este sorteo. ¡Gracias por tu interés!
      </p>
    </section>
  );
}
