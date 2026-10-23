import { describe, expect, it } from "vitest";
import {
  prizeOrderSchema,
  prizeSchema,
  registrationSchema,
  spinRequestSchema,
} from "@/lib/validation/schemas";

const valid = {
  fullName: "José Núñez Güemes",
  phone: "987 654 321",
  company: "Cautiva Marketing",
};

function parse(overrides: Record<string, unknown>) {
  return registrationSchema.safeParse({ ...valid, ...overrides });
}

function messagesFor(overrides: Record<string, unknown>, field: string): string[] {
  const result = parse(overrides);
  if (result.success) {
    return [];
  }
  return result.error.issues.filter((issue) => issue.path[0] === field).map((i) => i.message);
}

describe("registrationSchema", () => {
  it("acepta datos válidos y normaliza el celular a E.164", () => {
    const result = registrationSchema.parse(valid);
    expect(result).toEqual({ ...valid, phone: "+51987654321" });
  });

  describe("fullName", () => {
    it("rechaza un solo término", () => {
      expect(parse({ fullName: "María" }).success).toBe(false);
    });

    it("acepta tildes, ñ y diéresis", () => {
      expect(parse({ fullName: "José Núñez Güemes" }).success).toBe(true);
    });

    it("rechaza dígitos y símbolos", () => {
      expect(parse({ fullName: "Ana 2 Pérez" }).success).toBe(false);
      expect(parse({ fullName: "Ana P@rez" }).success).toBe(false);
      expect(parse({ fullName: "Ana-María Pérez" }).success).toBe(false);
    });

    it("rechaza más de 100 caracteres y acepta exactamente 100", () => {
      const termOf = (length: number) => "a".repeat(length);
      expect(parse({ fullName: `${termOf(49)} ${termOf(50)}` }).success).toBe(true);
      expect(parse({ fullName: `${termOf(50)} ${termOf(50)}` }).success).toBe(false);
    });

    it("colapsa espacios y aplica NFC", () => {
      const decomposed = "José    Núñez   Pérez ";
      const result = registrationSchema.parse({ ...valid, fullName: `  ${decomposed}` });
      expect(result.fullName).toBe("José Núñez Pérez");
      expect(result.fullName).toBe(result.fullName.normalize("NFC"));
    });

    it("rechaza vacío con un mensaje", () => {
      const messages = messagesFor({ fullName: "" }, "fullName");
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe("phone", () => {
    it("rechaza celulares inválidos con un mensaje en español", () => {
      const messages = messagesFor({ phone: "812345678" }, "phone");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatch(/celular/i);
    });

    it("rechaza vacío", () => {
      expect(parse({ phone: "" }).success).toBe(false);
    });
  });

  describe("company", () => {
    it("rechaza 1 carácter y acepta 2", () => {
      expect(parse({ company: "A" }).success).toBe(false);
      expect(parse({ company: "AB" }).success).toBe(true);
    });

    it("acepta 100 caracteres y rechaza 101", () => {
      expect(parse({ company: "a".repeat(100) }).success).toBe(true);
      expect(parse({ company: "a".repeat(101) }).success).toBe(false);
    });

    it("rechaza caracteres de control", () => {
      expect(parse({ company: "Empresa\u0000X" }).success).toBe(false);
      expect(parse({ company: "Emp\u0007resa" }).success).toBe(false);
      expect(parse({ company: "Empresa\nSA" }).success).toBe(false);
    });

    it("colapsa y recorta espacios antes de medir la longitud", () => {
      const result = registrationSchema.parse({ ...valid, company: "  Cautiva    Marketing  " });
      expect(result.company).toBe("Cautiva Marketing");
      expect(parse({ company: " A " }).success).toBe(false);
    });
  });

  describe("campos que ya no existen (spec 002)", () => {
    it("descarta consent y consentVersion si llegan: no forman parte del resultado", () => {
      const result = registrationSchema.parse({ ...valid, consent: true, consentVersion: "x" });
      expect(result).toEqual({ ...valid, phone: "+51987654321" });
      expect(Object.keys(result).sort()).toEqual(["company", "fullName", "phone"]);
    });
  });

  it("todos los mensajes de error están en español", () => {
    const result = registrationSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0]).sort()).toEqual([
        "company",
        "fullName",
        "phone",
      ]);
      for (const issue of result.error.issues) {
        expect(issue.message, issue.message).not.toMatch(/^(Invalid|Required|Too |Expected)/);
      }
    }
  });
});

describe("prizeSchema", () => {
  it("normaliza el nombre (NFC, espacios colapsados) y deja la cantidad en 1 por defecto", () => {
    const result = prizeSchema.parse({ name: "  Box   de bienvenida " });
    expect(result).toEqual({ name: "Box de bienvenida", quantity: 1 });
  });

  it("acepta un nombre de 2 a 60 caracteres y rechaza 1 y 61", () => {
    expect(prizeSchema.safeParse({ name: "Ab" }).success).toBe(true);
    expect(prizeSchema.safeParse({ name: "a".repeat(60) }).success).toBe(true);
    expect(prizeSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(prizeSchema.safeParse({ name: "a".repeat(61) }).success).toBe(false);
    expect(prizeSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rechaza caracteres de control en el nombre", () => {
    expect(prizeSchema.safeParse({ name: "Alexa" }).success).toBe(false);
  });

  it("acepta cantidades enteras de 1 a 100 y rechaza 0, 101, decimales y texto no numérico", () => {
    expect(prizeSchema.parse({ name: "Alexa", quantity: 1 }).quantity).toBe(1);
    expect(prizeSchema.parse({ name: "Alexa", quantity: 100 }).quantity).toBe(100);
    for (const quantity of [0, 101, 1.5, -2, "abc", ""]) {
      expect(prizeSchema.safeParse({ name: "Alexa", quantity }).success, String(quantity)).toBe(
        false,
      );
    }
  });

  it("acepta la cantidad escrita como texto en el formulario", () => {
    expect(prizeSchema.parse({ name: "Alexa", quantity: "3" }).quantity).toBe(3);
  });
});

describe("prizeOrderSchema", () => {
  it("acepta una lista de ids distintos", () => {
    expect(prizeOrderSchema.parse({ ids: ["a", "b"] })).toEqual({ ids: ["a", "b"] });
  });

  it("rechaza una lista vacía y ids repetidos", () => {
    expect(prizeOrderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(prizeOrderSchema.safeParse({ ids: ["a", "a"] }).success).toBe(false);
  });
});

describe("spinRequestSchema", () => {
  it("acepta un premio con o sin confirmación de cierre", () => {
    expect(spinRequestSchema.parse({ prizeId: "p1" })).toEqual({ prizeId: "p1" });
    expect(spinRequestSchema.parse({ prizeId: "p1", confirmCloseRegistration: true })).toEqual({
      prizeId: "p1",
      confirmCloseRegistration: true,
    });
  });

  it("rechaza un premio vacío o ausente", () => {
    expect(spinRequestSchema.safeParse({ prizeId: "" }).success).toBe(false);
    expect(spinRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rechaza una confirmación que no es booleana", () => {
    expect(
      spinRequestSchema.safeParse({ prizeId: "p1", confirmCloseRegistration: "si" }).success,
    ).toBe(false);
  });
});
