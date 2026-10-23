import type { CSSProperties } from "react";

const DEFAULT_PIECES = 28;

/** Clases de token, alternadas: negro, blanco con borde fino y dorado. */
const PIECE_COLORS = ["bg-ink-900", "bg-paper border border-ink-300", "bg-gold-600"] as const;

/** Con `accent`, se suma el dorado claro como detalle (ventana del ganador del sorteo). */
const ACCENT_PIECE_COLORS = [...PIECE_COLORS, "bg-gold-300"] as const;

export interface ConfettiProps {
  /** Cantidad de piezas; por defecto 28 (ventana de bienvenida). */
  pieces?: number;
  /** Agrega piezas en dorado claro. */
  accent?: boolean;
}

/** Posición, retardo, duración y giro derivados del índice: determinista, sin `Math.random`. */
function pieceStyle(index: number): CSSProperties {
  return {
    left: `${(index * 37) % 100}%`,
    width: `${6 + (index % 3) * 3}px`,
    height: `${10 + (index % 4) * 3}px`,
    "--delay": `${((index * 53) % 100) / 100}s`,
    "--duration": `${2.6 + (index % 5) * 0.35}s`,
    "--spin": `${(index % 2 === 0 ? 1 : -1) * (360 + (index % 4) * 120)}deg`,
    "--drift": `${((index % 7) - 3) * 18}px`,
  } as CSSProperties;
}

/**
 * Confeti en negro, blanco y dorado (con dorado claro opcional) para las ventanas de bienvenida y de
 * ganador. Es CSS puro y se oculta cuando el dispositivo pide reducir el movimiento (FR-041,
 * FR-077). Se pinta sobre el fondo oscurecido del diálogo.
 */
export function Confetti({ pieces = DEFAULT_PIECES, accent = false }: ConfettiProps) {
  const colors = accent ? ACCENT_PIECE_COLORS : PIECE_COLORS;
  return (
    <div
      aria-hidden="true"
      data-confetti
      className="pointer-events-none fixed inset-0 overflow-hidden motion-reduce:hidden"
    >
      {Array.from({ length: pieces }, (_, index) => (
        <span
          key={index}
          className={`confetti-piece rounded-[1px] ${colors[index % colors.length]}`}
          style={pieceStyle(index)}
        />
      ))}
    </div>
  );
}
