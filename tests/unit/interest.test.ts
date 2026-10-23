import { describe, expect, it } from "vitest";
import {
  CRM_FILTER_OPTIONS,
  CRM_OPTIONS,
  GPS_FILTER_OPTIONS,
  GPS_OPTIONS,
  INTEREST_VALUES,
  interestCsvLabel,
  interestLabel,
  matchesInterestFilter,
  normalizeStoredInterest,
  normalizeStoredOptionalInterest,
  type InterestFilter,
} from "@/lib/interest";
import type { Interest } from "@/types";

describe("INTEREST_VALUES", () => {
  it("son exactamente yes, maybe y no, en ese orden", () => {
    expect([...INTEREST_VALUES]).toEqual(["yes", "maybe", "no"]);
  });
});

describe("etiquetas", () => {
  it("interestLabel muestra Sí, Tal vez, No y «Sin respuesta» para null", () => {
    expect(interestLabel("yes")).toBe("Sí");
    expect(interestLabel("maybe")).toBe("Tal vez");
    expect(interestLabel("no")).toBe("No");
    expect(interestLabel(null)).toBe("Sin respuesta");
  });

  it("interestCsvLabel es igual pero vacía para null", () => {
    expect(interestCsvLabel("yes")).toBe("Sí");
    expect(interestCsvLabel("maybe")).toBe("Tal vez");
    expect(interestCsvLabel("no")).toBe("No");
    expect(interestCsvLabel(null)).toBe("");
  });
});

describe("opciones de las preguntas", () => {
  it("CRM_OPTIONS tiene 3 opciones con los textos del formulario", () => {
    expect(CRM_OPTIONS).toEqual([
      { value: "yes", label: "Sí, me interesa" },
      { value: "maybe", label: "Tal vez, envíenme más información" },
      { value: "no", label: "No, por ahora" },
    ]);
  });

  it("GPS_OPTIONS pide una cotización en lugar de más información", () => {
    expect(GPS_OPTIONS).toEqual([
      { value: "yes", label: "Sí, me interesa" },
      { value: "maybe", label: "Tal vez, envíenme una cotización" },
      { value: "no", label: "No, por ahora" },
    ]);
  });
});

describe("matchesInterestFilter", () => {
  const values: Array<Interest | null> = ["yes", "maybe", "no", null];
  const filters: InterestFilter[] = ["all", "yes", "maybe", "no", "none"];

  it("«all» coincide con todo, incluido null", () => {
    for (const value of values) {
      expect(matchesInterestFilter(value, "all")).toBe(true);
    }
  });

  it("«none» coincide solo con null", () => {
    expect(matchesInterestFilter(null, "none")).toBe(true);
    for (const value of ["yes", "maybe", "no"] as const) {
      expect(matchesInterestFilter(value, "none")).toBe(false);
    }
  });

  it("un valor coincide solo con su propio filtro", () => {
    for (const value of ["yes", "maybe", "no"] as const) {
      for (const filter of filters) {
        const expected = filter === "all" || filter === value;
        expect(matchesInterestFilter(value, filter), `${value} / ${filter}`).toBe(expected);
      }
    }
  });

  it("null no coincide con ningún valor concreto", () => {
    for (const filter of ["yes", "maybe", "no"] as const) {
      expect(matchesInterestFilter(null, filter)).toBe(false);
    }
  });
});

describe("opciones de los filtros", () => {
  it("el filtro de CRM no ofrece «Sin respuesta»", () => {
    expect(CRM_FILTER_OPTIONS).toEqual([
      { value: "all", label: "Todas" },
      { value: "yes", label: "Sí" },
      { value: "maybe", label: "Tal vez" },
      { value: "no", label: "No" },
    ]);
  });

  it("el filtro de GPS / cámara sí lo ofrece", () => {
    expect(GPS_FILTER_OPTIONS).toEqual([
      { value: "all", label: "Todas" },
      { value: "yes", label: "Sí" },
      { value: "maybe", label: "Tal vez" },
      { value: "no", label: "No" },
      { value: "none", label: "Sin respuesta" },
    ]);
  });
});

describe("normalizeStoredInterest (CRM guardado)", () => {
  it("deja pasar los tres valores válidos", () => {
    expect(normalizeStoredInterest("yes")).toBe("yes");
    expect(normalizeStoredInterest("maybe")).toBe("maybe");
    expect(normalizeStoredInterest("no")).toBe("no");
  });

  it("interpreta la casilla de la feature 004: true es «yes»", () => {
    expect(normalizeStoredInterest(true)).toBe("yes");
  });

  it("false, ausente o cualquier otro valor es «no»", () => {
    for (const value of [false, undefined, null, "si", 1, 0, "", {}]) {
      expect(normalizeStoredInterest(value), String(value)).toBe("no");
    }
  });
});

describe("normalizeStoredOptionalInterest (GPS guardado)", () => {
  it("deja pasar los tres valores válidos", () => {
    expect(normalizeStoredOptionalInterest("yes")).toBe("yes");
    expect(normalizeStoredOptionalInterest("maybe")).toBe("maybe");
    expect(normalizeStoredOptionalInterest("no")).toBe("no");
  });

  it("ausente o cualquier otro valor es null (sin respuesta)", () => {
    for (const value of [undefined, null, true, false, "si", 1, "", {}]) {
      expect(normalizeStoredOptionalInterest(value), String(value)).toBeNull();
    }
  });
});
