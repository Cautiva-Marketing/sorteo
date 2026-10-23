import { expect, test, type Page } from "@playwright/test";
import { resetFirestore } from "./helpers/emulators";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(90_000);
test.use({ actionTimeout: 30_000 });

async function register(page: Page, values: { fullName: string; phone: string; company: string }) {
  await page.goto("/registro");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nombres completos", { exact: true }).fill(values.fullName);
  await page.getByLabel("Celular", { exact: true }).fill(values.phone);
  await page.getByLabel("Empresa u ocupación", { exact: true }).fill(values.company);
  await page.getByRole("button", { name: "Enviar y participar" }).click();
}

async function countParticipants(): Promise<number> {
  const response = await fetch(
    "http://127.0.0.1:8080/v1/projects/demo-sorteo/databases/(default)/documents/participants",
    { headers: { Authorization: "Bearer owner" } },
  );
  const json = (await response.json()) as { documents?: unknown[] };
  return json.documents?.length ?? 0;
}

test.beforeEach(async () => {
  await resetFirestore();
});

test("reintentar con otro formato de celular y otro nombre muestra «ya estás participando»", async ({
  page,
}) => {
  await register(page, {
    fullName: "José Núñez Güemes",
    phone: "987654321",
    company: "Cautiva Marketing",
  });
  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();

  await register(page, {
    fullName: "Otra Persona",
    phone: "+51 987-654-321",
    company: "Otra Empresa",
  });

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Ya estás participando en el sorteo" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Registrar a otra persona" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toHaveCount(0);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  // No revela datos del registro existente.
  await expect(dialog.getByText(/José|Núñez|987/)).toHaveCount(0);
  expect(await countParticipants()).toBe(1);

  // «Registrar a otra persona» devuelve el formulario vacío.
  await dialog.getByRole("button", { name: "Registrar a otra persona" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Nombres completos", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Celular", { exact: true })).toHaveValue("");
});

test("el mismo número local en otro país es otro participante, no un duplicado", async ({
  page,
}) => {
  await register(page, {
    fullName: "José Núñez Güemes",
    phone: "987654321",
    company: "Cautiva Marketing",
  });
  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar a otra persona" }).click();

  await page.getByLabel("País", { exact: true }).selectOption("CL");
  await page.getByLabel("Nombres completos", { exact: true }).fill("Sofía");
  await page.getByLabel("Celular", { exact: true }).fill("987654321");
  await page.getByLabel("Empresa u ocupación", { exact: true }).fill("Tienda Sur");
  await page.getByRole("button", { name: "Enviar y participar" }).click();

  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
  expect(await countParticipants()).toBe(2);
});
