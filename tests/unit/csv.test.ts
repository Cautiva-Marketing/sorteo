import { describe, expect, it } from "vitest";
import { neutralizeFormula, toCsv } from "@/lib/csv";
import type { Interest } from "@/types";

const BOM = String.fromCharCode(0xfeff);
const HEADER =
  "Nombres,Celular (con código de país),Empresa u ocupación,Área de capacitación,Invitado sugerido,CRM con Agente IA,GPS / cámara,Fecha de registro,Premio,N.º de ganador,Estado";

function row(
  overrides: Partial<{
    fullName: string;
    phone: string;
    company: string;
    trainingArea: string;
    guestSuggestion: string;
    crmInterest: Interest;
    gpsInterest: Interest | null;
    createdAt: Date;
    prizeName: string | null;
    winnerNumber: number | null;
    winnerStatus: "active" | "discarded" | null;
  }>,
) {
  return {
    fullName: "José Núñez",
    phone: "+51987654321",
    company: "Cautiva Marketing",
    trainingArea: "Ventas",
    guestSuggestion: "Un experto",
    crmInterest: "no" as Interest,
    gpsInterest: "no" as Interest | null,
    // 2026-10-21 20:15:30 UTC = 15:15:30 en Lima (UTC−5).
    createdAt: new Date("2026-10-21T20:15:30.000Z"),
    ...overrides,
  };
}

/** Líneas del CSV sin el BOM; las filas de estas pruebas no contienen saltos de línea internos. */
function lines(csv: string): string[] {
  return csv.replace(BOM, "").split("\r\n");
}

/** Celdas de una línea sin comillas ni comas internas (las filas que la usan las evitan). */
function cells(line: string | undefined): string[] {
  return (line ?? "").split(",");
}

