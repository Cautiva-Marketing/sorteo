import { expect, test } from "@playwright/test";
import { E2E_ADMIN, countDocuments, loginAsAdmin } from "./helpers/admin";
import {
  createAdminUser,
  resetFirestore,
  seedParticipants,
  seedPrize,
  setRegistrationOpen,
} from "./helpers/emulators";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(120_000);
test.use({ actionTimeout: 30_000 });

test.beforeAll(async () => {
  await createAdminUser(E2E_ADMIN.email, E2E_ADMIN.password, { admin: true });
});

test.beforeEach(async () => {
  await resetFirestore();
});

test("con inscripciones abiertas el borrado está bloqueado en la página y rechazado por el servidor", async ({
  page,
}) => {
  await seedParticipants(3);
  await loginAsAdmin(page);
  await page.goto("/admin/campana");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Cierre de campaña" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Borrar datos de participantes" })).toBeDisabled();
  await expect(page.getByText("Cierra primero las inscripciones", { exact: true })).toBeVisible();

  // Aunque se salte la interfaz, el servidor rechaza el borrado.
  const response = await page.request.delete("/api/admin/participants", {
    data: { confirm: "BORRAR" },
  });
  expect(response.status()).toBe(409);
  expect(((await response.json()) as { code: string }).code).toBe("REGISTRATION_OPEN");
  expect(await countDocuments("participants")).toBe(3);
});

test("tras girar, borrar exige escribir BORRAR y deja el listado vacío y el historial solo con nombre, número y premio", async ({
  page,
}) => {
  await seedParticipants(6);
  await seedPrize({ name: "Alexa", quantity: 2 });
  await loginAsAdmin(page);

  // Dos giros reales para comprobar qué se conserva; el primero cierra las inscripciones.
  await page.goto("/admin/sorteo");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Girar para: Alexa" }).click();
  await expect(page.getByRole("dialog", { name: "¡Ganador #1!" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Girar para: Alexa" }).click();
  await expect(page.getByRole("dialog", { name: "¡Ganador #2!" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.goto("/admin/ganadores");
  await page.waitForLoadState("networkidle");
  const historyBefore = page.getByRole("region", { name: "Historial de ganadores" });
  await expect(historyBefore.getByText(/Celular: \+51 9\d{2} \d{3} \d{3}/).first()).toBeVisible();
  await expect(historyBefore.getByText(/Empresa u ocupación: Empresa /).first()).toBeVisible();

  // Las inscripciones ya quedaron cerradas con el primer giro: el borrado está disponible.
  await page.goto("/admin/campana");
  await page.waitForLoadState("networkidle");
  const trigger = page.getByRole("button", { name: "Borrar datos de participantes" });
  await expect(page.getByText("Las inscripciones están cerradas")).toBeVisible();
  await expect(trigger).toBeEnabled();

  // El diálogo advierte, sugiere exportar y se puede cerrar con Escape.
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Borrar los datos de los participantes" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/irreversible/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute(
    "href",
    "/api/admin/participants/export",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Exige escribir la frase exacta.
  await trigger.click();
  await expect(dialog).toBeVisible();
  const confirmButton = dialog.getByRole("button", { name: "Borrar definitivamente" });
  await expect(confirmButton).toBeDisabled();
  await dialog.getByLabel("Escribe BORRAR para confirmar").fill("borrar");
  await expect(confirmButton).toBeDisabled();
  await dialog.getByLabel("Escribe BORRAR para confirmar").fill("BORRAR");
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page.getByText("Listo: se eliminaron 6 participantes.")).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(await countDocuments("participants")).toBe(0);

  // El listado queda vacío (conteo 0) y la exportación solo trae el encabezado.
  await page.goto("/admin");
  await expect(page.getByText("Total de participantes: 0")).toBeVisible();
  await expect(page.getByText("Aún no hay participantes")).toBeVisible();
  const csv = await page.request.get("/api/admin/participants/export");
  expect((await csv.text()).replace(String.fromCharCode(0xfeff), "")).toBe(
    "Nombres,Celular (con código de país),Empresa u ocupación,Área de capacitación,Invitado sugerido,CRM con Agente IA,GPS / cámara,Fecha de registro,Premio,N.º de ganador,Estado",
  );

  // El historial conserva número, premio, nombre, fecha y estado, sin celular ni empresa (FR-086).
  await page.goto("/admin/ganadores");
  await page.waitForLoadState("networkidle");
  const history = page.getByRole("region", { name: "Historial de ganadores" });
  await expect(history.getByText(/Datos personales eliminados/)).toBeVisible();
  const winners = history.getByRole("listitem");
  await expect(winners).toHaveCount(2);
  await expect(winners.nth(0)).toContainText("#2");
  await expect(winners.nth(0)).toContainText("Jose Participante");
  await expect(winners.nth(1)).toContainText("#1");
  await expect(winners.nth(1)).toContainText("Jose Participante");
  for (const text of await winners.allTextContents()) {
    expect(text).toContain("Premio: Alexa");
    expect(text).toContain("Ganador");
  }
  await expect(history.getByText(/Celular:/)).toHaveCount(0);
  await expect(history.getByText(/Empresa u ocupación:/)).toHaveCount(0);
  await expect(history.getByText(/\d{9}/)).toHaveCount(0);
  // Sin participantes ya no se puede girar.
  await page.goto("/admin/sorteo");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Participantes elegibles: 0")).toBeVisible();
  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeDisabled();
  await expect(page.getByText("No hay participantes elegibles para sortear.")).toBeVisible();
});

test("si las inscripciones se reabren con el diálogo listo, el servidor rechaza el borrado y se explica", async ({
  page,
}) => {
  await seedParticipants(3);
  await setRegistrationOpen(false);
  await loginAsAdmin(page);
  await page.goto("/admin/campana");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Borrar datos de participantes" }).click();
  const dialog = page.getByRole("dialog", { name: "Borrar los datos de los participantes" });
  await dialog.getByLabel("Escribe BORRAR para confirmar").fill("BORRAR");

  // Otro administrador reabre las inscripciones mientras tanto.
  await setRegistrationOpen(true);
  await dialog.getByRole("button", { name: "Borrar definitivamente" }).click();

  await expect(dialog.getByText("Cierra primero las inscripciones.")).toBeVisible();
  expect(await countDocuments("participants")).toBe(3);
});
