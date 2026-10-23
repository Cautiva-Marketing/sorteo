import { describe, expect, it } from "vitest";
import { phoneErrorMessage } from "@/lib/validation/phone";
import {
  prizeOrderSchema,
  prizeSchema,
  registrationCheckSchema,
  registrationSchema,
  spinRequestSchema,
} from "@/lib/validation/schemas";

const valid = {
  fullName: "José Núñez Güemes",
  phone: "987 654 321",
  company: "Cautiva Marketing",
  trainingArea: "Ventas y atención al cliente",
  guestSuggestion: "Un experto en marketing digital",
  crmInterest: "no",
  gpsInterest: "no",
};

/** Lo que devuelve el esquema para `valid`: celular en E.164 y sin país. */
const validOutput = {
  fullName: "José Núñez Güemes",
  phone: "+51987654321",
  company: "Cautiva Marketing",
  trainingArea: "Ventas y atención al cliente",
  guestSuggestion: "Un experto en marketing digital",
  crmInterest: "no",
  gpsInterest: "no",
};

/** Claves de la salida del esquema, ordenadas. */
const OUTPUT_KEYS = [
  "company",
  "crmInterest",
  "fullName",
  "gpsInterest",
  "guestSuggestion",
  "phone",
  "trainingArea",
];

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
    expect(result).toEqual(validOutput);
  });

  it("acepta el celular con prefijo y el país por defecto", () => {
    const result = registrationSchema.parse({ ...valid, phone: "+51 987-654-321" });
    expect(result.phone).toBe("+51987654321");
  });

  it("ya no acepta el cuerpo anterior (sin las cuatro respuestas)", () => {
    const result = registrationSchema.safeParse({
      fullName: "Ana Pérez",
      phone: "+51 987-654-321",
      company: "Cautiva",
    });
    expect(result.success).toBe(false);
  });

  describe("fullName", () => {
    it("acepta un solo nombre", () => {
      expect(parse({ fullName: "María" }).success).toBe(true);
      expect(registrationSchema.parse({ ...valid, fullName: " María " }).fullName).toBe("María");
    });

    it("rechaza una sola letra", () => {
      expect(parse({ fullName: "A" }).success).toBe(false);
    });

    it("acepta tildes, ñ y diéresis", () => {
      expect(parse({ fullName: "José Núñez Güemes" }).success).toBe(true);
    });

    it("rechaza dígitos y símbolos", () => {
      expect(parse({ fullName: "Ana 2 Pérez" }).success).toBe(false);
      expect(parse({ fullName: "Ana P@rez" }).success).toBe(false);
      expect(parse({ fullName: "Ana-María Pérez" }).success).toBe(false);
      expect(parse({ fullName: "María!" }).success).toBe(false);
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

    it("usa Perú cuando no llega el país", () => {
      expect(registrationSchema.parse(valid).phone).toBe("+51987654321");
    });

    it("normaliza con el prefijo del país elegido", () => {
      const result = registrationSchema.parse({
        ...valid,
        fullName: "María",
        country: "CL",
        phone: "9 1234 5678",
      });
      expect(result.phone).toBe("+56912345678");
      expect(Object.keys(result).sort()).toEqual(OUTPUT_KEYS);
    });

    it("rechaza un país fuera de los 12 de Sudamérica", () => {
      expect(parse({ country: "MX" }).success).toBe(false);
      expect(parse({ country: "" }).success).toBe(false);
    });

    it("informa el error del celular en la ruta phone con el mensaje del país", () => {
      expect(messagesFor({ country: "CL", phone: "812345678" }, "phone")).toEqual([
        phoneErrorMessage("CL"),
      ]);
      expect(messagesFor({ country: "CO", phone: "123" }, "phone")).toEqual([
        phoneErrorMessage("CO"),
      ]);
    });

    it("el mismo número puede ser válido en un país e inválido en otro", () => {
      expect(parse({ country: "PE", phone: "987654321" }).success).toBe(true);
      expect(parse({ country: "CO", phone: "987654321" }).success).toBe(false);
    });

    it("informa a la vez un nombre inválido y un celular inválido", () => {
      const result = parse({ fullName: "A", phone: "123" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.issues.map((issue) => issue.path[0]);
        expect(fields).toContain("fullName");
        expect(fields).toContain("phone");
      }
    });
  });

  describe("trainingArea y guestSuggestion", () => {
    const fields = ["trainingArea", "guestSuggestion"] as const;

    it("aceptan 2 y 100 caracteres y rechazan 1 y 101", () => {
      for (const field of fields) {
        expect(parse({ [field]: "ab" }).success, field).toBe(true);
        expect(parse({ [field]: "a".repeat(100) }).success, field).toBe(true);
        expect(parse({ [field]: "a" }).success, field).toBe(false);
        expect(parse({ [field]: "a".repeat(101) }).success, field).toBe(false);
      }
    });

    it("rechazan vacío, solo espacios y valores que no son texto", () => {
      for (const field of fields) {
        expect(parse({ [field]: "" }).success, field).toBe(false);
        expect(parse({ [field]: "     " }).success, field).toBe(false);
        expect(parse({ [field]: undefined }).success, field).toBe(false);
        expect(parse({ [field]: null }).success, field).toBe(false);
        expect(parse({ [field]: 12 }).success, field).toBe(false);
      }
    });

    it("usan mensajes propios en español", () => {
      expect(messagesFor({ trainingArea: "a" }, "trainingArea")).toEqual([
        "Cuéntanos en qué área te gustaría capacitarte (mínimo 2 caracteres).",
      ]);
      expect(messagesFor({ guestSuggestion: "a" }, "guestSuggestion")).toEqual([
        "Cuéntanos qué invitado te gustaría que trajéramos (mínimo 2 caracteres).",
      ]);
      expect(messagesFor({ trainingArea: "a".repeat(101) }, "trainingArea")).toEqual([
        "La respuesta no puede pasar de 100 caracteres.",
      ]);
    });

    it("convierten saltos de línea, tabulaciones y espacios repetidos en un solo espacio", () => {
      const result = registrationSchema.parse({
        ...valid,
        trainingArea: "  Ventas\n  y \t  marketing\r\n ",
        guestSuggestion: "Un\n\nexperto",
      });
      expect(result.trainingArea).toBe("Ventas y marketing");
      expect(result.guestSuggestion).toBe("Un experto");
    });

    it("miden la longitud después de normalizar", () => {
      expect(parse({ trainingArea: " a " }).success).toBe(false);
      expect(parse({ trainingArea: `${"a".repeat(100)}   ` }).success).toBe(true);
    });

    it("aplican NFC", () => {
      const result = registrationSchema.parse({ ...valid, trainingArea: "Administración" });
      expect(result.trainingArea).toBe("Administración");
    });

    it("rechazan caracteres de control que no son espacio en blanco", () => {
      for (const field of fields) {
        expect(parse({ [field]: "Ventas\u0007" }).success, field).toBe(false);
        expect(parse({ [field]: "Ven\u0000tas" }).success, field).toBe(false);
      }
    });

    it("guardan etiquetas HTML tal cual, como texto plano", () => {
      const result = registrationSchema.parse({
        ...valid,
        trainingArea: "<script>alert(1)</script>",
      });
      expect(result.trainingArea).toBe("<script>alert(1)</script>");
    });
  });

  describe("crmInterest y gpsInterest", () => {
    const fields = ["crmInterest", "gpsInterest"] as const;

    it("aceptan yes, maybe y no y los conservan", () => {
      for (const field of fields) {
        for (const value of ["yes", "maybe", "no"]) {
          expect(parse({ [field]: value }).data?.[field], `${field}=${value}`).toBe(value);
        }
      }
    });

    it("son obligatorios y no tienen valor por defecto", () => {
      for (const field of fields) {
        for (const value of [undefined, null, ""]) {
          const messages = messagesFor({ [field]: value }, field);
          expect(messages, `${field}=${String(value)}`).toEqual(["Elige una opción."]);
        }
      }
    });

    it("rechazan valores desconocidos y el booleano anterior", () => {
      for (const field of fields) {
        for (const value of ["si", "YES", true, false, 1, {}]) {
          expect(parse({ [field]: value }).success, `${field}=${String(value)}`).toBe(false);
        }
      }
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
      expect(result).toEqual(validOutput);
      expect(Object.keys(result).sort()).toEqual(OUTPUT_KEYS);
    });
  });

  it("todos los mensajes de error están en español", () => {
    const result = registrationSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0]).sort()).toEqual([
        "company",
        "crmInterest",
        "fullName",
        "gpsInterest",
        "guestSuggestion",
        "phone",
        "trainingArea",
      ]);
      for (const issue of result.error.issues) {
        expect(issue.message, issue.message).not.toMatch(/^(Invalid|Required|Too |Expected)/);
      }
    }
  });
});

