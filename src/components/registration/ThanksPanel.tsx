import { FacebookIcon } from "@/components/ui/icons";
import { SOCIAL_LINKS } from "@/lib/social-links";

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
      <div className="mt-2 flex flex-col items-center gap-2">
        <p className="text-base font-semibold text-ink-900">Síguenos en nuestras redes sociales</p>
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {SOCIAL_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-base font-semibold text-ink-900 hover:bg-paper-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
              >
                <FacebookIcon className="size-5 shrink-0" />
                {link.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
