export interface LogoProps {
  /** `full`: ícono «ti» + «cautiva marketing»; `icon`: solo el ícono (centro del QR, ventanas). */
  variant?: "full" | "icon";
  /** Alto en píxeles de la variante `icon`. */
  size?: number;
  className?: string;
}

/** Proporción ancho/alto del ícono `public/icono-ti.webp` (400 × 350). */
const ICON_RATIO = 400 / 350;

/**
 * Logo de Cautiva Marketing en su versión para FONDO CLARO: ícono «ti» azul y logotipo con el
 * texto en negro. No usar sobre fondos oscuros (ahí el texto negro desaparecería).
 */
export function Logo({ variant = "full", size = 56, className }: LogoProps) {
  if (variant === "icon") {
    return (
      // Es una imagen estática de /public: next/image no aporta optimización.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/icono-ti.webp"
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
      aria-label="Cautiva Marketing"
      className={["inline-flex items-center gap-3", className].filter(Boolean).join(" ")}
    >
      {/* Imágenes estáticas de /public: next/image no aporta optimización. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icono-ti.webp"
        alt=""
        aria-hidden="true"
        width={50}
        height={44}
        fetchPriority="high"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-claro.svg"
        alt=""
        aria-hidden="true"
        width={146}
        height={44}
        fetchPriority="high"
      />
    </span>
  );
}
