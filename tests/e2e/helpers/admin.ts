import { expect, type Page } from "@playwright/test";

/** Credenciales ficticias que solo existen en el emulador de Auth. */
export const E2E_ADMIN = { email: "admin-e2e@example.com", password: "Clave-e2e-123" };

/** Inicia sesión en el panel desde `/admin/login` y espera a ver el listado de participantes. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(E2E_ADMIN.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Participantes", level: 1 })).toBeVisible();
}

/** Cuenta los documentos de una colección de Firestore (emulador) por su API REST. */
export async function countDocuments(collection: string): Promise<number> {
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-sorteo/databases/(default)/documents/${collection}?pageSize=1000`,
    { headers: { Authorization: "Bearer owner" } },
  );
  const json = (await response.json()) as { documents?: unknown[] };
  return json.documents?.length ?? 0;
}