describe("toCsv", () => {
  it("empieza con el BOM UTF-8 y el encabezado fijo", () => {
    const csv = toCsv([row({})]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(lines(csv)[0]).toBe(HEADER);
  });

  it("sin filas devuelve solo el encabezado", () => {
    expect(toCsv([])).toBe(`${BOM}${HEADER}`);
  });

  it("escribe una fila por participante con las cuatro respuestas y la fecha en hora de Lima", () => {
    const csv = toCsv([row({}), row({ fullName: "Ana Quispe", phone: "+51912345678" })]);
    expect(lines(csv)).toEqual([
      HEADER,
      "José Núñez,51 987654321,Cautiva Marketing,Ventas,Un experto,No,No,2026-10-21 15:15:30,,,",
      "Ana Quispe,51 912345678,Cautiva Marketing,Ventas,Un experto,No,No,2026-10-21 15:15:30,,,",
    ]);
  });

  it("escribe el celular con el prefijo de su país, sin +", () => {
    const csv = toCsv([
      row({ phone: "+56912345678" }),
      row({ phone: "+573001234567" }),
      row({ phone: "+59171234567" }),
    ]);
    const phones = lines(csv)
      .slice(1)
      .map((line) => cells(line)[1]);
    expect(phones).toEqual(["56 912345678", "57 3001234567", "591 71234567"]);
  });

  it("un celular de 9 dígitos (formato anterior) sale con el prefijo 51", () => {
    expect(lines(toCsv([row({ phone: "987654321" })]))[1]).toContain(",51 987654321,");
  });

  it("las columnas de CRM y de GPS / cámara dicen Sí, Tal vez o No", () => {
    const csv = toCsv([
      row({ crmInterest: "yes", gpsInterest: "maybe" }),
      row({ crmInterest: "maybe", gpsInterest: "no" }),
      row({ crmInterest: "no", gpsInterest: "yes" }),
    ]);
    const answers = lines(csv)
      .slice(1)
      .map((line) => cells(line).slice(5, 7));
    expect(answers).toEqual([
      ["Sí", "Tal vez"],
      ["Tal vez", "No"],
      ["No", "Sí"],
    ]);
  });

  it("GPS / cámara queda vacía cuando el participante no respondió (registro anterior)", () => {
    const line = lines(toCsv([row({ crmInterest: "yes", gpsInterest: null })]))[1];
    expect(cells(line).slice(3, 7)).toEqual(["Ventas", "Un experto", "Sí", ""]);
  });

  it("el área de capacitación y el invitado vacíos (registro anterior) dejan celdas vacías", () => {
    const line = lines(
      toCsv([row({ trainingArea: "", guestSuggestion: "", gpsInterest: null })]),
    )[1];
    expect(line).toBe("José Núñez,51 987654321,Cautiva Marketing,,,No,,2026-10-21 15:15:30,,,");
  });

  it("conserva tildes y ñ", () => {
    const csv = toCsv([
      row({
        fullName: "Ñandú Güemes Pérez",
        company: "Panadería Ñuñoa",
        trainingArea: "Administración",
      }),
    ]);
    expect(lines(csv)[1]).toBe(
      "Ñandú Güemes Pérez,51 987654321,Panadería Ñuñoa,Administración,Un experto,No,No,2026-10-21 15:15:30,,,",
    );
  });

  it("escapa comas, comillas dobles y saltos de línea", () => {
    const csv = toCsv([
      row({ company: "Ventas, Marketing y Cía" }),
      row({ company: 'La "Mejor" Tienda' }),
      row({ company: "Línea uno\nlínea dos" }),
    ]);
    const body = csv.replace(BOM, "");
    expect(body).toContain('"Ventas, Marketing y Cía"');
    expect(body).toContain('"La ""Mejor"" Tienda"');
    expect(body).toContain('"Línea uno\nlínea dos"');
  });

  it("escapa comas y comillas en las respuestas de texto libre", () => {
    const csv = toCsv([row({ trainingArea: "Ventas, finanzas", guestSuggestion: 'El "Gurú"' })]);
    expect(lines(csv)[1]).toContain(',"Ventas, finanzas","El ""Gurú""",');
  });

  it("prefija con ' los textos que empiezan con =, +, -, @, tab o retorno", () => {
    for (const dangerous of ["=1+1", "+51 999", "-2+3", "@SUMA(A1)", "\t=cmd", "\r=cmd"]) {
      const csv = toCsv([row({ company: dangerous })]);
      const body = csv.replace(BOM, "");
      expect(body).toContain(`'${dangerous}`);
    }
    expect(lines(toCsv([row({ company: "=1+1" })]))[1]).toBe(
      "José Núñez,51 987654321,'=1+1,Ventas,Un experto,No,No,2026-10-21 15:15:30,,,",
    );
    // También en la columna de nombres.
    expect(
      lines(toCsv([row({ fullName: "=HYPERLINK(1)" })]))[1]?.startsWith("'=HYPERLINK(1),"),
    ).toBe(true);
  });

  it("neutraliza las fórmulas en el área de capacitación y en el invitado sugerido", () => {
    for (const dangerous of ["=1+1", "+cmd", "-2+3", "@SUMA(A1)"]) {
      const line = lines(toCsv([row({ trainingArea: dangerous, guestSuggestion: dangerous })]))[1];
      expect(cells(line).slice(3, 5), dangerous).toEqual([`'${dangerous}`, `'${dangerous}`]);
    }
  });

  it("un texto con etiquetas HTML sale como texto, solo escapado como celda", () => {
    const html = '<script>alert("x")</script>';
    const line = lines(toCsv([row({ trainingArea: html })]))[1];
    expect(line).toContain(`,"<script>alert(""x"")</script>",Un experto,`);
  });

  it("combina la neutralización con el escape de comillas y comas", () => {
    expect(lines(toCsv([row({ company: '=A1,"x"' })]))[1]).toBe(
      `José Núñez,51 987654321,"'=A1,""x""",Ventas,Un experto,No,No,2026-10-21 15:15:30,,,`,
    );
  });

  it("no prefija el celular ni textos normales", () => {
    const line = lines(toCsv([row({ phone: "+51900000001", company: "Empresa -Norte" })]))[1];
    expect(line).toBe(
      "José Núñez,51 900000001,Empresa -Norte,Ventas,Un experto,No,No,2026-10-21 15:15:30,,,",
    );
  });

  it("genera una línea por participante más el encabezado", () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      row({ phone: `+519000000${String(index).padStart(2, "0")}` }),
    );
    expect(lines(toCsv(rows))).toHaveLength(26);
  });
});

