import { describe, expect, it } from "vitest";
import {
  abbreviate,
  indexAtPointer,
  labelLayout,
  PALETTE,
  pinStep,
  segmentColorIndexes,
  targetRotation,
} from "@/lib/wheel";

const TWO_PI = Math.PI * 2;

describe("PALETTE", () => {
  it("tiene 6 entradas en el orden definido en el plan", () => {
    expect(PALETTE).toEqual([
      { background: "ink-900", text: "paper" },
      { background: "paper", text: "ink-900" },
      { background: "accent-600", text: "paper" },
      { background: "paper", text: "ink-900" },
      { background: "ink-600", text: "paper" },
      { background: "paper", text: "ink-900" },
    ]);
  });
});

describe("segmentColorIndexes", () => {
  it("devuelve la cantidad pedida con índices válidos", () => {
    for (const count of [1, 2, 3, 6, 7, 13, 50, 500, 5000]) {
      const indexes = segmentColorIndexes(count);
      expect(indexes).toHaveLength(count);
      for (const index of indexes) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(PALETTE.length);
      }
    }
  });

  it("nunca deja dos segmentos contiguos del mismo color, incluida la unión último-primero", () => {
    for (const count of [3, 4, 5, 6, 7, 8, 12, 13, 19, 50, 101, 500, 5000]) {
      const indexes = segmentColorIndexes(count);
      for (let position = 0; position < count; position += 1) {
        const next = indexes[(position + 1) % count];
        expect(indexes[position], `count=${count} posición=${position}`).not.toBe(next);
      }
    }
  });

  it("los colores de fondo contiguos tampoco se repiten cuando son claros y oscuros alternados", () => {
    // Con el ciclo de 6 (oscuro, claro, azul, claro, gris, claro) dos vecinos nunca comparten fondo.
    for (const count of [7, 13, 50, 500]) {
      const indexes = segmentColorIndexes(count);
      for (let position = 0; position < count; position += 1) {
        const current = PALETTE[indexes[position] as number]?.background;
        const next = PALETTE[indexes[(position + 1) % count] as number]?.background;
        expect(current).not.toBe(next);
      }
    }
  });

  it("con 1 segmento es un disco único y con 2 usa los dos primeros índices", () => {
    expect(segmentColorIndexes(1)).toEqual([0]);
    expect(segmentColorIndexes(2)).toEqual([0, 1]);
  });

  it("con 7 segmentos reasigna el último (6 % 6 = 0 coincidiría con el primero)", () => {
    const indexes = segmentColorIndexes(7);
    expect(indexes.slice(0, 6)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(indexes[6]).not.toBe(indexes[5]);
    expect(indexes[6]).not.toBe(indexes[0]);
  });
});

describe("indexAtPointer", () => {
  it("con rotación 0 el segmento 0 está bajo el puntero", () => {
    expect(indexAtPointer(0, 10)).toBe(0);
  });

  it("al girar en sentido horario el puntero recorre los segmentos en sentido contrario", () => {
    const count = 10;
    const arc = TWO_PI / count;
    // Rotar medio segmento más allá de 0 deja bajo el puntero al último segmento.
    expect(indexAtPointer(arc * 0.5, count)).toBe(count - 1);
    expect(indexAtPointer(arc * 1.5, count)).toBe(count - 2);
  });

  it("respeta los bordes de cada segmento", () => {
    const count = 8;
    const arc = TWO_PI / count;
    for (let index = 0; index < count; index += 1) {
      const start = -index * arc;
      expect(indexAtPointer(start - arc * 0.001, count)).toBe(index);
      expect(indexAtPointer(start - arc * 0.999, count)).toBe(index);
    }
  });

  it("funciona con rotaciones negativas y mayores que 2π", () => {
    const count = 12;
    expect(indexAtPointer(-0.0001, count)).toBe(0);
    expect(indexAtPointer(TWO_PI * 7, count)).toBe(0);
    expect(indexAtPointer(TWO_PI * 3 + (TWO_PI / count) * 0.5, count)).toBe(count - 1);
    expect(indexAtPointer(-TWO_PI * 4 - (TWO_PI / count) * 2.5, count)).toBe(2);
  });
});

