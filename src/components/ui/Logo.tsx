export interface LogoProps {
  /** `full`: logotipo «Creando Valor»; `icon`: solo el triángulo (centro del QR, buje de la ruleta). */
  variant?: "full" | "icon";
  /** Alto en píxeles del logo. */
  size?: number;
  className?: string;
}

/** Proporción ancho/alto de `public/creandovalor.svg` (408.72 × 134.9). */
const FULL_RATIO = 408.72 / 134.9;
/** Proporción ancho/alto de `public/creandovalor-isotipo.svg` (65.25 × 58.38). */
const ICON_RATIO = 65.25 / 58.38;

/**
 * Logo de Creando Valor para FONDO CLARO (el texto del logotipo es oscuro): no usar sobre fondos
 * oscuros. La variante `icon` es decorativa; la `full` se anuncia como «Creando Valor».
 */
export function Logo({ variant = "full", size = 56, className }: LogoProps) {
  if (variant === "icon") {
    return (
      // Es una imagen estática de /public: next/image no aporta optimización.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/creandovalor-isotipo.svg"
        alt=""
        aria-hidden="true"
        width={Math.round(size * ICON_RATIO)}
        height={size}
        className={className}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label="Creando Valor"
      className={["inline-flex items-center", className].filter(Boolean).join(" ")}
    >
      {/* Imagen estática de /public: next/image no aporta optimización. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/creandovalor.svg"
        alt=""
        aria-hidden="true"
        width={Math.round(size * FULL_RATIO)}
        height={size}
        fetchPriority="high"
      />
    </span>
  );
}
