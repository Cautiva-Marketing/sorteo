import { encode } from "uqr";

/** Recuadro cuadrado central, en módulos, reservado al ícono. */
export interface QrLogoBox {
  x: number;
  y: number;
  size: number;
}

export interface QrData {
  /** Módulos por lado de la matriz (siempre impar). */
  size: number;
  /**
   * Ruta SVG de los módulos de datos oscuros: cada uno es un cuadrado de 1×1 cuyas esquinas se
   * redondean (radio ½) solo donde no tiene vecinos oscuros, así los módulos contiguos se ven
   * unidos y los aislados quedan como puntos. No incluye los patrones de posición ni el recuadro
   * del ícono.
   */
  path: string;
  /** Esquina superior izquierda de los tres patrones de posición (7×7), que se dibujan aparte. */
  finders: ReadonlyArray<{ x: number; y: number }>;
  /** Zona central sin módulos donde se dibuja el ícono. */
  logo: QrLogoBox;
  /** Matriz de módulos de datos oscuros (sin patrones de posición ni recuadro del ícono). */
  dark: boolean[][];
}

/** El recuadro del ícono ocupa como máximo el 20 % del lado (≈ 4 % del área; ECC H tolera 30 %). */
const LOGO_MAX_RATIO = 0.2;
/** Lado de un patrón de posición, en módulos. */
export const FINDER_SIZE = 7;
/** Radio de las esquinas redondeadas de un módulo, en módulos. */
const RADIUS = 0.5;

/** Ruta de un módulo en (x, y) con las esquinas indicadas redondeadas (tl, tr, br, bl). */
function modulePath(x: number, y: number, round: [boolean, boolean, boolean, boolean]): string {
  const [tl, tr, br, bl] = round;
  const r = RADIUS;
  const right = x + 1;
  const bottom = y + 1;
  let d = `M${x + (tl ? r : 0)} ${y}H${right - (tr ? r : 0)}`;
  if (tr) {
    d += `A${r} ${r} 0 0 1 ${right} ${y + r}`;
  }
  d += `V${bottom - (br ? r : 0)}`;
  if (br) {
    d += `A${r} ${r} 0 0 1 ${right - r} ${bottom}`;
  }
  d += `H${x + (bl ? r : 0)}`;
  if (bl) {
    d += `A${r} ${r} 0 0 1 ${x} ${bottom - r}`;
  }
  d += `V${y + (tl ? r : 0)}`;
  if (tl) {
    d += `A${r} ${r} 0 0 1 ${x + r} ${y}`;
  }
  return `${d}Z`;
}

/**
 * Genera la matriz de un QR con corrección de errores H y la convierte en una ruta SVG con
 * módulos redondeados. No incluye la zona de silencio (la agrega quien lo dibuja), ni los
 * módulos de los patrones de posición (se dibujan como «ojos» redondeados) ni los del recuadro
 * central, donde va el ícono.
 */
export function buildQr(text: string): QrData {
  const { data, size } = encode(text, { ecc: "H", border: 0 });

  // El lado del QR es impar (21 + 4·versión): con un recuadro impar queda perfectamente centrado.
  let logoSize = Math.floor(size * LOGO_MAX_RATIO);
  if (logoSize % 2 === 0) {
    logoSize -= 1;
  }
  const logoStart = (size - logoSize) / 2;
  const insideLogo = (x: number, y: number): boolean =>
    x >= logoStart && x < logoStart + logoSize && y >= logoStart && y < logoStart + logoSize;

  const finders = [
    { x: 0, y: 0 },
    { x: size - FINDER_SIZE, y: 0 },
    { x: 0, y: size - FINDER_SIZE },
  ];
  const insideFinder = (x: number, y: number): boolean =>
    finders.some(
      (finder) =>
        x >= finder.x && x < finder.x + FINDER_SIZE && y >= finder.y && y < finder.y + FINDER_SIZE,
    );

  const dark: boolean[][] = Array.from({ length: size }, (_, y) =>
    Array.from(
      { length: size },
      (_, x) => data[y]?.[x] === true && !insideFinder(x, y) && !insideLogo(x, y),
    ),
  );
  const isDark = (x: number, y: number): boolean => dark[y]?.[x] === true;

  let path = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isDark(x, y)) {
        continue;
      }
      const up = isDark(x, y - 1);
      const down = isDark(x, y + 1);
      const left = isDark(x - 1, y);
      const rightSide = isDark(x + 1, y);
      path += modulePath(x, y, [
        !up && !left,
        !up && !rightSide,
        !down && !rightSide,
        !down && !left,
      ]);
    }
  }

  return { size, path, finders, logo: { x: logoStart, y: logoStart, size: logoSize }, dark };
}
