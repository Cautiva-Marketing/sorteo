import { describe, expect, it } from "vitest";
import { participantRef, pickWinners } from "@/lib/draw";

const IDS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

describe("pickWinners", () => {
  it("devuelve `count` ids distintos que pertenecen a `ids`", () => {
    for (let round = 0; round < 50; round += 1) {
      const winners = pickWinners(IDS, 4);
      expect(winners).toHaveLength(4);
      expect(new Set(winners).size).toBe(4);
      for (const winner of winners) {
        expect(IDS).toContain(winner);
      }
    }
  });

  it("con count igual a la cantidad de ids devuelve todos", () => {
    const winners = pickWinners(IDS, IDS.length);
    expect([...winners].sort()).toEqual([...IDS].sort());
  });

  it("con un RNG inyectado determinista da el resultado esperado", () => {
    // El RNG siempre elige el primer índice del rango restante [lo, hi): Fisher-Yates parcial.
    const first = (lo: number): number => lo;
    expect(pickWinners(["a", "b", "c", "d"], 3, first)).toEqual(["a", "b", "c"]);

    // El RNG siempre elige el último índice del rango restante.
    const last = (_lo: number, hi: number): number => hi - 1;
    expect(pickWinners(["a", "b", "c", "d"], 3, last)).toEqual(["d", "a", "b"]);
  });

  it("pide al RNG enteros en [i, n) para el paso i", () => {
    const calls: Array<[number, number]> = [];
    pickWinners(["a", "b", "c", "d", "e"], 3, (lo, hi) => {
      calls.push([lo, hi]);
      return lo;
    });
    expect(calls).toEqual([
      [0, 5],
      [1, 5],
      [2, 5],
    ]);
  });

  it("lanza un error con count menor que 1 o mayor que la cantidad de ids", () => {
    expect(() => pickWinners(IDS, 0)).toThrow();
    expect(() => pickWinners(IDS, -1)).toThrow();
    expect(() => pickWinners(IDS, IDS.length + 1)).toThrow();
    expect(() => pickWinners(IDS, 1.5)).toThrow();
    expect(() => pickWinners([], 1)).toThrow();
  });

  it("no modifica el arreglo de entrada", () => {
    const input = [...IDS];
    pickWinners(input, 5);
    expect(input).toEqual(IDS);
  });

  it("elige con igual probabilidad (distribución aproximadamente uniforme)", () => {
    const hits = new Map<string, number>();
    const rounds = 6000;
    for (let round = 0; round < rounds; round += 1) {
      const [winner] = pickWinners(["a", "b", "c"], 1);
      hits.set(winner ?? "", (hits.get(winner ?? "") ?? 0) + 1);
    }
    for (const id of ["a", "b", "c"]) {
      expect(hits.get(id) ?? 0).toBeGreaterThan(rounds / 3 - 400);
      expect(hits.get(id) ?? 0).toBeLessThan(rounds / 3 + 400);
    }
  });
});

describe("participantRef", () => {
  it("devuelve 16 caracteres hexadecimales y es determinista", () => {
    const ref = participantRef("+51987654321");
    expect(ref).toMatch(/^[0-9a-f]{16}$/);
    expect(participantRef("+51987654321")).toBe(ref);
  });

  it("no contiene el celular y difiere entre celulares distintos", () => {
    const ref = participantRef("+51987654321");
    expect(ref).not.toContain("987654321");
    expect(participantRef("+51987654322")).not.toBe(ref);
  });
});

describe("giros sucesivos de un solo ganador", () => {
  it("1 000 giros quitando al ganador no repiten a nadie y agotan a todos", () => {
    const pool = Array.from({ length: 1000 }, (_, index) => `id-${index}`);
    const seen = new Set<string>();
    while (pool.length > 0) {
      const [winner] = pickWinners(pool, 1);
      expect(winner).toBeDefined();
      expect(seen.has(winner as string)).toBe(false);
      seen.add(winner as string);
      pool.splice(pool.indexOf(winner as string), 1);
    }
    expect(seen.size).toBe(1000);
  });

  it("con un RNG que siempre devuelve el mínimo, el ganador es el primero del arreglo", () => {
    const first = (lo: number): number => lo;
    expect(pickWinners(["x", "y", "z"], 1, first)).toEqual(["x"]);
  });
});
