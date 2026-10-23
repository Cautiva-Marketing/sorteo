import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, loginAsAdmin } from "./helpers/admin";
import {
  createAdminUser,
  resetFirestore,
  seedParticipants,
  seedPrize,
  setRegistrationOpen,
} from "./helpers/emulators";

// La primera petición compila las rutas en modo desarrollo y el giro dura ~6,5 s: márgenes amplios.
test.setTimeout(120_000);
test.use({ actionTimeout: 30_000 });

test.beforeAll(async () => {
  await createAdminUser(E2E_ADMIN.email, E2E_ADMIN.password, { admin: true });
});

test.beforeEach(async () => {
  await resetFirestore();
});

async function openDrawPage(page: Page): Promise<void> {
  await page.goto("/admin/sorteo");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Sorteo", level: 1 })).toBeVisible();
}

async function openPrizesPage(page: Page): Promise<void> {
  await page.goto("/admin/premios");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Premios", level: 1 })).toBeVisible();
}

async function openWinnersPage(page: Page): Promise<void> {
  await page.goto("/admin/ganadores");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "Historial de ganadores", level: 1 }),
  ).toBeVisible();
}

function history(page: Page) {
  return page.getByRole("region", { name: "Historial de ganadores" });
}

function prizeItem(page: Page, name: string) {
  return page.getByRole("region", { name: "Premios" }).getByRole("listitem").filter({
    hasText: name,
  });
}

test("sin premios no se puede girar y se explica el motivo", async ({ page }) => {
  await seedParticipants(5);
  await loginAsAdmin(page);
  await openDrawPage(page);

  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeDisabled();
  await expect(page.getByText("Elige un premio: aún no hay premios.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Configurar premios" })).toHaveAttribute(
    "href",
    "/admin/premios",
  );

  await openWinnersPage(page);
  await expect(page.getByText("Aún no hay ganadores.")).toBeVisible();
});