describe("toCsv con ganadores (feature 003, FR-084)", () => {
  it("un ganador activo trae premio, número y estado «Ganador»", () => {
    const csv = toCsv([row({ prizeName: "Alexa", winnerNumber: 3, winnerStatus: "active" })]);
    expect(lines(csv)[1]).toBe(
      "José Núñez,51 987654321,Cautiva Marketing,Ventas,Un experto,No,No,2026-10-21 15:15:30,Alexa,3,Ganador",
    );
  });

  it("un ganador descartado trae el estado «Descartado»", () => {
    const csv = toCsv([row({ prizeName: "Alexa", winnerNumber: 4, winnerStatus: "discarded" })]);
    expect(lines(csv)[1]?.endsWith(",Alexa,4,Descartado")).toBe(true);
  });

  it("un ganador de una ronda anterior sin premio se exporta como «Sin premio»", () => {
    const csv = toCsv([row({ prizeName: null, winnerNumber: 2, winnerStatus: "active" })]);
    expect(lines(csv)[1]?.endsWith(",Sin premio,2,Ganador")).toBe(true);
  });

  it("quien no ganó deja vacías las tres celdas nuevas", () => {
    const csv = toCsv([row({ prizeName: null, winnerNumber: null, winnerStatus: null })]);
    expect(lines(csv)[1]?.endsWith("2026-10-21 15:15:30,,,")).toBe(true);
  });

  it("neutraliza fórmulas y escapa comas en el nombre del premio", () => {
    const formula = toCsv([row({ prizeName: "=cmd", winnerNumber: 1, winnerStatus: "active" })]);
    expect(lines(formula)[1]?.endsWith(",'=cmd,1,Ganador")).toBe(true);
    const plus = toCsv([row({ prizeName: "+x", winnerNumber: 1, winnerStatus: "active" })]);
    expect(lines(plus)[1]?.endsWith(",'+x,1,Ganador")).toBe(true);
    const comma = toCsv([
      row({ prizeName: "Termo, grande", winnerNumber: 1, winnerStatus: "active" }),
    ]);
    expect(lines(comma)[1]?.endsWith(',"Termo, grande",1,Ganador')).toBe(true);
  });

  it("sin filas devuelve solo el encabezado de 11 columnas y conserva BOM y saltos \\r\\n", () => {
    expect(HEADER.split(",")).toHaveLength(11);
    expect(toCsv([])).toBe(`${BOM}${HEADER}`);
    const csv = toCsv([row({}), row({})]);
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("las filas de ganadores y de no ganadores tienen el mismo número de celdas", () => {
    const csv = toCsv([
      row({ prizeName: "Alexa", winnerNumber: 3, winnerStatus: "active" }),
      row({}),
    ]);
    const [, winner, other] = lines(csv);
    expect(cells(winner)).toHaveLength(11);
    expect(cells(other)).toHaveLength(11);
  });
});

describe("neutralizeFormula", () => {
  it("prefija con ' solo los textos peligrosos", () => {
    expect(neutralizeFormula("=1+1")).toBe("'=1+1");
    expect(neutralizeFormula("+1")).toBe("'+1");
    expect(neutralizeFormula("-1")).toBe("'-1");
    expect(neutralizeFormula("@x")).toBe("'@x");
    expect(neutralizeFormula("\tx")).toBe("'\tx");
    expect(neutralizeFormula("\rx")).toBe("'\rx");
    expect(neutralizeFormula("Cautiva")).toBe("Cautiva");
    expect(neutralizeFormula("a=b")).toBe("a=b");
    expect(neutralizeFormula("")).toBe("");
  });
});
