import { describe, expect, it } from "vitest";
import { neutralizeFormula, toCsv } from "@/lib/csv";

const BOM = String.fromCharCode(0xfeff);
const HEADER =
  "Nombres,Celular (con código de país),Empresa u ocupación,Interesado en CRM,Fecha de registro,Premio,N.º de ganador,Estado";

function row(
  overrides: Partial<{
    fullName: string;
    phone: string;
    company: string;
    crmInterest: boolean;
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
    crmInterest: false,
    // 2026-10-21 20:15:30 UTC = 15:15:30 en Lima (UTC−5).
    createdAt: new Date("2026-10-21T20:15:30.000Z"),
    ...overrides,
  };
}

/** Líneas del CSV sin el BOM; las filas de estas pruebas no contienen saltos de línea internos. */
function lines(csv: string): string[] {
  return csv.replace(BOM, "").split("\r\n");
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

  it("escribe una fila por participante con la fecha en hora de Lima", () => {
    const csv = toCsv([row({}), row({ fullName: "Ana Quispe", phone: "+51912345678" })]);
    expect(lines(csv)).toEqual([
      HEADER,
      "José Núñez,51 987654321,Cautiva Marketing,No,2026-10-21 15:15:30,,,",
      "Ana Quispe,51 912345678,Cautiva Marketing,No,2026-10-21 15:15:30,,,",
    ]);
  });

  it("escribe el celular con el prefijo de su país, sin +", () => {
    const csv = toCsv([
      row({ phone: "+56912345678" }),
      row({ phone: "+573001234567" }),
      row({ phone: "+59171234567" }),
    ]);
    const cells = lines(csv)
      .slice(1)
      .map((line) => line.split(",")[1]);
    expect(cells).toEqual(["56 912345678", "57 3001234567", "591 71234567"]);
  });

  it("un celular de 9 dígitos (formato anterior) sale con el prefijo 51", () => {
    expect(lines(toCsv([row({ phone: "987654321" })]))[1]).toContain(",51 987654321,");
  });

  it("la columna «Interesado en CRM» es Sí o No", () => {
    const csv = toCsv([row({ crmInterest: true }), row({ crmInterest: false })]);
    expect(lines(csv)[1]).toContain(",Cautiva Marketing,Sí,");
    expect(lines(csv)[2]).toContain(",Cautiva Marketing,No,");
  });

  it("conserva tildes y ñ", () => {
    const csv = toCsv([row({ fullName: "Ñandú Güemes Pérez", company: "Panadería Ñuñoa" })]);
    expect(lines(csv)[1]).toBe(
      "Ñandú Güemes Pérez,51 987654321,Panadería Ñuñoa,No,2026-10-21 15:15:30,,,",
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

  it("prefija con ' los textos que empiezan con =, +, -, @, tab o retorno", () => {
    for (const dangerous of ["=1+1", "+51 999", "-2+3", "@SUMA(A1)", "\t=cmd", "\r=cmd"]) {
      const csv = toCsv([row({ company: dangerous })]);
      const body = csv.replace(BOM, "");
      expect(body).toContain(`'${dangerous}`);
    }
    expect(lines(toCsv([row({ company: "=1+1" })]))[1]).toBe(
      "José Núñez,51 987654321,'=1+1,No,2026-10-21 15:15:30,,,",
    );
    // También en la columna de nombres.
    expect(
      lines(toCsv([row({ fullName: "=HYPERLINK(1)" })]))[1]?.startsWith("'=HYPERLINK(1),"),
    ).toBe(true);
  });

  it("combina la neutralización con el escape de comillas y comas", () => {
    expect(lines(toCsv([row({ company: '=A1,"x"' })]))[1]).toBe(
      `José Núñez,51 987654321,"'=A1,""x""",No,2026-10-21 15:15:30,,,`,
    );
  });

  it("no prefija el celular ni textos normales", () => {
    const line = lines(toCsv([row({ phone: "+51900000001", company: "Empresa -Norte" })]))[1];
    expect(line).toBe("José Núñez,51 900000001,Empresa -Norte,No,2026-10-21 15:15:30,,,");
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
      "José Núñez,51 987654321,Cautiva Marketing,No,2026-10-21 15:15:30,Alexa,3,Ganador",
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

  it("sin filas devuelve solo el encabezado de 8 columnas y conserva BOM y saltos \\r\\n", () => {
    expect(HEADER.split(",")).toHaveLength(8);
    expect(toCsv([])).toBe(`${BOM}${HEADER}`);
    const csv = toCsv([row({}), row({})]);
    expect(csv.split("\r\n")).toHaveLength(3);
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
