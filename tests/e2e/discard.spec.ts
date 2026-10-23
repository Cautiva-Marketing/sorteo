import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, loginAsAdmin } from "./helpers/admin";
import {
  createAdminUser,
  resetFirestore,
  seedParticipants,
  seedPrize,
  setRegistrationOpen,
} from "./helpers/emulators";

// El giro dura ~6,5 s y «Volver a girar» encadena dos: se dejan márgenes amplios.
test.setTimeout(120_000);
test.use({ actionTimeout: 30_000 });

test.beforeAll(async () => {
  await createAdminUser(E2E_ADMIN.email, E2E_ADMIN.password, { admin: true });
});

test.beforeEach(async () => {
  await resetFirestore();
  await setRegistrationOpen(false);
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

function history(page: Page) {
  return page.getByRole("region", { name: "Historial de ganadores" });
}

function prizeItem(page: Page, name: string) {
  return page.getByRole("region", { name: "Premios" }).getByRole("listitem").filter({
    hasText: name,
  });
}

test("«Volver a girar» descarta al ganador, lo excluye y el nuevo lleva el número siguiente", async ({
  page,
}) => {
  await seedParticipants(10);
  await seedPrize({ name: "Box", quantity: 1 });
  await loginAsAdmin(page);
  await openDrawPage(page);

  await page.getByRole("button", { name: "Girar para: Box" }).click();
  const first = page.getByRole("dialog", { name: "¡Ganador #1!" });
  await expect(first).toBeVisible({ timeout: 20_000 });
  const firstName = (await first.getByText(/Jose Participante/).textContent()) ?? "";
  expect(firstName).not.toBe("");

  await first.getByRole("button", { name: "Volver a girar" }).click();

  // Gira de nuevo por el mismo premio: el nuevo ganador es el #2 y es otra persona.
  const second = page.getByRole("dialog", { name: "¡Ganador #2!" });
  await expect(second).toBeVisible({ timeout: 30_000 });
  const secondName = (await second.getByText(/Jose Participante/).textContent()) ?? "";
  expect(secondName).not.toBe(firstName);
  await second.getByRole("button", { name: "Continuar" }).click();
  // Los dos salieron de la ruleta: 10 − 2 = 8 elegibles.
  await expect(page.getByText("Participantes elegibles: 8")).toBeVisible();

  await openPrizesPage(page);
  const entries = history(page).getByRole("listitem");
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText("#2 ·");
  await expect(entries.nth(0)).toContainText("Ganador");
  await expect(entries.nth(1)).toContainText("#1 ·");
  await expect(entries.nth(1)).toContainText("Descartado");
  await expect(entries.nth(1)).toContainText(E2E_ADMIN.email);
  await expect(prizeItem(page, "Box")).toContainText("1 de 1 entregadas");
});

test("se puede descartar a un ganador ya aceptado desde el historial y la unidad vuelve", async ({
  page,
}) => {
  await seedParticipants(10);
  await seedPrize({ name: "Termo", quantity: 1 });
  await loginAsAdmin(page);
  await openDrawPage(page);

  await page.getByRole("button", { name: "Girar para: Termo" }).click();
  const winner = page.getByRole("dialog", { name: "¡Ganador #1!" });
  await expect(winner).toBeVisible({ timeout: 20_000 });
  await winner.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("button", { name: "Girar", exact: true })).toBeDisabled();

  // El descarte desde el historial se hace en la pestaña Premios.
  await openPrizesPage(page);
  await expect(prizeItem(page, "Termo")).toContainText("1 de 1 entregadas");

  // Cancelar no cambia nada; confirmar descarta al ganador.
  await page.getByRole("button", { name: "Descartar al ganador #1" }).click();
  const confirm = page.getByRole("dialog", { name: "¿Descartar al ganador #1?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toBeHidden();
  await expect(history(page).getByRole("listitem")).toContainText("Ganador");

  await page.getByRole("button", { name: "Descartar al ganador #1" }).click();
  await confirm.getByRole("button", { name: "Sí, descartar" }).click();

  await expect(history(page).getByRole("listitem")).toContainText("Descartado");
  await expect(prizeItem(page, "Termo")).toContainText("0 de 1 entregadas");
  await expect(page.getByRole("button", { name: "Descartar al ganador #1" })).toHaveCount(0);

  // La unidad volvió y el descartado no vuelve a la ruleta: 10 − 1 = 9 elegibles.
  await openDrawPage(page);
  await expect(page.getByRole("button", { name: "Girar para: Termo" })).toBeEnabled();
  await expect(page.getByText("Participantes elegibles: 9")).toBeVisible();
});
