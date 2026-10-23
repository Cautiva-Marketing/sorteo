/**
 * Lógica pura de la ruleta (sin React, DOM ni Firebase): paleta sin vecinos iguales, ángulos de
 * parada, segmento bajo el puntero y tamaño de los nombres (research D-209 a D-211).
 *
 * Convención de ángulos (radianes): la rueda gira en sentido horario. Con rotación `θ`, el punto
 * de la rueda bajo el puntero (12 en punto) está en el ángulo de rueda `φ = (−θ) mod 2π`, medido
 * en sentido horario desde el inicio del segmento 0. El segmento `i` ocupa `[i·arc, (i+1)·arc)`
 * con `arc = 2π / count`.
 */

const TWO_PI = Math.PI * 2;

/** Tolerancia para que un ángulo que cae a una milmillonésima de un borde no cambie de segmento. */
const EDGE_EPSILON = 1e-9;

/** Nombres de los design tokens de color que usa la rueda (`--color-<token>` en globals.css). */
export type ColorToken = "wheel-purple" | "wheel-lavender" | "wheel-cyan" | "paper" | "ink-900";

export interface SegmentStyle {
  background: ColorToken;
  /** Color del texto con contraste AA sobre `background`. */
  text: ColorToken;
}

/** Morado, lavanda y celeste de la «A» del logo, en ciclo; dos vecinos nunca comparten fondo. */
export const PALETTE: ReadonlyArray<SegmentStyle> = [
  { background: "wheel-purple", text: "paper" },
  { background: "wheel-lavender", text: "paper" },
  { background: "wheel-cyan", text: "ink-900" },
];

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function backgroundOf(paletteIndex: number): ColorToken {
  return (PALETTE[paletteIndex] as SegmentStyle).background;
}

/**
 * Índice de paleta de cada segmento: `i % 3`. Si la unión último-primero repite color (solo con
 * `count % 3 == 1`), el último se reasigna a un color distinto del anterior y del primero. Con
 * `count = 1` la rueda es un disco único y con `count = 2` se usan los dos primeros (FR-067).
 */
export function segmentColorIndexes(count: number): number[] {
  const indexes = Array.from({ length: count }, (_, position) => position % PALETTE.length);
  if (count > 2) {
    const last = count - 1;
    const first = indexes[0] as number;
    if (backgroundOf(indexes[last] as number) === backgroundOf(first)) {
      const previous = backgroundOf(indexes[last - 1] as number);
      const replacement = PALETTE.findIndex(
        (style) => style.background !== previous && style.background !== backgroundOf(first),
      );
      indexes[last] = replacement;
    }
  }
  return indexes;
}

/** Segmento bajo el puntero para una rotación dada (`0..count−1`). */
export function indexAtPointer(rotation: number, count: number): number {
  const arc = TWO_PI / count;
  const wheelAngle = mod(-rotation, TWO_PI);
  return Math.floor(wheelAngle / arc + EDGE_EPSILON) % count;
}

export interface TargetRotationInput {
  winnerIndex: number;
  count: number;
  startRotation: number;
  /** Vueltas completas adicionales (6 a 8). */
  extraTurns: number;
  /** Desplazamiento respecto del centro del segmento, en fracción de arco (−0,25 a 0,25). */
  offsetFraction: number;
}

/**
 * Menor rotación `θ ≥ startRotation + extraTurns·2π` que deja el puntero sobre el segmento
 * ganador (en su centro más `offsetFraction` arcos). Con `|offsetFraction| ≤ 0,25` el puntero
 * nunca sale del segmento.
 */
export function targetRotation({
  winnerIndex,
  count,
  startRotation,
  extraTurns,
  offsetFraction,
}: TargetRotationInput): number {
  const arc = TWO_PI / count;
  const base = -(winnerIndex + 0.5 + offsetFraction) * arc;
  const minimum = startRotation + extraTurns * TWO_PI;
  const turns = Math.ceil((minimum - base) / TWO_PI);
  return base + turns * TWO_PI;
}

/** Tamaño mínimo legible de un nombre dentro del segmento (px). */
const MIN_FONT_SIZE = 7;
const MAX_FONT_SIZE = 14;
/** Fracción del radio a la que se mide el arco disponible para el texto. */
const LABEL_RADIUS_FACTOR = 0.6;

export interface LabelLayout {
  fontSize: number;
  /** `false` cuando el segmento es demasiado angosto: no se dibuja texto (el letrero lo suple). */
  showLabel: boolean;
  /** Con más de 20 segmentos solo se muestra el primer nombre. */
  firstNameOnly: boolean;
}

/** Tamaño de fuente y modo de nombre según la cantidad de segmentos y el radio de la rueda. */
export function labelLayout(count: number, radius: number): LabelLayout {
  const arcLength = (TWO_PI / count) * radius * LABEL_RADIUS_FACTOR;
  const fontSize = Math.min(MAX_FONT_SIZE, arcLength * 0.7);
  return { fontSize, showLabel: fontSize >= MIN_FONT_SIZE, firstNameOnly: count > 20 };
}

/** Abrevia un nombre para que quepa en `maxChars` caracteres (nunca los supera). */
export function abbreviate(name: string, maxChars: number, firstNameOnly: boolean): string {
  const text = firstNameOnly ? (name.trim().split(/\s+/)[0] ?? "") : name.trim();
  if (text.length <= maxChars) {
    return text;
  }
  if (maxChars <= 0) {
    return "";
  }
  return `${text.slice(0, maxChars - 1)}…`;
}

/** Cada cuántos segmentos se dibuja un pin en el aro (evita saturarlo con muchos participantes). */
export function pinStep(count: number): number {
  if (count <= 50) {
    return 1;
  }
  return count <= 100 ? 2 : 5;
}
