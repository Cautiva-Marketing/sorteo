import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, loginAsAdmin as loginAsE2eAdmin } from "./helpers/admin";
import {
  createAdminUser,
  resetFirestore,
  seedParticipants,
  setRegistrationOpen,
} from "./helpers/emulators";
import { clickNext, fillStepOne, openForm, registerViaForm } from "./helpers/registration";

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
  await expect(page.getByRole("img", { name: "Creando Valor", exact: true })).toBeVisible();

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
  expect(style.bodyFont).toMatch(/Montserrat/i);
  expect(style.headingFont).toMatch(/Montserrat/i);
  // El encabezado no es una franja oscura: el logo claro necesita fondo claro.
  expect(
    style.headerBackground === null ||
      style.headerBackground === "rgba(0, 0, 0, 0)" ||
      style.headerBackground === WHITE,
  ).toBe(true);
}

test.beforeAll(async () => {
  await createAdminUser(ADMIN.email, ADMIN.password, { admin: true });
  await createAdminUser(E2E_ADMIN.email, E2E_ADMIN.password, { admin: true });
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

test("el panel usa el estilo de marca y la barra lateral es blanca", async ({ page }) => {
  await loginAsAdmin(page);
  await expectBrandStyle(page);

  const sidebarBackground = await page.evaluate(
    () => getComputedStyle(document.querySelector("aside") as Element).backgroundColor,
  );
  expect(sidebarBackground).toBe(WHITE);

  for (const path of ["/admin/premios", "/admin/sorteo", "/admin/ganadores", "/admin/campana"]) {
    await page.goto(path);
    await expectBrandStyle(page);
  }
});

/** `backdrop-filter` del `::backdrop` de un `<dialog>` abierto. */
async function backdropFilter(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      getComputedStyle(document.querySelector("dialog[open]") as Element, "::backdrop")
        .backdropFilter,
  );
}

test("las ventanas del panel oscurecen el fondo sin desenfocarlo (FR-116)", async ({ page }) => {
  await seedParticipants(2);
  await setRegistrationOpen(false);
  await loginAsE2eAdmin(page);
  await page.goto("/admin/campana");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Borrar datos de participantes" }).click();
  const dialog = page.getByRole("dialog", { name: "Borrar los datos de los participantes" });
  await expect(dialog).toBeVisible();
  expect(await backdropFilter(page)).toBe("none");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("las ventanas del formulario público conservan el desenfoque (FR-117)", async ({ page }) => {
  await openForm(page);
  const stepOne = { fullName: "María", phone: "987654321", company: "Cautiva" };

  await registerViaForm(page, stepOne);
  const welcome = page.getByRole("dialog", { name: "¡Bienvenido(a)!" });
  await expect(welcome).toBeVisible();
  expect(await backdropFilter(page)).toContain("blur");

  // Repetir el mismo celular abre la ventana «ya registrado» al tocar «Siguiente».
  await page.getByRole("button", { name: "Registrar a otra persona" }).click();
  await fillStepOne(page, stepOne);
  await clickNext(page);
  const already = page.getByRole("dialog", { name: "Ya estás participando en el sorteo" });
  await expect(already).toBeVisible();
  expect(await backdropFilter(page)).toContain("blur");

  // Escape cierra la ventana.
  await page.keyboard.press("Escape");
  await expect(already).toBeHidden();
});
