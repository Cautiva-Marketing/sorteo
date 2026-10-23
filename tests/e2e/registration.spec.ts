import { expect, test, type Page } from "@playwright/test";
import { resetFirestore, setRegistrationOpen } from "./helpers/emulators";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(90_000);
test.use({ actionTimeout: 30_000 });

async function openForm(page: Page): Promise<void> {
  await page.goto("/registro");
  // Espera a la hidratación para no enviar el formulario de forma nativa antes de tiempo.
  await page.waitForLoadState("networkidle");
}

function fields(page: Page) {
  return {
    fullName: page.getByLabel("Nombres completos", { exact: true }),
    country: page.getByLabel("País", { exact: true }),
    phone: page.getByLabel("Celular", { exact: true }),
    company: page.getByLabel("Empresa u ocupación", { exact: true }),
    crm: page.getByRole("checkbox", { name: "¿Deseas adquirir el CRM con Agente IA?" }),
    submit: page.getByRole("button", { name: "Enviar y participar" }),
  };
}

test.beforeEach(async () => {
  await resetFirestore();
});

test("la página muestra el logo, los tres campos y ningún trámite legal", async ({ page }) => {
  await openForm(page);
  const form = fields(page);

  await expect(page.getByRole("img", { name: "Creando Valor", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Regístrate en el sorteo" })).toBeVisible();
  await expect(form.fullName).toBeVisible();
  await expect(form.phone).toBeVisible();
  await expect(form.company).toBeVisible();
  await expect(form.submit).toBeVisible();

  // Sin consentimiento, finalidad, política de privacidad ni reCAPTCHA (FR-033, SC-014): la única
  // casilla es la pregunta opcional del CRM (feature 004), desmarcada.
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await expect(form.crm).toBeVisible();
  await expect(form.crm).not.toBeChecked();
  await expect(page.getByText(/consentimiento|privacidad|reCAPTCHA|finalidad/i)).toHaveCount(0);
  // El único enlace es «Volver a la pantalla principal» (ningún enlace legal).
  await expect(page.getByRole("link")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Volver a la pantalla principal" })).toHaveAttribute(
    "href",
    "/",
  );

  // Mobile-first: sin desplazamiento horizontal.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

async function fillAndSubmit(
  page: Page,
  values: {
    fullName: string;
    phone: string;
    company: string;
    /** Código del país en el selector (p. ej. `CL`); por defecto se deja Perú. */
    country?: string;
    crm?: boolean;
  } = {
    fullName: "José Núñez Güemes",
    phone: "987 654 321",
    company: "Cautiva Marketing",
  },
): Promise<void> {
  const form = fields(page);
  await form.fullName.fill(values.fullName);
  if (values.country) {
    await form.country.selectOption(values.country);
  }
  await form.phone.fill(values.phone);
  await form.company.fill(values.company);
  if (values.crm) {
    await form.crm.check();
  }
  await form.submit.click();
}

test("el selector de país tiene Perú (+51) preseleccionado y lista los 12 países", async ({
  page,
}) => {
  await openForm(page);
  const country = fields(page).country;

  await expect(country).toHaveValue("PE");
  await expect(country.locator("option:checked")).toHaveText("Perú (+51)");
  await expect(country.locator("option")).toHaveCount(12);
  await expect(country.locator("option").first()).toHaveText("Perú (+51)");
  await expect(country.locator("option", { hasText: "Chile (+56)" })).toHaveCount(1);
});

test("no se muestra el texto de ayuda «9 dígitos, por ejemplo»", async ({ page }) => {
  await openForm(page);

  await expect(page.getByText(/9 dígitos, por ejemplo/i)).toHaveCount(0);
});

test("un celular de Chile con un solo nombre se registra y se ve con su prefijo", async ({
  page,
}) => {
  await openForm(page);
  await fillAndSubmit(page, {
    fullName: "María",
    country: "CL",
    phone: "9 1234 5678",
    company: "Cautiva",
  });

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
  await expect(dialog.getByText("María", { exact: true })).toBeVisible();
  await expect(dialog.getByText("+56 9 1234 5678")).toBeVisible();
});

test("un número inválido para el país elegido muestra el error junto al campo", async ({
  page,
}) => {
  await openForm(page);
  const form = fields(page);
  await fillAndSubmit(page, {
    fullName: "María",
    country: "CL",
    phone: "812345678",
    company: "Cautiva",
  });

  await expect(form.phone).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/celular chileno de 9 dígitos/i)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("la casilla del CRM es opcional: se puede enviar con y sin marcarla", async ({ page }) => {
  await openForm(page);
  await fillAndSubmit(page, {
    fullName: "Ana Pérez",
    phone: "987654321",
    company: "Cautiva",
    crm: true,
  });
  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();

  await page.getByRole("button", { name: "Registrar a otra persona" }).click();
  await expect(fields(page).crm).not.toBeChecked();
  await fillAndSubmit(page, { fullName: "Luis Gómez", phone: "912345678", company: "Cautiva" });
  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
});

test("un envío válido muestra la ventana de bienvenida con el nombre y el ticket", async ({
  page,
}) => {
  await openForm(page);
  await fillAndSubmit(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
  await expect(dialog.getByText("José Núñez Güemes")).toBeVisible();
  await expect(dialog.getByText("+51 987 654 321")).toBeVisible();
  await expect(dialog.getByText("En sorteo")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Listo, muchas gracias" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Registrar a otra persona" })).toBeVisible();
});

test("«Registrar a otra persona» deja el formulario vacío con el foco en el primer campo", async ({
  page,
}) => {
  await openForm(page);
  const form = fields(page);
  await fillAndSubmit(page);

  await page.getByRole("button", { name: "Registrar a otra persona" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("¡Gracias por registrarte!")).toHaveCount(0);
  await expect(form.fullName).toHaveValue("");
  await expect(form.phone).toHaveValue("");
  await expect(form.company).toHaveValue("");
  await expect(form.country).toHaveValue("PE");
  await expect(form.crm).not.toBeChecked();
  await expect(form.fullName).toBeFocused();
});

test("«Listo, muchas gracias» muestra el aviso final sin el formulario", async ({ page }) => {
  await openForm(page);
  await fillAndSubmit(page);

  await page.getByRole("button", { name: "Listo, muchas gracias" }).click();

  await expect(page.getByText("¡Gracias por registrarte!")).toBeVisible();
  await expect(fields(page).fullName).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Creando Valor", exact: true })).toBeVisible();
});

test("el aviso final muestra las redes sociales con enlaces seguros y táctiles", async ({
  page,
}) => {
  await openForm(page);
  await fillAndSubmit(page);
  await page.getByRole("button", { name: "Listo, muchas gracias" }).click();

  const panel = page.getByRole("status").filter({ hasText: "¡Gracias por registrarte!" });
  await expect(panel.getByText("Síguenos en nuestras redes sociales")).toBeVisible();

  const links = [
    { name: "Cautiva Marketing", href: "https://www.facebook.com/cautivamarketingperu" },
    { name: "Satelcom del Sur", href: "https://www.facebook.com/satelcomdelsur" },
  ];
  for (const { name, href } of links) {
    const link = panel.getByRole("link", { name });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("rel", /noreferrer/);
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  // Alcanzables con el teclado.
  await panel.getByRole("link", { name: "Cautiva Marketing" }).focus();
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("link", { name: "Satelcom del Sur" })).toBeFocused();
});

test("la ventana «ya registrado» y el aviso de cierre no muestran las redes sociales", async ({
  page,
}) => {
  await openForm(page);
  await fillAndSubmit(page);
  await page.getByRole("button", { name: "Registrar a otra persona" }).click();
  await fillAndSubmit(page);
  const dialog = page.getByRole("dialog", { name: "Ya estás participando en el sorteo" });
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Síguenos en nuestras redes sociales")).toHaveCount(0);

  await setRegistrationOpen(false);
  await page.goto("/registro");
  await expect(
    page.getByRole("heading", { name: "Las inscripciones están cerradas" }),
  ).toBeVisible();
  await expect(page.getByText("Síguenos en nuestras redes sociales")).toHaveCount(0);
});

test("Escape cierra la ventana igual que «Listo, muchas gracias»", async ({ page }) => {
  await openForm(page);
  await fillAndSubmit(page);
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("¡Gracias por registrarte!")).toBeVisible();
});

test("con el teclado el foco no sale de la ventana y el nombre largo no desborda", async ({
  page,
}) => {
  await openForm(page);
  await fillAndSubmit(page, {
    fullName: "Ana ".repeat(24) + "Anaa", // 100 caracteres
    phone: "987654321",
    company: "Cautiva Marketing",
  });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-labelledby", /.+/);

  // Un <dialog> modal deja inerte la página de atrás: el foco da vueltas dentro de la ventana
  // (o pasa un instante al navegador, que aquí se ve como `body`) y nunca llega al formulario.
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        inDialog: active?.closest("dialog") != null,
        isBody: active === document.body,
        inForm: active?.closest("form") != null,
      };
    });
    expect(focus.inForm).toBe(false);
    expect(focus.inDialog || focus.isBody).toBe(true);
  }

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});

test("con movimiento reducido no se muestra el confeti", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openForm(page);
  await fillAndSubmit(page);

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("[data-confetti]")).toBeHidden();
});

