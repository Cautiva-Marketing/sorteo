import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFirestore } from "./helpers";
import { POST } from "@/app/api/registrations/route";
import { POST as CHECK } from "@/app/api/registrations/check/route";
import { getDb } from "@/services/firebase/admin";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

function body(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "José Núñez Güemes",
    phone: "987654321",
    company: "Cautiva Marketing",
    trainingArea: "Ventas y atención al cliente",
    guestSuggestion: "Un experto en marketing digital",
    crmInterest: "no",
    gpsInterest: "no",
    ...overrides,
  };
}

function checkRequest(payload: unknown): Request {
  return new Request("http://localhost:3000/api/registrations/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function registrationRequest(payload: unknown): Request {
  return new Request("http://localhost:3000/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function participantDocs() {
  return (await getDb().collection("participants").get()).docs;
}

beforeEach(async () => {
  await clearFirestore();
});

describe("registros duplicados por celular", () => {
  it("reconoce el mismo celular en otros formatos y con otro nombre (409 ALREADY_REGISTERED)", async () => {
    const first = await POST(registrationRequest(body()));
    expect(first.status).toBe(201);

    const variants = [
      body({ phone: "+51 987-654321" }),
      body({ phone: "51987654321", fullName: "Otra Persona" }),
      body({ phone: "(+51) 987 654 321", company: "Otra Empresa" }),
    ];
    for (const variant of variants) {
      const response = await POST(registrationRequest(variant));
      expect(response.status).toBe(409);
      const text = await response.text();
      const json = JSON.parse(text) as { code: string };
      expect(json.code).toBe("ALREADY_REGISTERED");
      // No revela datos del registro existente.
      expect(text).not.toContain("Núñez");
      expect(text).not.toContain("Cautiva");
      expect(text).not.toContain("987654321");
    }

    const docs = await participantDocs();
    expect(docs).toHaveLength(1);
    // El registro original no se modificó.
    expect(docs[0]?.data()).toMatchObject({
      fullName: "José Núñez Güemes",
      company: "Cautiva Marketing",
    });
  });

  it("el mismo número local en dos países son dos participantes", async () => {
    const peru = await POST(registrationRequest(body({ country: "PE", phone: "987654321" })));
    const chile = await POST(registrationRequest(body({ country: "CL", phone: "987654321" })));

    expect(peru.status).toBe(201);
    expect(chile.status).toBe(201);
    const ids = (await participantDocs()).map((doc) => doc.id).sort();
    expect(ids).toEqual(["+51987654321", "+56987654321"]);
  });

  it("con el 0 troncal el mismo número de Paraguay es el mismo registro", async () => {
    const first = await POST(registrationRequest(body({ country: "PY", phone: "981 123 456" })));
    const second = await POST(registrationRequest(body({ country: "PY", phone: "0981 123 456" })));

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(((await second.json()) as { code: string }).code).toBe("ALREADY_REGISTERED");
    expect(await participantDocs()).toHaveLength(1);
  });

  it("un participante del formato anterior (+51…) no puede registrarse de nuevo", async () => {
    await getDb().collection("participants").doc("+51987654321").set({
      fullName: "José Núñez Güemes",
      phone: "+51987654321",
      company: "Cautiva Marketing",
      createdAt: new Date(),
      drawId: null,
    });

    const response = await POST(registrationRequest(body({ country: "PE" })));
    expect((await CHECK(checkRequest({ country: "PE", phone: "987654321" }))).status).toBe(409);

    expect(response.status).toBe(409);
    expect(await participantDocs()).toHaveLength(1);
  });

  it("un duplicado con otras cuatro respuestas no modifica ninguna de las guardadas", async () => {
    const first = await POST(registrationRequest(body()));
    expect(first.status).toBe(201);

    const second = await POST(
      registrationRequest(
        body({
          trainingArea: "Finanzas",
          guestSuggestion: "Otra persona",
          crmInterest: "yes",
          gpsInterest: "yes",
        }),
      ),
    );

    expect(second.status).toBe(409);
    const stored = (await getDb().collection("participants").doc("+51987654321").get()).data();
    expect(stored).toMatchObject({
      trainingArea: "Ventas y atención al cliente",
      guestSuggestion: "Un experto en marketing digital",
      crmInterest: "no",
      gpsInterest: "no",
    });
  });

  it("carrera: el celular estaba libre al comprobar el paso 1 pero otra persona lo registra antes del envío", async () => {
    const check = await CHECK(checkRequest({ phone: "987654321" }));
    expect(check.status).toBe(200);

    const other = await POST(
      registrationRequest(body({ fullName: "Otra Persona", crmInterest: "yes" })),
    );
    expect(other.status).toBe(201);

    const late = await POST(registrationRequest(body({ crmInterest: "no" })));
    expect(late.status).toBe(409);
    expect(((await late.json()) as { code: string }).code).toBe("ALREADY_REGISTERED");
    const docs = await participantDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.data()).toMatchObject({ fullName: "Otra Persona", crmInterest: "yes" });
  });

  it("10 envíos simultáneos con el mismo celular crean exactamente 1 documento", async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        POST(registrationRequest(body({ fullName: `Persona Número${"ABCDEFGHIJ"[index]}` }))),
      ),
    );

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(9);
    expect(await participantDocs()).toHaveLength(1);
  });
});
