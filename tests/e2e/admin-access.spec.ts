import { expect, test, type Page } from "@playwright/test";
import {
  createAdminUser,
  resetFirestore,
  seedParticipant,
  seedParticipants,
} from "./helpers/emulators";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(120_000);
test.use({ actionTimeout: 30_000 });

// Credenciales ficticias que solo existen en el emulador de Auth.
const ADMIN = { email: "admin-e2e@example.com", password: "Clave-e2e-123" };
const NORMAL = { email: "normal-e2e@example.com", password: "Clave-e2e-456" };

async function login(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(credentials.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

async function loginAsAdmin(page: Page) {
  await login(page, ADMIN);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Participantes", level: 1 })).toBeVisible();
}

async function countParticipants(): Promise<number> {
  const response = await fetch(
    "http://127.0.0.1:8080/v1/projects/demo-sorteo/databases/(default)/documents/participants",
    { headers: { Authorization: "Bearer owner" } },
  );
  const json = (await response.json()) as { documents?: unknown[] };
  return json.documents?.length ?? 0;
}

test.beforeAll(async () => {
  await createAdminUser(ADMIN.email, ADMIN.password, { admin: true });
  await createAdminUser(NORMAL.email, NORMAL.password, { admin: false });
});

test.beforeEach(async () => {
  await resetFirestore();
});

test("sin sesión, /admin redirige a /admin/login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();

  await page.goto("/admin/campana");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("un usuario sin permisos de administrador no puede entrar y ve el motivo en español", async ({
  page,
}) => {
  await login(page, NORMAL);

  await expect(page.locator("main [role=alert]")).toHaveText("No tienes permisos de administrador");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("credenciales incorrectas muestran un mensaje en español", async ({ page }) => {
  await login(page, { email: ADMIN.email, password: "otra-clave-equivocada" });

  await expect(page.locator("main [role=alert]")).toHaveText("Credenciales incorrectas");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("con 60 participantes: conteo 60, 50 filas, paginación y búsqueda sin tildes ni mayúsculas", async ({
  page,
}) => {
  await seedParticipants(60);
  await loginAsAdmin(page);

  await expect(page.getByText("Total de participantes: 60")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(page.getByText("Página 1 de 2")).toBeVisible();

  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await expect(page.getByText("Página 2 de 2")).toBeVisible();

  const search = page.getByLabel("Buscar por nombre, celular o empresa");
  await search.fill("jose");
  await expect(page.getByText("Coincidencias: 60")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(page.getByText("Página 1 de 2")).toBeVisible();

  await search.fill("JOSÉ");
  await expect(page.getByText("Coincidencias: 60")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(50);

  await search.fill("PARTICIPANTEC");
  await expect(page.getByText("Coincidencias: 9")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(9);

  // Búsqueda por celular de 9 dígitos y por empresa; la tabla muestra el prefijo del país.
  await search.fill("900000005");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("+51 900 000 005");
  await search.fill("empresa cb");
  await expect(page.locator("tbody tr")).toHaveCount(1);

  await search.fill("zzzzzz");
  await expect(page.getByText("No hay resultados")).toBeVisible();
  await expect(page.getByText("Coincidencias: 0")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("la columna CRM muestra Sí/No y «Solo interesados» deja solo a quien marcó, junto con la búsqueda", async ({
  page,
}) => {
  await seedParticipant({
    fullName: "Ana Interesada",
    phone: "+51912345678",
    company: "Cautiva",
    crmInterest: true,
    createdAt: new Date("2026-10-21T20:15:30.000Z"),
  });
  await seedParticipant({
    fullName: "Sofía Rojas",
    phone: "+56912345678",
    company: "Tienda Sur",
    crmInterest: true,
    createdAt: new Date("2026-10-20T20:15:30.000Z"),
  });
  await seedParticipant({
    fullName: "Luis Gómez",
    phone: "+51987654321",
    company: "Cautiva",
    createdAt: new Date("2026-10-19T20:15:30.000Z"),
  });
  await loginAsAdmin(page);

  await expect(page.getByRole("columnheader", { name: "CRM" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(page.locator("tbody tr", { hasText: "Ana Interesada" })).toContainText("Sí");
  await expect(page.locator("tbody tr", { hasText: "Luis Gómez" })).toContainText("No");
  await expect(page.locator("tbody tr", { hasText: "Sofía Rojas" })).toContainText(
    "+56 9 1234 5678",
  );

  await page.getByRole("checkbox", { name: "Solo interesados en el CRM" }).check();
  await expect(page.getByText("Coincidencias: 2")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText("Luis Gómez")).toHaveCount(0);

  await page.getByLabel("Buscar por nombre, celular o empresa").fill("tienda");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Sofía Rojas");
});

test("sin participantes se ve el estado vacío con conteo 0", async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.getByText("Total de participantes: 0")).toBeVisible();
  await expect(page.getByText("Aún no hay participantes")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("cerrar inscripciones en /admin/campana hace que / muestre el aviso y se puede reabrir", async ({
  page,
  context,
}) => {
  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Campaña" }).click();
  await expect(page).toHaveURL(/\/admin\/campana$/);
  await expect(page.getByText("Las inscripciones están abiertas")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar inscripciones" }).click();
  await expect(page.getByText("Las inscripciones están cerradas")).toBeVisible();

  const visitor = await context.newPage();
  await visitor.goto("/registro");
  await expect(
    visitor.getByRole("heading", { name: "Las inscripciones están cerradas" }),
  ).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Enviar y participar" })).toHaveCount(0);

  await page.getByRole("button", { name: "Abrir inscripciones" }).click();
  await expect(page.getByText("Las inscripciones están abiertas")).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByRole("button", { name: "Enviar y participar" })).toBeVisible();
});

test("con el formulario ya abierto, cerrar las inscripciones y enviar muestra el aviso sin guardar datos", async ({
  page,
  context,
}) => {
  const visitor = await context.newPage();
  await visitor.goto("/registro");
  await visitor.waitForLoadState("networkidle");
  await visitor.getByLabel("Nombres completos", { exact: true }).fill("José Núñez Güemes");
  await visitor.getByLabel("Celular", { exact: true }).fill("987654321");
  await visitor.getByLabel("Empresa u ocupación", { exact: true }).fill("Cautiva Marketing");

  await loginAsAdmin(page);
  await page.goto("/admin/campana");
  await page.getByRole("button", { name: "Cerrar inscripciones" }).click();
  await expect(page.getByText("Las inscripciones están cerradas")).toBeVisible();

  await visitor.getByRole("button", { name: "Enviar y participar" }).click();
  await expect(
    visitor.getByRole("heading", { name: "Las inscripciones están cerradas" }),
  ).toBeVisible();
  expect(await countParticipants()).toBe(0);
});

test("con la cookie de sesión eliminada, cerrar inscripciones redirige al login con el aviso de sesión vencida", async ({
  page,
  context,
}) => {
  await loginAsAdmin(page);
  await page.goto("/admin/campana");
  await page.waitForLoadState("networkidle");
  await context.clearCookies({ name: "admin_session" });

  await page.getByRole("button", { name: "Cerrar inscripciones" }).click();

  await expect(page).toHaveURL(/\/admin\/login\?expirada=1$/);
  await expect(page.getByText("Tu sesión expiró. Inicia sesión de nuevo.")).toBeVisible();
});

test("cerrar sesión elimina el acceso al panel", async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