describe("registrationCheckSchema", () => {
  it("usa Perú por defecto y devuelve el celular en E.164", () => {
    expect(registrationCheckSchema.parse({ phone: "987 654 321" })).toEqual({
      phone: "+51987654321",
    });
  });

  it("normaliza con el prefijo del país elegido", () => {
    expect(registrationCheckSchema.parse({ country: "CL", phone: "9 1234 5678" })).toEqual({
      phone: "+56912345678",
    });
  });

  it("rechaza un celular inválido con el mensaje del país", () => {
    const result = registrationCheckSchema.safeParse({ country: "CL", phone: "812345678" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
        ["phone", phoneErrorMessage("CL")],
      ]);
    }
  });

  it("rechaza un país fuera de la lista y un celular ausente", () => {
    expect(registrationCheckSchema.safeParse({ country: "MX", phone: "987654321" }).success).toBe(
      false,
    );
    expect(registrationCheckSchema.safeParse({ country: "PE" }).success).toBe(false);
  });

  it("no pide ni devuelve las demás respuestas", () => {
    const result = registrationCheckSchema.parse({ ...valid, phone: "987654321" });
    expect(Object.keys(result)).toEqual(["phone"]);
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
  it("acepta un premio y no pide confirmación de cierre", () => {
    expect(spinRequestSchema.parse({ prizeId: "p1" })).toEqual({ prizeId: "p1" });
  });

  it("ignora la clave antigua confirmCloseRegistration", () => {
    expect(spinRequestSchema.parse({ prizeId: "p1", confirmCloseRegistration: true })).toEqual({
      prizeId: "p1",
    });
  });

  it("rechaza un premio vacío o ausente", () => {
    expect(spinRequestSchema.safeParse({ prizeId: "" }).success).toBe(false);
    expect(spinRequestSchema.safeParse({}).success).toBe(false);
  });
});
