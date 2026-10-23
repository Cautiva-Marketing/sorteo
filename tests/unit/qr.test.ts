import { describe, expect, it } from "vitest";
import { buildQr } from "@/lib/qr";

const URL_A = "https://sorteo.example.com/registro";
const URL_B = "https://sorteo.example.com/otra";

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
    const { dark, logo } = buildQr(URL_A);

    for (let y = logo.y; y < logo.y + logo.size; y += 1) {
      for (let x = logo.x; x < logo.x + logo.size; x += 1) {
        expect(dark[y]?.[x], `módulo ${x},${y}`).toBe(false);
      }
    }
  });

  it("reserva los tres patrones de posición en las esquinas y no los incluye en los módulos", () => {
    const { dark, finders, size } = buildQr(URL_A);

    expect(finders).toEqual([
      { x: 0, y: 0 },
      { x: size - 7, y: 0 },
      { x: 0, y: size - 7 },
    ]);
    // Se dibujan aparte (como «ojos» redondeados): sus módulos no están en la matriz de datos.
    for (const finder of finders) {
      for (let y = finder.y; y < finder.y + 7; y += 1) {
        for (let x = finder.x; x < finder.x + 7; x += 1) {
          expect(dark[y]?.[x], `módulo ${x},${y}`).toBe(false);
        }
      }
    }
  });

  it("es determinista y entradas distintas dan rutas distintas", () => {
    expect(buildQr(URL_A)).toEqual(buildQr(URL_A));
    expect(buildQr(URL_A).path).not.toBe(buildQr(URL_B).path);
  });

  it("la ruta tiene un cuadrado cerrado por módulo oscuro y solo usa comandos M, H, V, A y Z", () => {
    const { path, dark } = buildQr(URL_A);
    const modules = dark.flat().filter(Boolean).length;

    expect(modules).toBeGreaterThan(0);
    expect(path).toMatch(/^[MHVAZ0-9. -]+$/);
    expect(path.match(/Z/g)).toHaveLength(modules);
  });

  it("redondea solo las esquinas sin vecinos: un módulo aislado se dibuja con 4 arcos", () => {
    const { path, dark, size } = buildQr(URL_A);
    let isolated = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const neighbors = [dark[y - 1]?.[x], dark[y + 1]?.[x], dark[y]?.[x - 1], dark[y]?.[x + 1]];
        if (dark[y]?.[x] && neighbors.every((n) => n !== true)) {
          isolated += 1;
          expect(path).toContain(`M${x + 0.5} ${y}H${x + 0.5}A0.5 0.5 0 0 1 ${x + 1} ${y + 0.5}`);
        }
      }
    }
    // Con la URL de prueba hay módulos aislados; si no, la comprobación anterior no probaría nada.
    expect(isolated).toBeGreaterThan(0);
  });
});
