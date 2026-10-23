import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, loginAsAdmin } from "./helpers/admin";
import {
  createAdminUser,
  resetFirestore,
  seedParticipants,
  seedPrize,
  setRegistrationOpen,
} from "./helpers/emulators";

// Pantalla de referencia del evento: Full HD de 40 pulgadas (FR-081).
test.use({ viewport: { width: 1920, height: 1080 }, actionTimeout: 30_000 });
test.setTimeout(120_000);

test.beforeAll(async () => {
  await createAdminUser(E2E_ADMIN.email, E2E_ADMIN.password, { admin: true });
});

test.beforeEach(async () => {
  await resetFirestore();
  await seedParticipants(10);
  await seedPrize({ name: "Alexa", quantity: 2 });
  await setRegistrationOpen(false);
});

async function openDrawPage(page: Page): Promise<void> {
  await page.goto("/admin/sorteo");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Sorteo", level: 1 })).toBeVisible();
}

function fontSizeOf(locator: ReturnType<Page["locator"]>): Promise<number> {
  return locator.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
}

test("pantalla completa: logo, premio y letrero legibles a 2 m, ventana del ganador visible y silencio", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await openDrawPage(page);

  await page.getByRole("button", { name: "Pantalla completa" }).click();

  // El contenedor de proyección muestra logo, premio en juego, ruleta, controles y los paneles de premios y ganadores.
  const stage = page.getByTestId("stage-fullscreen");
  await expect(stage).toBeVisible();
  await expect(stage.getByRole("img", { name: "Creando Valor", exact: true })).toBeVisible();
  await expect(stage.getByRole("radiogroup")).toHaveCount(1);
  await expect(stage.getByRole("button", { name: /Descartar al ganador/ })).toHaveCount(0);
  await expect(stage.getByTestId("roulette-canvas")).toBeVisible();
  await expect(stage.getByRole("button", { name: "Salir de pantalla completa" })).toBeVisible();

  // Tamaños para leer a ~2 m en 40" Full HD: premio ≥ 48 px y letrero ≥ 40 px.
  const prize = stage.getByTestId("fullscreen-prize");
  await expect(prize).toHaveText("Alexa");
  expect(await fontSizeOf(prize)).toBeGreaterThanOrEqual(48);
  const pointerName = stage.locator('section[aria-label="Nombre bajo el puntero"] p').first();
  expect(await fontSizeOf(pointerName)).toBeGreaterThanOrEqual(40);
  // La ruleta aprovecha la pantalla: más de 700 px de lado.
  const canvasBox = await stage.getByTestId("roulette-canvas").boundingBox();
  expect(canvasBox?.width ?? 0).toBeGreaterThan(700);

  // Girar dentro de la pantalla completa: la ventana del ganador se ve dentro del contenedor.
  await stage.getByRole("button", { name: "Girar para: Alexa" }).click();
  const dialog = stage.getByRole("dialog", { name: "¡Ganador #1!" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog).toBeHidden();

  // Silenciar: alterna aria-pressed y la preferencia persiste tras recargar.
  const mute = stage.getByRole("button", { name: "Silenciar sonido" });
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.localStorage.getItem("sorteo:silencio"))).toBe("1");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Silenciar sonido" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Escape sale de la pantalla completa sin perder el premio ni la práctica", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await openDrawPage(page);

  await page.getByLabel("Modo de práctica").check();
  await page.getByRole("button", { name: "Pantalla completa" }).click();
  const stage = page.getByTestId("stage-fullscreen");
  await expect(stage).toBeVisible();
  await expect(stage.getByText("Práctica: no se guarda")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByTestId("stage-fullscreen")).toHaveCount(0);
  await expect(page.getByLabel("Modo de práctica")).toBeChecked();
  await expect(page.getByRole("radio", { name: /Alexa/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Pantalla completa" })).toBeVisible();
});

test("la ruleta usa la paleta de la «A» del logo: letrero morado con borde celeste y canvas pintado", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await openDrawPage(page);

  const tokens = await page.evaluate(() => {
    // Un elemento de prueba resuelve el token a `rgb(...)`, igual que el valor calculado del letrero.
    const probe = document.createElement("div");
    const resolve = (name: string): string => {
      probe.style.backgroundColor = `var(--color-${name})`;
      document.body.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    };
    return { purple: resolve("wheel-purple"), cyan: resolve("wheel-cyan") };
  });
  const box = page.locator('section[aria-label="Nombre bajo el puntero"]');
  await expect(box).toHaveCSS("background-color", tokens.purple);
  await expect(box).toHaveCSS("border-top-color", tokens.cyan);

  // El canvas se pinta: al menos un píxel no transparente en el centro de la rueda.
  const painted = await page.getByTestId("roulette-canvas").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] !== 0) {
        return true;
      }
    }
    return false;
  });
  expect(painted).toBe(true);
});
