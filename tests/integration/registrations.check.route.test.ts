import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFirestore, seedRegistrationStatus } from "./helpers";
import { POST as CHECK } from "@/app/api/registrations/check/route";
import { POST as REGISTER } from "@/app/api/registrations/route";
import { getDb } from "@/services/firebase/admin";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const registration = {
  fullName: "José Núñez Güemes",
  phone: "987 654 321",
  company: "Cautiva Marketing",
  trainingArea: "Ventas y atención al cliente",
  guestSuggestion: "Un experto en marketing digital",
  crmInterest: "maybe",
  gpsInterest: "no",
};

function checkRequest(
  body: unknown,
  headers: Record<string, string> = {},
  rawBody?: string,
): Request {
  return new Request("http://localhost:3000/api/registrations/check", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: rawBody ?? JSON.stringify(body),
  });
}

async function register(overrides: Record<string, unknown> = {}): Promise<void> {
  const response = await REGISTER(
    new Request("http://localhost:3000/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...registration, ...overrides }),
    }),
  );
  expect(response.status).toBe(201);
}

async function participantCount(): Promise<number> {
  return (await getDb().collection("participants").count().get()).data().count;
}

beforeEach(async () => {
  await clearFirestore();
});

describe("POST /api/registrations/check", () => {
  it("200 available: un celular libre con las inscripciones abiertas, sin escribir nada", async () => {
    const response = await CHECK(checkRequest({ phone: "987 654 321" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "available" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await participantCount()).toBe(0);
    // Tampoco crea ni modifica la configuración de la campaña.
    expect((await getDb().collection("settings").doc("registration").get()).exists).toBe(false);
  });

  it("409 ALREADY_REGISTERED: un celular ya registrado, también escrito de otra forma", async () => {
    await register();

    for (const phone of ["987 654 321", "+51 987-654-321", "51987654321", "(+51) 987 654 321"]) {
      const response = await CHECK(checkRequest({ phone }));
      expect(response.status, phone).toBe(409);
      expect(((await response.json()) as { code: string }).code).toBe("ALREADY_REGISTERED");
    }
  });

  it("el cuerpo del 409 no revela datos del registro existente", async () => {
    await register();

    const text = await (await CHECK(checkRequest({ phone: "987654321" }))).text();

    for (const secret of [
      "Núñez",
      "Cautiva",
      "987654321",
      "Ventas",
      "marketing digital",
      "maybe",
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("200: el mismo número local en otro país es otro participante", async () => {
    await register();

    const response = await CHECK(checkRequest({ country: "CL", phone: "987654321" }));

    expect(response.status).toBe(200);
  });

  it("403 REGISTRATION_CLOSED: con las inscripciones cerradas, aunque el celular esté libre", async () => {
    await seedRegistrationStatus(false);

    const response = await CHECK(checkRequest({ phone: "987654321" }));

    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("REGISTRATION_CLOSED");
  });

  it("403 REGISTRATION_CLOSED tiene prioridad sobre el duplicado", async () => {
    await register();
    await seedRegistrationStatus(false);

    const response = await CHECK(checkRequest({ phone: "987654321" }));

    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("REGISTRATION_CLOSED");
  });

  it("400 VALIDATION_ERROR: un celular inválido para el país da fieldErrors.phone", async () => {
    const response = await CHECK(checkRequest({ country: "CL", phone: "812345678" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string; fieldErrors: Record<string, string[]> };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.fieldErrors)).toEqual(["phone"]);
    expect(body.fieldErrors.phone?.[0]).toMatch(/chileno/i);
  });

  it("400 VALIDATION_ERROR: un país fuera de la lista o un celular ausente", async () => {
    const badCountry = await CHECK(checkRequest({ country: "MX", phone: "987654321" }));
    expect(badCountry.status).toBe(400);
    expect(Object.keys(((await badCountry.json()) as { fieldErrors: object }).fieldErrors)).toEqual(
      ["country"],
    );

    const noPhone = await CHECK(checkRequest({ country: "PE" }));
    expect(noPhone.status).toBe(400);
  });

  it("400 VALIDATION_ERROR: un cuerpo que no es JSON se rechaza", async () => {
    const response = await CHECK(checkRequest(undefined, {}, "no es json"));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe("VALIDATION_ERROR");
  });

  it("no exige las demás respuestas: solo país y celular", async () => {
    const response = await CHECK(
      checkRequest({ phone: "987654321", trainingArea: "", crmInterest: "no sé" }),
    );

    expect(response.status).toBe(200);
  });

  it("403 FORBIDDEN: un encabezado Origin ajeno se rechaza", async () => {
    const response = await CHECK(
      checkRequest({ phone: "987654321" }, { Origin: "https://otro.example" }),
    );

    expect(response.status).toBe(403);
    expect(((await response.json()) as { code: string }).code).toBe("FORBIDDEN");
  });
});