test("sin movimiento reducido el confeti se muestra", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openForm(page);
  await fillAndSubmit(page);

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("[data-confetti]")).toBeVisible();
});

test("los errores aparecen junto a cada campo y se conserva lo escrito", async ({ page }) => {
  await openForm(page);
  const form = fields(page);

  // Todo vacío.
  await form.submit.click();
  await expect(form.fullName).toHaveAttribute("aria-invalid", "true");
  await expect(form.phone).toHaveAttribute("aria-invalid", "true");
  await expect(form.company).toHaveAttribute("aria-invalid", "true");

  // Nombre de una sola letra, celular inválido y empresa de 101 caracteres.
  await form.fullName.fill("A");
  await form.phone.fill("812345678");
  const longCompany = "a".repeat(101);
  await form.company.fill(longCompany);
  await form.submit.click();

  const describedError = async (field: ReturnType<typeof fields>["fullName"]) => {
    const describedBy = await field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    return page.locator("#" + (describedBy ?? "").split(" ").at(-1));
  };
  await expect(await describedError(form.fullName)).toContainText(/solo letras/i);
  await expect(await describedError(form.phone)).toContainText(/celular/i);
  await expect(await describedError(form.company)).toContainText(/100/);

  await expect(form.fullName).toHaveValue("A");
  await expect(form.phone).toHaveValue("812345678");
  await expect(form.company).toHaveValue(longCompany);
  await expect(page.getByText("¡Gracias por registrarte!")).toHaveCount(0);
});

