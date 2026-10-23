import { expect, test } from "@playwright/test";
import { resetFirestore, seedParticipants, setRegistrationOpen } from "./helpers/emulators";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(90_000);
test.use({ actionTimeout: 30_000 });

// SC-015: el contador y el cierre de inscripciones se reflejan en menos de 5 segundos.
const LIVE_TIMEOUT = 5000;

test.beforeEach(async () => {
  await resetFirestore();
});

test("la pantalla del QR muestra el logo, el QR, el contador y los logos aliados, sin botón ni formulario", async ({
  page,
  baseURL,
}) => {
  await page.goto("/");

  await expect(page.getByRole("img", { name: "Creando Valor", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Regístrate y participa en el sorteo" }),
  ).toBeVisible();

  const qr = page.getByRole("img", { name: /Código QR/ });
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute("data-url", `${baseURL}/registro`);
  await expect(qr.locator("image")).toHaveCount(1);

  await expect(page.getByText("0 registrados")).toBeVisible();
  // Sin botón para registrarse desde el mismo dispositivo; los logos aliados van al pie.
  await expect(page.getByRole("link")).toHaveCount(0);
  await expect(page.getByText("Registrarme desde este dispositivo")).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Satelcom", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Cautiva Marketing", exact: true })).toBeVisible();
  await expect(page.getByLabel("Nombres completos", { exact: true })).toHaveCount(0);

  // Sin desplazamiento horizontal (también a 360 px en el proyecto «mobile»).
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test("el contador sube sin recargar la página (≤ 5 s)", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("0 registrados")).toBeVisible();

  await seedParticipants(1);
  await expect(page.getByText("1 registrado", { exact: true })).toBeVisible({
    timeout: LIVE_TIMEOUT,
  });

  await seedParticipants(2);
  await expect(page.getByText("2 registrados")).toBeVisible({ timeout: LIVE_TIMEOUT });
});

test("sin conexión el contador conserva su valor sin errores y se actualiza al volver", async ({
  page,
  context,
}) => {
  await seedParticipants(1);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("1 registrado", { exact: true })).toBeVisible();

  await context.setOffline(true);
  await seedParticipants(2); // el helper habla con el emulador desde Node, no desde el navegador
  await page.waitForTimeout(4500); // más de un intervalo de sondeo (3 s)

  await expect(page.getByText("1 registrado", { exact: true })).toBeVisible();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("2 registrados")).toBeVisible({ timeout: LIVE_TIMEOUT });
});

test("al cerrar las inscripciones el QR se reemplaza por el aviso (≤ 5 s)", async ({ page }) => {
  await seedParticipants(3);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();

  await setRegistrationOpen(false);

  await expect(page.getByRole("heading", { name: "Las inscripciones están cerradas" })).toBeVisible(
    { timeout: LIVE_TIMEOUT },
  );
  await expect(page.getByRole("img", { name: /Código QR/ })).toHaveCount(0);
  await expect(page.getByText("3 registrados")).toBeVisible();
});

test("con las inscripciones cerradas desde el inicio se ve el aviso y el contador", async ({
  page,
}) => {
  await seedParticipants(2);
  await setRegistrationOpen(false);

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Las inscripciones están cerradas" }),
  ).toBeVisible();
  await expect(page.getByText("2 registrados")).toBeVisible();
  await expect(page.getByRole("img", { name: /Código QR/ })).toHaveCount(0);
});

test("en una pantalla de 40 pulgadas Full HD el símbolo del QR mide al menos 450 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");

  const qr = page.getByRole("img", { name: /Código QR/ });
  const box = await qr.boundingBox();
  // El viewBox incluye la zona de silencio (`data-quiet-zone` módulos por lado): el símbolo es el resto.
  const [, , total] = ((await qr.getAttribute("viewBox")) ?? "").split(" ").map(Number);
  const quiet = Number(await qr.getAttribute("data-quiet-zone"));

  expect(box).not.toBeNull();
  expect(total).toBeGreaterThan(quiet * 2);
  const symbol = ((box?.width ?? 0) * ((total ?? 0) - quiet * 2)) / (total ?? 1);
  expect(symbol).toBeGreaterThanOrEqual(450);
});

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
]) {
  test(`en ${viewport.width}×${viewport.height} todo va en una sola columna, como en el ejemplo`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const heading = await page
      .getByRole("heading", { name: "Regístrate y participa en el sorteo" })
      .boundingBox();
    const qr = await page.getByRole("img", { name: /Código QR/ }).boundingBox();
    const counter = await page.getByText(/\d+ registrados?$/).boundingBox();
    const partners = await page.getByRole("img", { name: "Satelcom", exact: true }).boundingBox();

    for (const box of [heading, qr, counter, partners]) {
      expect(box).not.toBeNull();
    }
    // Orden vertical: título → QR → contador → logos aliados, sin nada al costado.
    expect((heading?.y ?? 0) + (heading?.height ?? 0)).toBeLessThanOrEqual(qr?.y ?? 0);
    expect((qr?.y ?? 0) + (qr?.height ?? 0)).toBeLessThanOrEqual(counter?.y ?? 0);
    expect((counter?.y ?? 0) + (counter?.height ?? 0)).toBeLessThanOrEqual(partners?.y ?? 0);
    // Todo centrado en la ventana: el QR queda sobre el eje vertical.
    const center = viewport.width / 2;
    expect(Math.abs((qr?.x ?? 0) + (qr?.width ?? 0) / 2 - center)).toBeLessThan(4);
  });

  test(`en ${viewport.width}×${viewport.height} no queda un hueco entre la tarjeta y los logos aliados`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // El contador es lo último de la tarjeta: su borde inferior más el relleno de la tarjeta.
    const counter = await page.getByText(/\d+ registrados?$/).boundingBox();
    const partners = await page.getByRole("img", { name: "Satelcom", exact: true }).boundingBox();

    expect(counter).not.toBeNull();
    expect(partners).not.toBeNull();
    const gap = (partners?.y ?? 0) - ((counter?.y ?? 0) + (counter?.height ?? 0));
    // Relleno de la tarjeta (≈24 px) + separación al pie: menos de 120 px de blanco en total.
    expect(gap).toBeLessThanOrEqual(120);
  });
}

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
]) {
  test(`en ${viewport.width}×${viewport.height} la pantalla del QR cabe sin desplazarse`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const metrics = await page.evaluate(() => ({
      vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));

    expect(metrics.vertical).toBeLessThanOrEqual(0);
    expect(metrics.horizontal).toBeLessThanOrEqual(0);
  });
}
