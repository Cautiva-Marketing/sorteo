import { expect, test, type Page } from "@playwright/test";
import { createAdminUser, resetFirestore } from "./helpers/emulators";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(120_000);
test.use({ actionTimeout: 30_000 });

// Credenciales ficticias que solo existen en el emulador de Auth.
const ADMIN = { email: "admin-design@example.com", password: "Clave-design-123" };

const WHITE = "rgb(255, 255, 255)";

async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(ADMIN.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Participantes", level: 1 })).toBeVisible();
}

/** Comprobaciones de estilo comunes a todas las pantallas (FR-048 a FR-051, SC-018). */
async function expectBrandStyle(page: Page) {
  await expect(page.getByRole("img", { name: "Cautiva Marketing", exact: true })).toBeVisible();

  const style = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    return {
      background: getComputedStyle(document.body).backgroundColor,
      bodyFont: getComputedStyle(document.body).fontFamily,
      headingFont: h1 ? getComputedStyle(h1).fontFamily : "",
      headerBackground: (() => {
        const header = document.querySelector("header");
        return header ? getComputedStyle(header).backgroundColor : null;
      })(),
    };
  });

  expect(style.background).toBe(WHITE);
  expect(style.bodyFont).toMatch(/Inter/i);
  expect(style.headingFont).toMatch(/Space.?Grotesk/i);
  // El encabezado no es una franja oscura: el logo claro necesita fondo claro.
  expect(
    style.headerBackground === null ||
      style.headerBackground === "rgba(0, 0, 0, 0)" ||
      style.headerBackground === WHITE,
  ).toBe(true);
}

test.beforeAll(async () => {
  await createAdminUser(ADMIN.email, ADMIN.password, { admin: true });
});

test.beforeEach(async () => {
  await resetFirestore();
});

test("la pantalla del QR usa el estilo de marca", async ({ page }) => {
  await page.goto("/");
  await expectBrandStyle(page);
});

test("el formulario usa el estilo de marca", async ({ page }) => {
  await page.goto("/registro");
  await expectBrandStyle(page);
});

test("el inicio de sesión del panel usa el estilo de marca", async ({ page }) => {
  await page.goto("/admin/login");
  await expectBrandStyle(page);
});

test("el panel usa el estilo de marca y el encabezado es blanco", async ({ page }) => {
  await loginAsAdmin(page);
  await expectBrandStyle(page);

  const headerBackground = await page.evaluate(
    () => getComputedStyle(document.querySelector("header") as Element).backgroundColor,
  );
  expect(headerBackground).toBe(WHITE);

  for (const path of ["/admin/premios", "/admin/sorteo", "/admin/campana"]) {
    await page.goto(path);
    await expectBrandStyle(page);
  }
});
