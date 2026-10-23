import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFirestore, seedRegistrationStatus } from "./helpers";
import { POST } from "@/app/api/registrations/route";
import { getDb } from "@/services/firebase/admin";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const validBody = {
  fullName: "José Núñez Güemes",
  phone: "987 654 321",
  company: "Cautiva Marketing",
  trainingArea: "Ventas y atención al cliente",
  guestSuggestion: "Un experto en marketing digital",
  crmInterest: "maybe",
  gpsInterest: "no",
};

/** Campos de respuesta del paso 2: todos obligatorios. */
const ANSWER_FIELDS = ["trainingArea", "guestSuggestion", "crmInterest", "gpsInterest"] as const;

function registrationRequest(
  body: unknown,
  headers: Record<string, string> = {},
  rawBody?: string,
): Request {
  return new Request("http://localhost:3000/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: rawBody ?? JSON.stringify(body),
  });
}

async function participantCount(): Promise<number> {
  return (await getDb().collection("participants").count().get()).data().count;
}

beforeEach(async () => {
  await clearFirestore();
});

describe("POST /api/registrations", () => {
  it("201: guarda el participante con el celular E.164 como ID y sin consentimiento", async () => {
    const response = await POST(registrationRequest(validBody));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "registered" });

    const snapshot = await getDb().collection("participants").doc("+51987654321").get();
    expect(snapshot.exists).toBe(true);
    const data = snapshot.data();
    expect(data).toMatchObject({
      fullName: "José Núñez Güemes",
      phone: "+51987654321",
      company: "Cautiva Marketing",
      trainingArea: "Ventas y atención al cliente",
      guestSuggestion: "Un experto en marketing digital",
      crmInterest: "maybe",
      gpsInterest: "no",
      drawId: null,
    });
    // Marca de tiempo de Firestore (el servidor fija la hora).
    expect(data?.createdAt.toDate()).toBeInstanceOf(Date);
    // Minimización de datos: solo los campos permitidos y sin evidencia de consentimiento.
    expect(Object.keys(data ?? {}).sort()).toEqual([
      "company",
      "createdAt",
      "crmInterest",
      "drawId",
      "fullName",
      "gpsInterest",
      "guestSuggestion",
      "phone",
      "trainingArea",
    ]);
  });

  it("201: sin el país crea el documento +51… (Perú por defecto)", async () => {
    const response = await POST(registrationRequest({ ...validBody, phone: "987 654 321" }));
    expect(response.status).toBe(201);
    expect((await getDb().collection("participants").doc("+51987654321").get()).exists).toBe(true);
  });

  it("201: con country CL, un solo nombre y 9 1234 5678 crea participants/+56912345678", async () => {
    const response = await POST(
      registrationRequest({ ...validBody, fullName: "María", country: "CL", phone: "9 1234 5678" }),
    );

    expect(response.status).toBe(201);
    const snapshot = await getDb().collection("participants").doc("+56912345678").get();
    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toMatchObject({ fullName: "María", phone: "+56912345678" });
    expect(snapshot.data()).not.toHaveProperty("country");
  });

  it("201: guarda tal cual cada combinación de Sí / Tal vez / No", async () => {
    const combos = [
      ["yes", "no", "+51987654321", "987 654 321"],
      ["maybe", "yes", "+51912345678", "912 345 678"],
      ["no", "maybe", "+51923456789", "923 456 789"],
    ] as const;
    for (const [crmInterest, gpsInterest, , phone] of combos) {
      const response = await POST(
        registrationRequest({ ...validBody, phone, crmInterest, gpsInterest }),
      );
      expect(response.status).toBe(201);
    }
    for (const [crmInterest, gpsInterest, id] of combos) {
      const data = (await getDb().collection("participants").doc(id).get()).data();
      expect(data).toMatchObject({ crmInterest, gpsInterest });
    }
  });

  it("201: un texto con saltos de línea y espacios repetidos se guarda en una sola línea", async () => {
    const response = await POST(
      registrationRequest({
        ...validBody,
        trainingArea: "  Ventas\n  y \t marketing ",
        guestSuggestion: "Un\r\nexperto",
      }),
    );
    expect(response.status).toBe(201);
    const data = (await getDb().collection("participants").doc("+51987654321").get()).data();
    expect(data?.trainingArea).toBe("Ventas y marketing");
    expect(data?.guestSuggestion).toBe("Un experto");
  });

  it("201: un texto con etiquetas HTML se guarda tal cual, como texto plano", async () => {
    const html = "<script>alert(1)</script>";
    const response = await POST(registrationRequest({ ...validBody, trainingArea: html }));
    expect(response.status).toBe(201);
    const data = (await getDb().collection("participants").doc("+51987654321").get()).data();
    expect(data?.trainingArea).toBe(html);
  });

  it("400 VALIDATION_ERROR: cada respuesta ausente se informa en su campo y no guarda nada", async () => {
    for (const field of ANSWER_FIELDS) {
      const body = Object.fromEntries(Object.entries(validBody).filter(([key]) => key !== field));
      const response = await POST(registrationRequest(body));
      expect(response.status, field).toBe(400);
      const json = await response.json();
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(Object.keys(json.fieldErrors), field).toEqual([field]);
    }
    expect(await participantCount()).toBe(0);
  });

  it("400 VALIDATION_ERROR: respuestas de texto vacías, de 1 o de 101 caracteres se rechazan", async () => {
    for (const field of ["trainingArea", "guestSuggestion"] as const) {
      for (const value of ["", "   ", "a", "a".repeat(101)]) {
        const response = await POST(registrationRequest({ ...validBody, [field]: value }));
        expect(response.status, `${field}=${value.length}`).toBe(400);
        expect(Object.keys((await response.json()).fieldErrors)).toEqual([field]);
      }
    }
    expect(await participantCount()).toBe(0);
  });

  it("400 VALIDATION_ERROR: un interés fuera de yes / maybe / no se rechaza", async () => {
    for (const field of ["crmInterest", "gpsInterest"] as const) {
      for (const value of ["si", "YES", true, false, 1, null]) {
        const response = await POST(registrationRequest({ ...validBody, [field]: value }));
        expect(response.status, `${field}=${String(value)}`).toBe(400);
        const json = await response.json();
        expect(json.fieldErrors[field]).toEqual(["Elige una opción."]);
      }
    }
    expect(await participantCount()).toBe(0);
  });

  it("400 VALIDATION_ERROR: el cuerpo anterior (casilla booleana, sin las demás respuestas) no registra", async () => {
    const response = await POST(
      registrationRequest({
        fullName: "José Núñez Güemes",
        phone: "987 654 321",
        company: "Cautiva Marketing",
        crmInterest: true,
      }),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(Object.keys(json.fieldErrors).sort()).toEqual([
      "crmInterest",
      "gpsInterest",
      "guestSuggestion",
      "trainingArea",
    ]);
    expect(await participantCount()).toBe(0);
  });

  it("400 VALIDATION_ERROR: un celular inválido para el país elegido da fieldErrors.phone", async () => {
    const response = await POST(
      registrationRequest({ ...validBody, country: "CL", phone: "812345678" }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.fieldErrors.phone[0]).toMatch(/chileno/i);
    expect(await participantCount()).toBe(0);
  });

  it("400 VALIDATION_ERROR: un país fuera de Sudamérica se rechaza", async () => {
    const response = await POST(registrationRequest({ ...validBody, country: "MX" }));
    expect(response.status).toBe(400);
    expect(await participantCount()).toBe(0);
  });

  it("201: sin la cabecera X-Firebase-AppCheck (ya no se exige ninguna verificación)", async () => {
    const response = await POST(registrationRequest(validBody));
    expect(response.status).toBe(201);
    expect(await participantCount()).toBe(1);
  });

  it("201: ignora consent y consentVersion si llegan y no los guarda", async () => {
    const response = await POST(
      registrationRequest({ ...validBody, consent: true, consentVersion: "2026-10-v1" }),
    );

    expect(response.status).toBe(201);
    const data = (await getDb().collection("participants").doc("+51987654321").get()).data();
    expect(data).not.toHaveProperty("consent");
    expect(data).not.toHaveProperty("consentVersion");
  });

  it("201: sin ningún documento settings/registration las inscripciones se consideran abiertas", async () => {
    const settings = await getDb().collection("settings").doc("registration").get();
    expect(settings.exists).toBe(false);
    const response = await POST(registrationRequest(validBody));
    expect(response.status).toBe(201);
  });

  it("400 VALIDATION_ERROR: devuelve fieldErrors en español y no guarda nada", async () => {
    const response = await POST(
      registrationRequest({
        ...validBody,
        fullName: "A",
        phone: "812345678",
        company: "A",
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.fieldErrors).sort()).toEqual(["company", "fullName", "phone"]);
    // Las respuestas del paso 2 son válidas: no aparecen entre los errores.
    expect(body.fieldErrors.phone[0]).toMatch(/celular/i);
    expect(await participantCount()).toBe(0);
  });

  it("400 VALIDATION_ERROR: un cuerpo que no es JSON se rechaza", async () => {
    const response = await POST(registrationRequest(undefined, {}, "no es json"));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("VALIDATION_ERROR");
  });

  it("403 REGISTRATION_CLOSED: con inscripciones cerradas no guarda nada", async () => {
    await seedRegistrationStatus(false);

    const response = await POST(registrationRequest(validBody));

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("REGISTRATION_CLOSED");
    expect(await participantCount()).toBe(0);
  });

  it("403 FORBIDDEN: un encabezado Origin ajeno se rechaza", async () => {
    const response = await POST(registrationRequest(validBody, { Origin: "https://otro.example" }));

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("FORBIDDEN");
    expect(await participantCount()).toBe(0);
  });

  it("no filtra datos personales en la respuesta de éxito", async () => {
    const response = await POST(registrationRequest(validBody));
    const text = await response.text();
    expect(text).not.toContain("987654321");
    expect(text).not.toContain("Núñez");
  });
});
