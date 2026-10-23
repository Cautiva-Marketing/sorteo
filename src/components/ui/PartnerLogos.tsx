/**
 * Pie de las pantallas públicas: logos de Satelcom y Cautiva Marketing, discretos y centrados.
 * Los dos SVG traen sus propios colores y se ven bien sobre fondo claro.
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
      <div className="flex items-center justify-center gap-10">
        {/* Imágenes estáticas de /public: next/image no aporta optimización. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/satelcom.svg"
          alt="Satelcom"
          width={126}
          height={40}
          className="h-10 w-auto md:h-12"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cautivamarketing.svg"
          alt="Cautiva Marketing"
          width={154}
          height={40}
          className="h-10 w-auto md:h-12"
        />
      </div>
    </footer>
  );
}
