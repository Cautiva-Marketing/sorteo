/**
 * Pie de las pantallas públicas: logos de Satelcom y Cautiva Marketing, discretos y centrados.
 * Los dos SVG traen sus propios colores y se ven bien sobre fondo claro. Miden 44 px de alto en
 * teléfonos (a 360 px caben en una sola fila: 140 + 169 + 16 px), 48 px desde `sm` y 60 px desde
 * `md`, ≈ 20-25 % más que antes (FR-110, research D-311).
 */
export function PartnerLogos({ className }: { className?: string }) {
  return (
    <footer
      className={["flex flex-col items-center gap-3 px-4 pt-6 pb-4", className]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-[0.65rem] font-semibold tracking-[0.3em] text-ink-500 uppercase">
        Con el respaldo de
      </p>
      <div className="flex items-center justify-center gap-x-4 sm:gap-x-10">
        {/* Imágenes estáticas de /public: next/image no aporta optimización. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/satelcom.svg"
          alt="Satelcom"
          width={189}
          height={60}
          className="h-11 w-auto sm:h-12 md:h-15"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cautivamarketing.svg"
          alt="Cautiva Marketing"
          width={231}
          height={60}
          className="h-11 w-auto sm:h-12 md:h-15"
        />
      </div>
    </footer>
  );
}
