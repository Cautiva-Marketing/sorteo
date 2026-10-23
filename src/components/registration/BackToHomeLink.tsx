import Link from "next/link";

/**
 * Enlace «← Volver a la pantalla principal» (FR-053): lleva a la pantalla del QR. Se muestra bajo
 * el botón de envío y bajo los avisos que reemplazan al formulario, para que nadie quede sin salida.
 */
export function BackToHomeLink() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      Volver a la pantalla principal
    </Link>
  );
}
