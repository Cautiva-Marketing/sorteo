import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFirestore } from "./helpers";
import { POST } from "@/app/api/registrations/route";
import { getDb } from "@/services/firebase/admin";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

function body(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "José Núñez Güemes",
    phone: "987654321",
    company: "Cautiva Marketing",
    ...overrides,
  };
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