describe("targetRotation", () => {
  it("deja siempre el puntero dentro del segmento ganador y suma las vueltas pedidas", () => {
    const offsets = [-0.25, -0.1, 0, 0.1, 0.25];
    for (const count of [1, 2, 3, 10, 150, 500, 5000]) {
      const winners = new Set([0, count - 1, Math.floor(count / 2), Math.floor(count / 3)]);
      for (const winnerIndex of winners) {
        for (const extraTurns of [6, 7, 8]) {
          for (const offsetFraction of offsets) {
            const startRotation = (Math.sin(winnerIndex + count) * 50 + extraTurns) * 1.37;
            const target = targetRotation({
              winnerIndex,
              count,
              startRotation,
              extraTurns,
              offsetFraction,
            });
            const label = `count=${count} ganador=${winnerIndex} vueltas=${extraTurns} offset=${offsetFraction}`;
            expect(target, label).toBeGreaterThanOrEqual(startRotation + extraTurns * TWO_PI);
            expect(target, label).toBeLessThan(startRotation + (extraTurns + 1) * TWO_PI + 1e-9);
            expect(indexAtPointer(target, count), label).toBe(winnerIndex);
          }
        }
      }
    }
  });

  it("con offset 0 el puntero queda en el centro del segmento", () => {
    const count = 10;
    const arc = TWO_PI / count;
    const target = targetRotation({
      winnerIndex: 3,
      count,
      startRotation: 0,
      extraTurns: 6,
      offsetFraction: 0,
    });
    const wheelAngle = (((-target % TWO_PI) + TWO_PI) % TWO_PI) / arc;
    expect(wheelAngle).toBeCloseTo(3.5, 6);
  });
});

describe("labelLayout", () => {
  it("con 500 segmentos y radio 260 no dibuja texto", () => {
    expect(labelLayout(500, 260).showLabel).toBe(false);
  });

  it("con 10 segmentos dibuja el nombre completo con fuente de hasta 14 px", () => {
    const layout = labelLayout(10, 260);
    expect(layout.showLabel).toBe(true);
    expect(layout.firstNameOnly).toBe(false);
    expect(layout.fontSize).toBeLessThanOrEqual(14);
    expect(layout.fontSize).toBeGreaterThanOrEqual(7);
  });

  it("usa solo el primer nombre a partir de 21 segmentos", () => {
    expect(labelLayout(20, 260).firstNameOnly).toBe(false);
    expect(labelLayout(21, 260).firstNameOnly).toBe(true);
  });

  it("la fuente solo disminuye al aumentar los segmentos", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const count of [5, 10, 20, 40, 80, 160, 320]) {
      const { fontSize } = labelLayout(count, 260);
      expect(fontSize).toBeLessThanOrEqual(previous);
      previous = fontSize;
    }
  });
});

describe("abbreviate", () => {
  it("corta con puntos suspensivos sin superar el máximo", () => {
    const result = abbreviate("María Pérez Soto", 8, false);
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result.endsWith("…")).toBe(true);
  });

  it("deja el nombre intacto si cabe", () => {
    expect(abbreviate("Ana Paz", 20, false)).toBe("Ana Paz");
  });

  it("con firstNameOnly usa el primer término", () => {
    expect(abbreviate("María Pérez Soto", 20, true)).toBe("María");
  });

  it("con firstNameOnly también corta si el primer nombre no cabe", () => {
    const result = abbreviate("Maximiliano Pérez", 5, true);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("pinStep", () => {
  it("1 hasta 50, 2 hasta 100 y 5 por encima", () => {
    expect(pinStep(50)).toBe(1);
    expect(pinStep(51)).toBe(2);
    expect(pinStep(100)).toBe(2);
    expect(pinStep(101)).toBe(5);
  });
});
