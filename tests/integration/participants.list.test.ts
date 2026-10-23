import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthUsers,
  clearFirestore,
  createSessionCookieValue,
  seedParticipants,
  seedRegistrationStatus,
  sessionCookieHeader,
} from "./helpers";
import { PUT } from "@/app/api/admin/registration/route";
import { getDb } from "@/services/firebase/admin";
import { countParticipants, listParticipants } from "@/services/participants.service";
import { getRegistrationStatus } from "@/services/registration-status.service";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

function registrationRequest(
  body: unknown,
  headers: Record<string, string> = {},
  rawBody?: string,
): Request {
  return new Request("http://localhost:3000/api/admin/registration", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: rawBody ?? JSON.stringify(body),
  });
}

async function isOpenInDatabase(): Promise<boolean | undefined> {
  const snapshot = await getDb().collection("settings").doc("registration").get();
  return snapshot.data()?.open as boolean | undefined;
}

beforeAll(async () => {
  await clearAuthUsers();
});

beforeEach(async () => {
  await clearFirestore();
});

describe("listParticipants / countParticipants", () => {
  it("lista vacía y conteo 0 sin participantes", async () => {
    expect(await listParticipants()).toEqual([]);
    expect(await countParticipants()).toBe(0);
  });

  it("ordena por createdAt descendente y devuelve el celular en 9 dígitos", async () => {
    const phones = await seedParticipants(5);

    const rows = await listParticipants();

    expect(rows).toHaveLength(5);
    // El participante 4 es el más reciente.
    expect(rows.map((row) => row.phone)).toEqual(
      [...phones].reverse().map((phone) => phone.replace("+51", "")),
    );
    const times = rows.map((row) => row.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(rows[0]).toEqual({
      fullName: "Participante E",
      phone: phones[4]?.replace("+51", ""),
      company: "Empresa E",
      createdAt: expect.any(Date),
      drawId: null,
    });
    // Minimización: no se exponen otros campos.
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "company",
      "createdAt",
      "drawId",
      "fullName",
      "phone",
    ]);
  });

  it("countParticipants coincide con el total", async () => {
    await seedParticipants(7);

    expect(await countParticipants()).toBe(7);
    expect((await listParticipants()).length).toBe(7);
  });
});

describe("PUT /api/admin/registration", () => {
  it("200: con sesión admin cambia settings/registration.open y devuelve open y updatedAt", async () => {
    await seedRegistrationStatus(true);
    const cookie = await createSessionCookieValue("admin@example.com", { admin: true });

    const closed = await PUT(
      registrationRequest({ open: false }, { cookie: sessionCookieHeader(cookie) }),
    );

    expect(closed.status).toBe(200);
    const closedBody = await closed.json();
    expect(closedBody.open).toBe(false);
    expect(new Date(closedBody.updatedAt).toString()).not.toBe("Invalid Date");
    expect(await isOpenInDatabase()).toBe(false);
    expect((await getRegistrationStatus()).open).toBe(false);

    const reopened = await PUT(
      registrationRequest({ open: true }, { cookie: sessionCookieHeader(cookie) }),
    );
    expect(reopened.status).toBe(200);
    expect((await reopened.json()).open).toBe(true);
    expect(await isOpenInDatabase()).toBe(true);
  });

  it("401 UNAUTHORIZED: sin sesión no cambia nada", async () => {
    await seedRegistrationStatus(true);

    const response = await PUT(registrationRequest({ open: false }));

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(await isOpenInDatabase()).toBe(true);
  });

  it("403 FORBIDDEN: sesión de un usuario sin claim admin", async () => {
    await seedRegistrationStatus(true);
    const cookie = await createSessionCookieValue("normal@example.com", { admin: false });

    const response = await PUT(
      registrationRequest({ open: false }, { cookie: sessionCookieHeader(cookie) }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("FORBIDDEN");
    expect(await isOpenInDatabase()).toBe(true);
  });

  it("403 FORBIDDEN: un encabezado Origin ajeno se rechaza aun con sesión admin", async () => {
    await seedRegistrationStatus(true);
    const cookie = await createSessionCookieValue("admin@example.com", { admin: true });

    const response = await PUT(
      registrationRequest(
        { open: false },
        { cookie: sessionCookieHeader(cookie), Origin: "https://otro.example" },
      ),
    );

    expect(response.status).toBe(403);
    expect(await isOpenInDatabase()).toBe(true);
  });

  it("400 VALIDATION_ERROR: cuerpo sin booleano o que no es JSON", async () => {
    await seedRegistrationStatus(true);
    const cookie = await createSessionCookieValue("admin@example.com", { admin: true });
    const headers = { cookie: sessionCookieHeader(cookie) };

    const wrongType = await PUT(registrationRequest({ open: "no" }, headers));
    expect(wrongType.status).toBe(400);
    const body = await wrongType.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.fieldErrors.open).toBeDefined();

    const notJson = await PUT(registrationRequest(undefined, headers, "no es json"));
    expect(notJson.status).toBe(400);
    expect(await isOpenInDatabase()).toBe(true);
  });
});
