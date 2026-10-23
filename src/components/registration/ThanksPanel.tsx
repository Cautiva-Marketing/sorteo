/** Aviso final tras «Listo, muchas gracias»: el registro quedó guardado (FR-039). */
export function ThanksPanel() {
  return (
    <section
      role="status"
      className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-paper px-4 py-8 text-center"
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
        <circle cx="12" cy="12" r="10" />
        <path d="m7.5 12.5 3 3 6-7" />
      </svg>
      <h2 className="font-display text-2xl font-extrabold text-ink-900">
        ¡Gracias por registrarte!
      </h2>
      <p className="text-base text-ink-600">
        Tu registro quedó guardado. Te contactaremos al celular que registraste si resultas ganador.
        ¡Mucha suerte!
      </p>
    </section>
  );
}
