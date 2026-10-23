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
  /** Ruta SVG de los módulos oscuros: un tramo `M{x} {y}h{n}v1h-{n}z` por racha horizontal. */
  path: string;
  /** Zona central sin módulos donde se dibuja el ícono. */
  logo: QrLogoBox;
}

/** El recuadro del ícono ocupa como máximo el 20 % del lado (≈ 4 % del área; ECC H tolera 30 %). */
const LOGO_MAX_RATIO = 0.2;

/**
 * Genera la matriz de un QR con corrección de errores H y la convierte en una ruta SVG compacta.
 * No incluye la zona de silencio (la agrega quien lo dibuja) ni dibuja los módulos del recuadro
 * central, donde va el ícono «ti».
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

  let path = "";
  for (let y = 0; y < size; y += 1) {
    const row = data[y] ?? [];
    let runStart = -1;
    for (let x = 0; x <= size; x += 1) {
      const dark = x < size && row[x] === true && !insideLogo(x, y);
      if (dark && runStart === -1) {
        runStart = x;
      } else if (!dark && runStart !== -1) {
        const length = x - runStart;
        path += `M${runStart} ${y}h${length}v1h-${length}z`;
        runStart = -1;
      }
    }
  }

  return { size, path, logo: { x: logoStart, y: logoStart, size: logoSize } };
}
