import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { E2E_ADMIN, loginAsAdmin } from "./helpers/admin";
import {
  createAdminUser,
  resetFirestore,
  seedParticipant,
  seedParticipants,
  seedPrize,
  setRegistrationOpen,
} from "./helpers/emulators";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(120_000);
const BOM = String.fromCharCode(0xfeff);
test.use({ actionTimeout: 30_000 });

test.beforeAll(async () => {
  await createAdminUser(E2E_ADMIN.email, E2E_ADMIN.password, { admin: true });
});

test.beforeEach(async () => {
  await resetFirestore();
});

test("con una búsqueda activa, «Exportar CSV» descarga la lista completa y neutraliza fórmulas", async ({
  page,
}) => {
  await seedParticipants(3);
  await seedParticipant({
    fullName: "José Núñez Güemes",
    phone: "+51987654321",
    company: "=1+1",
    trainingArea: "=HYPERLINK(1)",
    guestSuggestion: "Un experto",
    crmInterest: "no",
    gpsInterest: "no",
    // 2026-10-21 15:15:30 en Lima.
    createdAt: new Date("2026-10-21T20:15:30.000Z"),
  });
  await seedParticipant({
    fullName: "Ana Quispe",
    phone: "+51912345678",
    company: "Ventas, Marketing",
    trainingArea: "Liderazgo, ventas",
    guestSuggestion: "Una emprendedora",
    crmInterest: "maybe",
    gpsInterest: "yes",
    createdAt: new Date("2026-10-20T20:15:30.000Z"),
  });
  await loginAsAdmin(page);

  // Búsqueda activa que deja una sola coincidencia.
  await page.getByLabel("Buscar por nombre, celular o empresa").fill("nunez");
  await expect(page.getByText("Coincidencias: 1")).toBeVisible();
  await expect(page.getByText("Exporta siempre la lista completa")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^participantes-\d{8}\.csv$/);
  const path = await download.path();
  const bytes = await readFile(path);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = bytes.toString("utf8").replace(BOM, "").split("\r\n");
  expect(lines[0]).toBe(
    "Nombres,Celular (con código de país),Empresa u ocupación,Área de capacitación,Invitado sugerido,CRM con Agente IA,GPS / cámara,Fecha de registro,Premio,N.º de ganador,Estado",
  );
  // Lista completa: 5 participantes aunque la búsqueda deje 1.
  expect(lines).toHaveLength(1 + 5);
  expect(lines).toContain(
    "José Núñez Güemes,51 987654321,'=1+1,'=HYPERLINK(1),Un experto,No,No,2026-10-21 15:15:30,,,",
  );
  expect(lines).toContain(
    'Ana Quispe,51 912345678,"Ventas, Marketing","Liderazgo, ventas",Una emprendedora,Tal vez,Sí,2026-10-20 15:15:30,,,',
  );
  // Los participantes sin respuestas nuevas (registros anteriores) dejan esas celdas vacías.
  const legacy = lines.filter((line) => line.startsWith("Jose Participante"));
  expect(legacy).toHaveLength(3);
  for (const line of legacy) {
    expect(line).toMatch(/^Jose Participante[A-Z]+,51 9\d{8},Empresa [A-Z]+,,,No,,\d{4}-/);
  }
});

test("con 0 participantes el botón está deshabilitado y se informa «No hay datos para exportar»", async ({
  page,
}) => {
  await loginAsAdmin(page);

  await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveCount(0);
  await expect(page.getByText("No hay datos para exportar")).toBeVisible();
});

test("quien ganó sale en el CSV con su premio, número y estado", async ({ page }) => {
  await seedParticipants(4);
  await seedPrize({ name: "Alexa", quantity: 1 });
  await setRegistrationOpen(false);
  await loginAsAdmin(page);
  await page.goto("/admin/sorteo");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Girar para: Alexa" }).click();
  await expect(page.getByRole("dialog", { name: "¡Ganador #1!" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.goto("/admin/ganadores");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("region", { name: "Historial de ganadores" })).toContainText(
    "Premio: Alexa",
  );

  const response = await page.request.get("/api/admin/participants/export");
  const lines = (await response.text()).replace(BOM, "").split("\r\n");
  expect(lines[0]).toBe(
    "Nombres,Celular (con código de país),Empresa u ocupación,Área de capacitación,Invitado sugerido,CRM con Agente IA,GPS / cámara,Fecha de registro,Premio,N.º de ganador,Estado",
  );
  expect(lines).toHaveLength(1 + 4);
  expect(lines.filter((line) => line.endsWith(",Alexa,1,Ganador"))).toHaveLength(1);
  expect(lines.filter((line) => line.endsWith(",,,"))).toHaveLength(3);
});