test("la pestaña Sorteo muestra la ruleta con premios y ganadores, sin formulario de premios ni historial", async ({
  page,
}) => {
  await seedParticipants(5);
  await seedPrize({ name: "Alexa", quantity: 1 });
  await loginAsAdmin(page);
  await openDrawPage(page);

  await expect(page.getByTestId("roulette-canvas")).toBeVisible();
  await expect(page.getByRole("region", { name: "Premios del sorteo" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Alexa/ })).toBeChecked();
  await expect(page.getByRole("region", { name: "Ganadores del evento" })).toBeVisible();
  await expect(page.getByLabel("Nombre del premio", { exact: true })).toHaveCount(0);
  await expect(history(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Premios", exact: true })).toBeVisible();
});

test("giro real: gira sin ventana de confirmación, cierra las inscripciones y conserva el historial", async ({
  page,
}) => {
  await seedParticipants(10);
  await seedPrize({ name: "Alexa", quantity: 1 });
  await loginAsAdmin(page);
  await openDrawPage(page);
  await expect(page.getByText("Participantes elegibles: 10")).toBeVisible();

  // Con las inscripciones abiertas, «Girar» gira de inmediato: no hay ventana de confirmación y
  // la ruleta se mueve en 2 s o menos (SC-034): el letrero del puntero ya muestra un nombre.
  await page.getByRole("button", { name: "Girar para: Alexa" }).click();
  await expect(page.getByRole("dialog", { name: "Se cerrarán las inscripciones" })).toHaveCount(0);
  await expect(
    page.locator('section[aria-label="Nombre bajo el puntero"] p[aria-hidden="true"]'),
  ).not.toHaveText("", { timeout: 2_000 });

  // El giro dura ~6,5 s; la ventana muestra premio y nombre, nunca un celular.
  const winnerDialog = page.getByRole("dialog", { name: "¡Ganador #1!" });
  await expect(winnerDialog).toBeVisible({ timeout: 20_000 });
  await expect(winnerDialog).toContainText("Alexa");
  await expect(winnerDialog).toContainText("Jose Participante");
  await expect(winnerDialog).not.toContainText(/9\d{8}/);
  await winnerDialog.getByRole("button", { name: "Continuar" }).click();
  await expect(winnerDialog).toBeHidden();

  // La ruleta ya no ofrece el premio sorteado y el ganador salió de la lista de elegibles.
  await expect(page.getByText("Participantes elegibles: 9")).toBeVisible();
  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeDisabled();
  await expect(page.getByText("Este premio ya no tiene unidades pendientes.")).toBeVisible();

  // El premio queda sorteado y el panel del sorteo ya lista al ganador (sin celular).
  await expect(page.getByRole("region", { name: "Ganadores del evento" })).toContainText(
    "Jose Participante",
  );
  await openPrizesPage(page);
  await expect(prizeItem(page, "Alexa")).toContainText("1 de 1 entregadas");

  // El historial (en Ganadores) trae el celular y el estado.
  await openWinnersPage(page);
  const entry = history(page).getByRole("listitem");
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("#1");
  await expect(entry).toContainText("Premio: Alexa");
  await expect(entry).toContainText(/Celular: \+51 9\d{2} \d{3} \d{3}/);
  await expect(entry).toContainText("Ganador");

  // Recargar conserva el resultado y las inscripciones quedaron cerradas.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(history(page).getByRole("listitem")).toHaveCount(1);
  await page.goto("/registro");
  await expect(page.getByText("Las inscripciones están cerradas")).toBeVisible();

  // El control de Campaña permite reabrirlas y el QR vuelve a mostrarse (FR-108).
  await page.goto("/admin/campana");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Abrir inscripciones" }).click();
  await expect(page.getByText("Listo: las inscripciones quedaron abiertas.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible({ timeout: 10_000 });
});

test("con las inscripciones cerradas el giro no pide confirmación y numera los ganadores", async ({
  page,
}) => {
  await seedParticipants(10);
  await seedPrize({ name: "Box", quantity: 2 });
  await setRegistrationOpen(false);
  await loginAsAdmin(page);
  await openDrawPage(page);

  await page.getByRole("button", { name: "Girar para: Box" }).click();
  await expect(page.getByRole("dialog", { name: "¡Ganador #1!" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("button", { name: "Girar para: Box" }).click();
  await expect(page.getByRole("dialog", { name: "¡Ganador #2!" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Continuar" }).click();

  await openWinnersPage(page);
  await expect(history(page).getByRole("listitem")).toHaveCount(2);
  await openPrizesPage(page);
  await expect(prizeItem(page, "Box")).toContainText("2 de 2 entregadas");
});

test("modo de práctica: gira sin confirmar el cierre y no deja ningún rastro", async ({ page }) => {
  await seedParticipants(10);
  await seedPrize({ name: "Alexa", quantity: 1 });
  await loginAsAdmin(page);
  await openDrawPage(page);

  await page.getByLabel("Modo de práctica").check();
  await expect(page.getByText("Práctica: no se guarda")).toBeVisible();
  await page.getByRole("button", { name: "Girar (práctica)" }).click();

  // Sin confirmación de cierre; la ventana lo indica y solo ofrece cerrarla.
  await expect(page.getByRole("dialog", { name: "Se cerrarán las inscripciones" })).toHaveCount(0);
  const dialog = page.getByRole("dialog", { name: "¡Ganador de práctica!" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toContainText("Práctica");
  await expect(dialog.getByRole("button")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Cerrar" }).click();

  await expect(page.getByText("Participantes elegibles: 10")).toBeVisible();
  await openWinnersPage(page);
  await expect(page.getByText("Aún no hay ganadores.")).toBeVisible();
  await openPrizesPage(page);
  await expect(prizeItem(page, "Alexa")).toContainText("0 de 1 entregadas");
  await page.goto("/registro");
  await expect(page.getByText("Las inscripciones están cerradas")).toHaveCount(0);
});

test("con prefers-reduced-motion el ganador aparece sin esperar el giro ni mostrar confeti", async ({
  page,
}) => {
  await seedParticipants(5);
  await seedPrize({ name: "Alexa", quantity: 1 });
  await setRegistrationOpen(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginAsAdmin(page);
  await openDrawPage(page);

  await page.getByRole("button", { name: "Girar para: Alexa" }).click();

  // El giro normal tarda ~6,5 s: aquí la ventana debe verse mucho antes.
  const dialog = page.getByRole("dialog", { name: "¡Ganador #1!" });
  await expect(dialog).toBeVisible({ timeout: 4_000 });
  await expect(page.locator("[data-confetti]").first()).toBeHidden();
});

test("sin participantes elegibles el botón de girar queda deshabilitado con el motivo", async ({
  page,
}) => {
  await seedPrize({ name: "Alexa", quantity: 1 });
  await loginAsAdmin(page);
  await openDrawPage(page);

  await expect(page.getByRole("button", { name: "Girar para: Alexa" })).toBeDisabled();
  await expect(page.getByText("No hay participantes elegibles para sortear.")).toBeVisible();
});

test("con todos los premios sorteados el botón de girar queda deshabilitado", async ({ page }) => {
  await seedParticipants(5);
  await seedPrize({ name: "Alexa", quantity: 1, delivered: 1, spinCount: 1 });
  await loginAsAdmin(page);
  await openDrawPage(page);

  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeDisabled();
  await expect(page.getByText("Todos los premios ya fueron sorteados.")).toBeVisible();
});
