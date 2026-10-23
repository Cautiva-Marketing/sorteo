import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, loginAsAdmin } from "./helpers/admin";
import { createAdminUser, resetFirestore, seedPrize } from "./helpers/emulators";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(120_000);
test.use({ actionTimeout: 30_000 });

test.beforeAll(async () => {
  await createAdminUser(E2E_ADMIN.email, E2E_ADMIN.password, { admin: true });
});

test.beforeEach(async () => {
  await resetFirestore();
});

async function openPrizesPage(page: Page): Promise<void> {
  await page.goto("/admin/premios");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Premios", level: 1 })).toBeVisible();
}

function prizeItems(page: Page) {
  return page.getByRole("region", { name: "Premios" }).getByRole("listitem");
}

async function addPrize(page: Page, name: string, quantity: string): Promise<void> {
  await page.getByLabel("Nombre del premio", { exact: true }).fill(name);
  await page.getByLabel("Cantidad", { exact: true }).fill(quantity);
  await page.getByRole("button", { name: "Agregar premio" }).click();
}

test("crea, valida, reordena, edita y elimina premios, y todo se conserva al recargar", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await openPrizesPage(page);
  await expect(page.getByText("Aún no hay premios. Agrega el primero.")).toBeVisible();

  await addPrize(page, "Alexa", "2");
  await expect(prizeItems(page).filter({ hasText: "Alexa" })).toContainText("0 de 2 entregadas");
  await addPrize(page, "Box", "1");
  await expect(prizeItems(page).filter({ hasText: "Box" })).toContainText("0 de 1 entregadas");
  await addPrize(page, "Termo", "1");
  await expect(prizeItems(page)).toHaveCount(3);

  // Nombre repetido (sin distinguir mayúsculas) y cantidad inválida: error junto al campo.
  await addPrize(page, "alexa", "1");
  await expect(page.getByText("Ya existe un premio con ese nombre.")).toBeVisible();
  await page.getByLabel("Nombre del premio", { exact: true }).fill("Otro premio");
  await page.getByLabel("Cantidad", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Agregar premio" }).click();
  await expect(page.getByText("Ingresa una cantidad entera entre 1 y 100.")).toBeVisible();
  await expect(prizeItems(page)).toHaveCount(3);

  // Reordenar: Alexa baja una posición.
  await page.getByRole("button", { name: "Bajar Alexa" }).click();
  await expect(prizeItems(page).first()).toContainText("Box");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(prizeItems(page).nth(0)).toContainText("Box");
  await expect(prizeItems(page).nth(1)).toContainText("Alexa");
  await expect(prizeItems(page).nth(2)).toContainText("Termo");

  // Editar nombre y cantidad.
  await page.getByRole("button", { name: "Editar Alexa" }).click();
  await page.getByLabel("Nuevo nombre").fill("Alexa Echo");
  await page.getByLabel("Nueva cantidad").fill("3");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(prizeItems(page).filter({ hasText: "Alexa Echo" })).toContainText(
    "0 de 3 entregadas",
  );

  // Eliminar con confirmación.
  await page.getByRole("button", { name: "Eliminar Termo" }).click();
  const dialog = page.getByRole("dialog", { name: /¿Eliminar el premio “Termo”\?/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(prizeItems(page)).toHaveCount(2);
  await expect(page.getByText("Termo")).toHaveCount(0);

  // Todo se conserva tras recargar.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(prizeItems(page)).toHaveCount(2);
  await expect(prizeItems(page).nth(1)).toContainText("Alexa Echo");
});

test("un premio con ganadores no se puede eliminar", async ({ page }) => {
  await seedPrize({ name: "Historico", quantity: 1, delivered: 1, spinCount: 1 });
  await loginAsAdmin(page);
  await openPrizesPage(page);

  const item = prizeItems(page).filter({ hasText: "Historico" });
  await expect(item).toContainText("1 de 1 entregadas");
  await expect(item.getByRole("button", { name: "Eliminar Historico" })).toBeDisabled();
  await expect(item).toContainText("Ya tiene ganadores");
});
