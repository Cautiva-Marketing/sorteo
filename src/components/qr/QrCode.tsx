import { buildQr, FINDER_SIZE } from "@/lib/qr";

/**
 * Zona de silencio dentro del SVG, en módulos. El estándar pide 4: los 2 restantes los aporta el
 * relleno blanco de la tarjeta que lo contiene (mayor que 2 módulos a los tamaños de proyección).
 */
const QUIET_ZONE = 2;
/** Margen del ícono dentro de su recuadro, en módulos. */
const LOGO_PADDING = 0.7;

export interface QrCodeProps {
  /** Dirección absoluta que abre el QR. */
  url: string;
  className?: string;
}

/** Anillo redondeado (rect exterior menos rect interior); se rellena con `evenodd`. */
function ringPath(x: number, y: number): string {
  const rect = (rx: number, ry: number, side: number, radius: number): string =>
    `M${rx + radius} ${ry}h${side - radius * 2}a${radius} ${radius} 0 0 1 ${radius} ${radius}v${side - radius * 2}a${radius} ${radius} 0 0 1 -${radius} ${radius}h-${side - radius * 2}a${radius} ${radius} 0 0 1 -${radius} -${radius}v-${side - radius * 2}a${radius} ${radius} 0 0 1 ${radius} -${radius}Z`;
  return `${rect(x, y, FINDER_SIZE, 2.4)}${rect(x + 1, y + 1, FINDER_SIZE - 2, 1.5)}`;
}

/**
 * QR en SVG con módulos y «ojos» redondeados y el triángulo de Creando Valor al centro (Server
 * Component: no suma JavaScript al cliente). Corrección de errores H; el recuadro del ícono ocupa
 * ≤ 20 % del lado y sus módulos no se dibujan. Los colores salen de los tokens (`fill-paper`,
 * `fill-ink-900`) para que siga el diseño y mantenga el contraste.
 */
export function QrCode({ url, className }: QrCodeProps) {
  const { size, path, finders, logo } = buildQr(url);
  const total = size + QUIET_ZONE * 2;

  return (
    <svg
      role="img"
      aria-label="Código QR para registrarte en el sorteo"
      data-url={url}
      data-quiet-zone={QUIET_ZONE}
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${total} ${total}`}
      shapeRendering="geometricPrecision"
      className={className}
    >
      <rect
        x={-QUIET_ZONE}
        y={-QUIET_ZONE}
        width={total}
        height={total}
        rx={QUIET_ZONE}
        className="fill-paper"
      />
      {/* El trazo del mismo color cierra las rendijas de antialiasing entre módulos contiguos. */}
      <path d={path} className="fill-ink-900 stroke-ink-900" strokeWidth="0.06" />
      {finders.map((finder) => (
        <g key={`${finder.x}-${finder.y}`} className="fill-ink-900">
          <path d={ringPath(finder.x, finder.y)} fillRule="evenodd" />
          <circle cx={finder.x + FINDER_SIZE / 2} cy={finder.y + FINDER_SIZE / 2} r={1.55} />
        </g>
      ))}
      <rect
        x={logo.x}
        y={logo.y}
        width={logo.size}
        height={logo.size}
        rx={1.2}
        className="fill-paper"
      />
      <image
        href="/creandovalor-isotipo.svg"
        x={logo.x + LOGO_PADDING}
        y={logo.y + LOGO_PADDING}
        width={logo.size - LOGO_PADDING * 2}
        height={logo.size - LOGO_PADDING * 2}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
