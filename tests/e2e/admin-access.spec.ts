import { expect, test, type Page } from "@playwright/test";
import {
  createAdminUser,
  resetFirestore,
  seedParticipant,
  seedParticipants,
} from "./helpers/emulators";
import {
  clickNext,
  fillAnswers,
  fillStepOne,
  openForm,
  submitAnswers,
} from "./helpers/registration";

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

test("la tabla muestra CRM y GPS / cámara, los filtra por respuesta y los combina con la búsqueda", async ({
  page,
}) => {
  const answers = {
    trainingArea: "Ventas",
    guestSuggestion: "Un experto",
  };
  await seedParticipant({
    fullName: "Ana Interesada",
    phone: "+51912345678",
    company: "Cautiva",
    ...answers,
    crmInterest: "yes",
    gpsInterest: "maybe",
    createdAt: new Date("2026-10-23T20:15:30.000Z"),
  });
  await seedParticipant({
    fullName: "Sofía Rojas",
    phone: "+56912345678",
    company: "Tienda Sur",
    ...answers,
    crmInterest: "maybe",
    gpsInterest: "yes",
    createdAt: new Date("2026-10-22T20:15:30.000Z"),
  });
  await seedParticipant({
    fullName: "Luis Gómez",
    phone: "+51987654321",
    company: "Cautiva",
    ...answers,
    crmInterest: "no",
    gpsInterest: "no",
    createdAt: new Date("2026-10-21T20:15:30.000Z"),
  });
  await seedParticipant({
    fullName: "Marta Tienda",
    phone: "+51923456789",
    company: "Tienda Norte",
    ...answers,
    crmInterest: "yes",
    gpsInterest: "yes",
    createdAt: new Date("2026-10-20T20:15:30.000Z"),
  });
  // Registro anterior a la feature 005: la casilla del CRM marcada y nada más.
  await seedParticipant({
    fullName: "Pedro Anterior",
    phone: "+51934567890",
    company: "Cautiva",
    crmInterest: true,
    createdAt: new Date("2026-10-19T20:15:30.000Z"),
  });
  await loginAsAdmin(page);

  // Columnas: CRM y GPS / cámara sí; capacitación e invitado no. Ya no existe la casilla anterior.
  await expect(page.getByRole("columnheader", { name: "CRM", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "GPS / cámara" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /capacitación|invitado/i })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByText("Ventas", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Un experto")).toHaveCount(0);

  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(5);
  const rowOf = (name: string) => rows.filter({ hasText: name });
  // CRM (4.ª celda) y GPS / cámara (5.ª celda) de cada persona.
  const crmGps = async (name: string) => [
    await rowOf(name).locator("td").nth(2).innerText(),
    await rowOf(name).locator("td").nth(3).innerText(),
  ];
  expect(await crmGps("Ana Interesada")).toEqual(["Sí", "Tal vez"]);
  expect(await crmGps("Sofía Rojas")).toEqual(["Tal vez", "Sí"]);
  expect(await crmGps("Luis Gómez")).toEqual(["No", "No"]);
  expect(await crmGps("Pedro Anterior")).toEqual(["Sí", "Sin respuesta"]);
  await expect(rowOf("Sofía Rojas")).toContainText("+56 9 1234 5678");

  const crmFilter = page.getByLabel("CRM con Agente IA", { exact: true });
  const gpsFilter = page.getByLabel("GPS / cámara", { exact: true });
  const matches = (count: number) => page.getByText(`Coincidencias: ${count}`);

  // El filtro de CRM no ofrece «Sin respuesta»; el de GPS / cámara sí.
  await expect(crmFilter.locator("option")).toHaveText(["Todas", "Sí", "Tal vez", "No"]);
  await expect(gpsFilter.locator("option")).toHaveText([
    "Todas",
    "Sí",
    "Tal vez",
    "No",
    "Sin respuesta",
  ]);

  await crmFilter.selectOption({ label: "Sí" });
  await expect(matches(3)).toBeVisible();
  await expect(rowOf("Luis Gómez")).toHaveCount(0);
  await expect(rowOf("Sofía Rojas")).toHaveCount(0);
  await expect(rowOf("Pedro Anterior")).toHaveCount(1); // casilla anterior marcada = Sí

  await crmFilter.selectOption({ label: "Tal vez" });
  await expect(matches(1)).toBeVisible();
  await expect(rowOf("Sofía Rojas")).toHaveCount(1);

  await crmFilter.selectOption({ label: "No" });
  await expect(matches(1)).toBeVisible();
  await expect(rowOf("Luis Gómez")).toHaveCount(1);

  await crmFilter.selectOption({ label: "Todas" });
  await gpsFilter.selectOption({ label: "Sin respuesta" });
  await expect(matches(1)).toBeVisible();
  await expect(rowOf("Pedro Anterior")).toHaveCount(1);

  await gpsFilter.selectOption({ label: "Sí" });
  await expect(matches(2)).toBeVisible();
  await expect(rowOf("Sofía Rojas")).toHaveCount(1);
  await expect(rowOf("Marta Tienda")).toHaveCount(1);

  // Ambos filtros combinados: CRM Sí y GPS / cámara Sí deja solo a Marta.
  await crmFilter.selectOption({ label: "Sí" });
  await expect(matches(1)).toBeVisible();
  await expect(rowOf("Marta Tienda")).toHaveCount(1);

  // Y con la búsqueda por texto: «tienda» coincide con Sofía y Marta, pero solo Marta pasa los filtros.
  await crmFilter.selectOption({ label: "Todas" });
  await page.getByLabel("Buscar por nombre, celular o empresa").fill("tienda");
  await expect(matches(2)).toBeVisible();
  await crmFilter.selectOption({ label: "Sí" });
  await expect(matches(1)).toBeVisible();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Marta Tienda");

  // Una combinación sin coincidencias muestra el aviso de siempre.
  await gpsFilter.selectOption({ label: "Sin respuesta" });
  await expect(page.getByText("No hay resultados")).toBeVisible();
  await expect(matches(0)).toBeVisible();
});

test("cambiar un filtro vuelve a la primera página", async ({ page }) => {
  // 55 participantes con CRM «Sí» ⇒ 2 páginas (50 por página).
  for (let index = 0; index < 55; index += 1) {
    await seedParticipant({
      fullName: `Participante ${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index % 26]}${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(index / 26)]}`,
      phone: `+519${String(index).padStart(8, "0")}`,
      company: "Empresa",
      crmInterest: "yes",
      gpsInterest: "no",
      createdAt: new Date(Date.UTC(2026, 9, 21, 12, 0, index)),
    });
  }
  await loginAsAdmin(page);
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();

  // Todos los participantes cumplen el filtro, así que sigue habiendo 2 páginas: lo que cambia es
  // que la paginación se reinicia.
  await page.getByLabel("CRM con Agente IA", { exact: true }).selectOption({ label: "Sí" });
  await expect(page.getByText("Página 1 de 2")).toBeVisible();

  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await page.getByLabel("GPS / cámara", { exact: true }).selectOption({ label: "No" });
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
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
  await expect(visitor.getByRole("button", { name: "Siguiente" })).toHaveCount(0);

  await page.getByRole("button", { name: "Abrir inscripciones" }).click();
  await expect(page.getByText("Las inscripciones están abiertas")).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByRole("button", { name: "Siguiente" })).toBeVisible();
});

test("con el formulario ya abierto, cerrar las inscripciones y enviar muestra el aviso sin guardar datos", async ({
  page,
  context,
}) => {
  const visitor = await context.newPage();
  await openForm(visitor);
  // La persona ya contestó los dos pasos cuando las inscripciones se cierran.
  await fillStepOne(visitor);
  await clickNext(visitor);
  await fillAnswers(visitor);

  await loginAsAdmin(page);
  await page.goto("/admin/campana");
  await page.getByRole("button", { name: "Cerrar inscripciones" }).click();
  await expect(page.getByText("Las inscripciones están cerradas")).toBeVisible();

  await submitAnswers(visitor);
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