test("con las inscripciones cerradas se muestra el aviso y no el formulario", async ({ page }) => {
  await setRegistrationOpen(false);
  await page.goto("/registro");

  await expect(page.getByRole("img", { name: "Creando Valor", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Las inscripciones están cerradas" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nombres completos", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar y participar" })).toHaveCount(0);
});

test("el enlace «Volver a la pantalla principal» está bajo el botón y lleva a la pantalla del QR", async ({
  page,
}) => {
  await openForm(page);
  const submit = fields(page).submit;
  const back = page.getByRole("link", { name: "Volver a la pantalla principal" });

  await expect(back).toBeVisible();
  const submitBox = await submit.boundingBox();
  const backBox = await back.boundingBox();
  expect(backBox?.y ?? 0).toBeGreaterThan((submitBox?.y ?? 0) + (submitBox?.height ?? 0));

  await back.click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();
});

test("el enlace de regreso también está en el aviso final y en el de inscripciones cerradas", async ({
  page,
}) => {
  await openForm(page);
  await fillAndSubmit(page);
  await page.getByRole("button", { name: "Listo, muchas gracias" }).click();
  await expect(page.getByText("¡Gracias por registrarte!")).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver a la pantalla principal" })).toBeVisible();

  await setRegistrationOpen(false);
  await page.goto("/registro");
  await expect(
    page.getByRole("heading", { name: "Las inscripciones están cerradas" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver a la pantalla principal" })).toBeVisible();
});

test("la página de política de privacidad ya no existe (404)", async ({ page }) => {
  const response = await page.goto("/privacidad");
  expect(response?.status()).toBe(404);
});
