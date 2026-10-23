import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthUsers,
  clearFirestore,
  createSessionCookieValue,
  seedLegacyDraw,
  seedParticipants,
  seedPrize,
  seedRegistrationStatus,
  sessionCookieHeader,
} from "./helpers";
import { GET } from "@/app/api/admin/participants/export/route";
import { formatLimaDateTime } from "@/lib/format";
import { formatPhoneCsv } from "@/lib/validation/phone";
import { getDb } from "@/services/firebase/admin";
import { discardSpin, spin } from "@/services/spins.service";

// La primera llamada a Firestore del proceso tarda varios segundos con el emulador.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const BOM = String.fromCharCode(0xfeff);
const HEADER =
  "Nombres,Celular (con código de país),Empresa u ocupación,Área de capacitación,Invitado sugerido,CRM con Agente IA,GPS / cámara,Fecha de registro,Premio,N.º de ganador,Estado";

function exportRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/admin/participants/export", {
    method: "GET",
    headers,
  });
}

beforeAll(async () => {
  await clearAuthUsers();
});

beforeEach(async () => {
  await clearFirestore();
});

describe("GET /api/admin/participants/export", () => {
  it("sin sesión responde 401 UNAUTHORIZED y no devuelve datos", async () => {
    await seedParticipants(2);

    const response = await GET(exportRequest());

    expect(response.status).toBe(401);
    expect(((await response.json()) as { code: string }).code).toBe("UNAUTHORIZED");
  });

  it("con una cuenta sin claim admin responde 403 FORBIDDEN", async () => {
    const cookie = await createSessionCookieValue("normal-export@example.com", { admin: false });

    const response = await GET(exportRequest({ cookie: sessionCookieHeader(cookie) }));

    expect(response.status).toBe(403);
  });

  it("con sesión admin responde el CSV con una fila por participante", async () => {
    await seedParticipants(7);
    const cookie = await createSessionCookieValue("admin-export@example.com", { admin: true });

    const response = await GET(exportRequest({ cookie: sessionCookieHeader(cookie) }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    const stamp = formatLimaDateTime(new Date()).slice(0, 10).replaceAll("-", "");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="participantes-${stamp}.csv"`,
    );

    const bytes = new Uint8Array(await response.arrayBuffer());
    // BOM UTF-8.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder("utf-8", { ignoreBOM: true })
      .decode(bytes)
      .replace(BOM, "")
      .split("\r\n");
    expect(lines[0]).toBe(HEADER);
    expect(lines).toHaveLength(1 + 7);
    // Del más reciente al más antiguo, con el celular con prefijo, el CRM en «No» y sin respuestas nuevas.
    expect(lines[1]).toMatch(
      /^Participante G,51 900000006,Empresa G,,,No,,\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},,,$/,
    );
  });

  it("neutraliza fórmulas, escapa comas y conserva tildes en los datos reales", async () => {
    const createdAt = new Date("2026-10-21T20:15:30.000Z");
    await getDb().collection("participants").doc("+51987654321").set({
      fullName: "José Núñez Güemes",
      phone: "+51987654321",
      company: "=1+1",
      trainingArea: "=HYPERLINK(1)",
      guestSuggestion: "@cmd",
      crmInterest: "no",
      gpsInterest: "no",
      createdAt,
      drawId: null,
    });
    await getDb()
      .collection("participants")
      .doc("+51912345678")
      .set({
        fullName: "Ana Quispe",
        phone: "+51912345678",
        company: "Ventas, Marketing",
        trainingArea: "Liderazgo, ventas",
        guestSuggestion: "Una emprendedora",
        crmInterest: "maybe",
        gpsInterest: "yes",
        createdAt: new Date("2026-10-20T20:15:30.000Z"),
        drawId: null,
      });
    // Documento anterior a la feature 005: casilla booleana y sin las demás respuestas.
    await getDb()
      .collection("participants")
      .doc("+56912345678")
      .set({
        fullName: "Sofía Rojas",
        phone: "+56912345678",
        company: "Tienda Sur",
        crmInterest: true,
        createdAt: new Date("2026-10-19T20:15:30.000Z"),
        drawId: null,
      });
    const cookie = await createSessionCookieValue("admin-export@example.com", { admin: true });

    const response = await GET(exportRequest({ cookie: sessionCookieHeader(cookie) }));

    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      new Uint8Array(await response.arrayBuffer()),
    );
    expect(text.split("\r\n")).toEqual([
      BOM + HEADER,
      "José Núñez Güemes,51 987654321,'=1+1,'=HYPERLINK(1),'@cmd,No,No,2026-10-21 15:15:30,,,",
      'Ana Quispe,51 912345678,"Ventas, Marketing","Liderazgo, ventas",Una emprendedora,Tal vez,Sí,2026-10-20 15:15:30,,,',
      "Sofía Rojas,56 912345678,Tienda Sur,,,Sí,,2026-10-19 15:15:30,,,",
    ]);
  });

  it("un texto libre con etiquetas HTML se exporta como texto, sin transformarlo", async () => {
    await getDb()
      .collection("participants")
      .doc("+51987654321")
      .set({
        fullName: "Ana Pérez",
        phone: "+51987654321",
        company: "Cautiva",
        trainingArea: "<script>alert(1)</script>",
        guestSuggestion: "Un experto",
        crmInterest: "no",
        gpsInterest: "no",
        createdAt: new Date("2026-10-21T20:15:30.000Z"),
        drawId: null,
      });
    const cookie = await createSessionCookieValue("admin-export@example.com", { admin: true });

    const response = await GET(exportRequest({ cookie: sessionCookieHeader(cookie) }));

    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      new Uint8Array(await response.arrayBuffer()),
    );
    expect(text).toContain(",<script>alert(1)</script>,Un experto,");
  });

  it("sin participantes responde solo el encabezado", async () => {
    const cookie = await createSessionCookieValue("admin-export@example.com", { admin: true });

    const response = await GET(exportRequest({ cookie: sessionCookieHeader(cookie) }));

    expect(response.status).toBe(200);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      new Uint8Array(await response.arrayBuffer()),
    );
    expect(text).toBe(BOM + HEADER);
  });
});

describe("columnas de ganadores (feature 003, FR-084)", () => {
  it("trae Premio, N.º de ganador y Estado de giros activos, descartados y rondas antiguas", async () => {
    await seedRegistrationStatus(false);
    const phones = await seedParticipants(6);
    await seedLegacyDraw([phones[0] as string]);
    const prizeId = await seedPrize({ name: "Alexa", quantity: 2 });
    const admin = { uid: "u1", email: "admin@example.com" };
    const first = await spin({ prizeId }, admin);
    const second = await spin({ prizeId }, admin);
    await discardSpin(first.id, admin);
    const winnerPhone = async (spinId: string): Promise<string> => {
      const snapshot = await getDb().collection("spins").doc(spinId).get();
      return String((snapshot.data()?.winner as { phone: string }).phone);
    };
    // El CSV muestra «prefijo número»; el ganador de la ronda antigua se resuelve por sus 9 dígitos.
    const firstPhone = formatPhoneCsv(await winnerPhone(first.id));
    const secondPhone = formatPhoneCsv(await winnerPhone(second.id));
    const cookie = await createSessionCookieValue("admin-export@example.com", { admin: true });

    const response = await GET(exportRequest({ cookie: sessionCookieHeader(cookie) }));

    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      new Uint8Array(await response.arrayBuffer()),
    );
    const [header, ...rows] = text.replace(BOM, "").split("\r\n");
    expect(header).toBe(HEADER);
    expect(rows).toHaveLength(6);
    const byPhone = new Map(
      rows.map((line) => {
        const cells = line.split(",");
        return [cells[1] as string, cells.slice(8).join(",")] as const;
      }),
    );
    expect(byPhone.get("51 900000000")).toBe("Sin premio,1,Ganador");
    expect(byPhone.get(firstPhone)).toBe("Alexa,2,Descartado");
    expect(byPhone.get(secondPhone)).toBe("Alexa,3,Ganador");
    const others = [...byPhone.entries()].filter(
      ([phone]) => !["51 900000000", firstPhone, secondPhone].includes(phone),
    );
    expect(others).toHaveLength(3);
    for (const [, cells] of others) {
      expect(cells).toBe(",,");
    }
  });
});
