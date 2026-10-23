import { describe, expect, it } from "vitest";
import { buildQr } from "@/lib/qr";

const URL_A = "https://sorteo.example.com/registro";
const URL_B = "https://sorteo.example.com/otra";

/** Módulos oscuros que describe la ruta (`M{x} {y}h{n}v1h-{n}z` por cada racha horizontal). */
function darkModules(path: string): Set<string> {
  const modules = new Set<string>();
  for (const match of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const [, x, y, length] = match;
    for (let offset = 0; offset < Number(length); offset += 1) {
      modules.add(`${Number(x) + offset},${y}`);
    }
  }
  return modules;
}

describe("buildQr", () => {
  it("devuelve una matriz cuadrada de tamaño impar con el recuadro del ícono centrado", () => {
    const { size, logo } = buildQr(URL_A);

    expect(Number.isInteger(size)).toBe(true);
    expect(size).toBeGreaterThanOrEqual(21);
    expect(size % 2).toBe(1);
    expect(logo.size % 2).toBe(1);
    expect(logo.x).toBe(logo.y);
    expect(logo.x).toBe((size - logo.size) / 2);
  });

  it("el recuadro del ícono no pasa del 20 % del lado (≈ 4 % del área)", () => {
    for (const url of [URL_A, URL_B, "https://a.co/registro"]) {
      const { size, logo } = buildQr(url);
      expect(logo.size).toBeLessThanOrEqual(Math.floor(size * 0.2));
      expect(logo.size).toBeGreaterThan(0);
    }
  });

  it("no dibuja ningún módulo dentro del recuadro del ícono", () => {
    const { path, logo } = buildQr(URL_A);
    const modules = darkModules(path);

    for (let y = logo.y; y < logo.y + logo.size; y += 1) {
      for (let x = logo.x; x < logo.x + logo.size; x += 1) {
        expect(modules.has(`${x},${y}`), `módulo ${x},${y}`).toBe(false);
      }
    }
  });

  it("dibuja los tres patrones de posición en las esquinas", () => {
    const { path, size } = buildQr(URL_A);
    const modules = darkModules(path);

    // Esquina superior izquierda, superior derecha e inferior izquierda: el borde del patrón
    // de posición (7×7) es oscuro.
    for (const [ox, oy] of [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ] as const) {
      for (let i = 0; i < 7; i += 1) {
        expect(modules.has(`${ox + i},${oy}`)).toBe(true);
        expect(modules.has(`${ox + i},${oy + 6}`)).toBe(true);
        expect(modules.has(`${ox},${oy + i}`)).toBe(true);
        expect(modules.has(`${ox + 6},${oy + i}`)).toBe(true);
      }
    }
  });

  it("es determinista y entradas distintas dan rutas distintas", () => {
    expect(buildQr(URL_A)).toEqual(buildQr(URL_A));
    expect(buildQr(URL_A).path).not.toBe(buildQr(URL_B).path);
  });

  it("la ruta solo usa comandos M, h, v, z y coordenadas dentro de la matriz", () => {
    const { path, size } = buildQr(URL_A);

    expect(path).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
    for (const match of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
      const [, x, y, length, back] = match;
      expect(length).toBe(back);
      expect(Number(x)).toBeGreaterThanOrEqual(0);
      expect(Number(y)).toBeGreaterThanOrEqual(0);
      expect(Number(y)).toBeLessThan(size);
      expect(Number(x) + Number(length)).toBeLessThanOrEqual(size);
    }
  });
});
