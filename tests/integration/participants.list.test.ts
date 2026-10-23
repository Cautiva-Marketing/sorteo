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
import {
  countParticipants,
  listParticipants,
  listParticipantsForExport,
} from "@/services/participants.service";
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

  it("ordena por createdAt descendente y devuelve el celular en E.164", async () => {
    const phones = await seedParticipants(5);

    const rows = await listParticipants();

    expect(rows).toHaveLength(5);
    // El participante 4 es el más reciente.
    expect(rows.map((row) => row.phone)).toEqual([...phones].reverse());
    const times = rows.map((row) => row.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(rows[0]).toEqual({
      fullName: "Participante E",
      phone: phones[4],
      company: "Empresa E",
      createdAt: expect.any(Date),
      crmInterest: "no",
      gpsInterest: null,
      drawId: null,
    });
    // Minimización: los textos libres del paso 2 no salen de `listParticipants`.
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "company",
      "createdAt",
      "crmInterest",
      "drawId",
      "fullName",
      "gpsInterest",
      "phone",
    ]);
  });

  it("devuelve el CRM y el GPS / cámara tal como se guardaron, sin los textos libres", async () => {
    const answers = [
      ["+51900000001", "yes", "maybe", "2026-10-21T10:00:00.000Z"],
      ["+51900000002", "maybe", "no", "2026-10-20T10:00:00.000Z"],
      ["+51900000003", "no", "yes", "2026-10-19T10:00:00.000Z"],
    ] as const;
    for (const [phone, crmInterest, gpsInterest, createdAt] of answers) {
      await getDb()
        .collection("participants")
        .doc(phone)
        .set({
          fullName: "Con Respuestas",
          phone,
          company: "Empresa",
          trainingArea: "Ventas",
          guestSuggestion: "Un experto",
          crmInterest,
          gpsInterest,
          createdAt: new Date(createdAt),
          drawId: null,
        });
    }

    const rows = await listParticipants();

    expect(rows.map((row) => [row.phone, row.crmInterest, row.gpsInterest])).toEqual([
      ["+51900000001", "yes", "maybe"],
      ["+51900000002", "maybe", "no"],
      ["+51900000003", "no", "yes"],
    ]);
    for (const row of rows) {
      expect(row).not.toHaveProperty("trainingArea");
      expect(row).not.toHaveProperty("guestSuggestion");
    }
  });

  it("normaliza los documentos anteriores: casilla true es yes, false o sin campo es no, GPS es null", async () => {
    const db = getDb();
    const base = { company: "Empresa", drawId: null };
    await db
      .collection("participants")
      .doc("+51900000001")
      .set({
        ...base,
        fullName: "Casilla Marcada",
        phone: "+51900000001",
        crmInterest: true,
        createdAt: new Date("2026-10-21T10:00:00.000Z"),
      });
    await db
      .collection("participants")
      .doc("+51900000002")
      .set({
        ...base,
        fullName: "Casilla Sin Marcar",
        phone: "+51900000002",
        crmInterest: false,
        createdAt: new Date("2026-10-20T10:00:00.000Z"),
      });
    await db
      .collection("participants")
      .doc("+56912345678")
      .set({
        ...base,
        fullName: "Sin Campo",
        phone: "+56912345678",
        createdAt: new Date("2026-10-19T10:00:00.000Z"),
      });

    const rows = await listParticipants();

    expect(rows.map((row) => [row.phone, row.crmInterest, row.gpsInterest])).toEqual([
      ["+51900000001", "yes", null],
      ["+51900000002", "no", null],
      ["+56912345678", "no", null],
    ]);
  });

  it("un valor guardado que no es válido se trata como sin respuesta", async () => {
    await getDb()
      .collection("participants")
      .doc("+51900000001")
      .set({
        fullName: "Dato Raro",
        phone: "+51900000001",
        company: "Empresa",
        crmInterest: "quizás",
        gpsInterest: "quizás",
        createdAt: new Date("2026-10-21T10:00:00.000Z"),
        drawId: null,
      });

    const [row] = await listParticipants();

    expect(row?.crmInterest).toBe("no");
    expect(row?.gpsInterest).toBeNull();
  });

  it("listParticipantsForExport añade el área de capacitación y el invitado (vacíos en los anteriores)", async () => {
    await getDb()
      .collection("participants")
      .doc("+51900000001")
      .set({
        fullName: "Con Respuestas",
        phone: "+51900000001",
        company: "Empresa",
        trainingArea: "Ventas y atención",
        guestSuggestion: "Un experto",
        crmInterest: "maybe",
        gpsInterest: "yes",
        createdAt: new Date("2026-10-21T10:00:00.000Z"),
        drawId: null,
      });
    await getDb()
      .collection("participants")
      .doc("+51900000002")
      .set({
        fullName: "Anterior",
        phone: "+51900000002",
        company: "Empresa",
        crmInterest: true,
        createdAt: new Date("2026-10-20T10:00:00.000Z"),
        drawId: null,
      });

    const rows = await listParticipantsForExport();

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      trainingArea: "Ventas y atención",
      guestSuggestion: "Un experto",
      crmInterest: "maybe",
      gpsInterest: "yes",
    });
    expect(rows[1]).toMatchObject({
      trainingArea: "",
      guestSuggestion: "",
      crmInterest: "yes",
      gpsInterest: null,
    });
    // Sin ningún campo más (p. ej. consent).
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
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
