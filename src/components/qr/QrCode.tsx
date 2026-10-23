import { buildQr } from "@/lib/qr";

/** Zona de silencio alrededor del QR, en módulos (el estándar pide al menos 4). */
const QUIET_ZONE = 4;
/** Margen del ícono dentro de su recuadro, en módulos. */
const LOGO_PADDING = 0.6;

export interface QrCodeProps {
  /** Dirección absoluta que abre el QR. */
  url: string;
  className?: string;
}

/**
 * QR en SVG con el ícono «ti» al centro (Server Component: no suma JavaScript al cliente). Corrección
 * de errores H; el recuadro del ícono ocupa ≤ 20 % del lado y sus módulos no se dibujan. Los colores
 * salen de los tokens (`fill-paper`, `fill-ink-900`) para que siga el diseño y mantenga el contraste.
 */
export function QrCode({ url, className }: QrCodeProps) {
  const { size, path, logo } = buildQr(url);
  const total = size + QUIET_ZONE * 2;

  return (
    <svg
      role="img"
      aria-label="Código QR para registrarte en el sorteo"
      data-url={url}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${total} ${total}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={total} height={total} className="fill-paper" />
      <path d={path} className="fill-ink-900" />
      <rect x={logo.x} y={logo.y} width={logo.size} height={logo.size} className="fill-paper" />
      <image
        href="/icono-ti.webp"
        x={logo.x + LOGO_PADDING}
        y={logo.y + LOGO_PADDING}
        width={logo.size - LOGO_PADDING * 2}
        height={logo.size - LOGO_PADDING * 2}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
