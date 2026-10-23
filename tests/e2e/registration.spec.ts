import { expect, test } from "@playwright/test";
import {
  countParticipants,
  readParticipantStrings,
  resetFirestore,
  setRegistrationOpen,
} from "./helpers/emulators";
import {
  clickNext,
  DEFAULT_ANSWERS,
  DEFAULT_STEP_ONE,
  fillAnswers,
  fillStepOne,
  formFields,
  CRM_LABELS,
  GPS_LABELS,
  interestSelect,
  openForm,
  registerViaForm,
  submitAnswers,
} from "./helpers/registration";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(90_000);
test.use({ actionTimeout: 30_000 });

test.beforeEach(async () => {
  await resetFirestore();
});

test("la página muestra el logo, los tres campos del paso 1 y ningún trámite legal", async ({
  page,
}) => {
  await openForm(page);
  const form = formFields(page);

  await expect(page.getByRole("img", { name: "Creando Valor", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Regístrate en el sorteo" })).toBeVisible();
  await expect(page.getByText("Paso 1 de 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
  await expect(form.fullName).toBeVisible();
  await expect(form.phone).toBeVisible();
  await expect(form.company).toBeVisible();
  await expect(form.next).toBeVisible();

  // El paso 2 y su botón no se ven todavía, y ya no existe la casilla del CRM (feature 005).
  await expect(form.submit).toHaveCount(0);
  await expect(form.trainingArea).toBeHidden();
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  // Sin consentimiento, finalidad, política de privacidad ni reCAPTCHA (FR-033, SC-014).
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

test("el selector de país tiene Perú (+51) preseleccionado y lista los 12 países", async ({
  page,
}) => {
  await openForm(page);
  const country = formFields(page).country;

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

test.describe("flujo de dos pasos", () => {
  test("«Siguiente» con el paso 1 vacío no avanza y marca los tres campos", async ({ page }) => {
    await openForm(page);
    const form = formFields(page);

    await clickNext(page);

    await expect(form.fullName).toHaveAttribute("aria-invalid", "true");
    await expect(form.phone).toHaveAttribute("aria-invalid", "true");
    await expect(form.company).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Paso 1 de 2")).toBeVisible();
    await expect(page.getByText("Paso 2 de 2")).toHaveCount(0);
    await expect(form.trainingArea).toBeHidden();
    // El foco va al primer campo con error.
    await expect(form.fullName).toBeFocused();
  });

  test("con datos válidos muestra el paso 2 con las cuatro preguntas sin nada marcado", async ({
    page,
  }) => {
    await openForm(page);
    const form = formFields(page);

    await fillStepOne(page);
    await clickNext(page);

    await expect(page.getByText("Paso 2 de 2")).toBeVisible();
    const heading = page.getByRole("heading", { name: "Cuéntanos un poco más" });
    await expect(heading).toBeVisible();
    // El foco pasa al título del paso para que teclado y lectores de pantalla lo noten.
    await expect(heading).toBeFocused();
    await expect(form.fullName).toBeHidden();

    await expect(form.trainingArea).toBeVisible();
    await expect(form.trainingArea).toHaveValue("");
    await expect(form.guestSuggestion).toBeVisible();
    await expect(form.guestSuggestion).toHaveValue("");
    // Las dos preguntas de interés son desplegables que arrancan sin respuesta (no hay radios).
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(form.crmSelect).toHaveValue("");
    await expect(form.gpsSelect).toHaveValue("");
    await expect(form.crmSelect.locator("option")).toHaveText([
      "Elige una opción",
      CRM_LABELS.yes,
      CRM_LABELS.maybe,
      CRM_LABELS.no,
    ]);
    await expect(form.gpsSelect.locator("option")).toHaveText([
      "Elige una opción",
      GPS_LABELS.yes,
      GPS_LABELS.maybe,
      GPS_LABELS.no,
    ]);
    await expect(form.back).toBeVisible();
    await expect(form.submit).toBeVisible();
    await expect(form.next).toHaveCount(0);
  });

  test("«Atrás» conserva lo escrito en ambos pasos", async ({ page }) => {
    await openForm(page);
    const form = formFields(page);

    await fillStepOne(page);
    await clickNext(page);
    await fillAnswers(page);

    await form.back.click();
    await expect(page.getByText("Paso 1 de 2")).toBeVisible();
    await expect(form.fullName).toHaveValue(DEFAULT_STEP_ONE.fullName);
    await expect(form.phone).toHaveValue(DEFAULT_STEP_ONE.phone);
    await expect(form.company).toHaveValue(DEFAULT_STEP_ONE.company);

    await clickNext(page);
    await expect(page.getByText("Paso 2 de 2")).toBeVisible();
    await expect(form.trainingArea).toHaveValue(DEFAULT_ANSWERS.trainingArea);
    await expect(form.guestSuggestion).toHaveValue(DEFAULT_ANSWERS.guestSuggestion);
    await expect(interestSelect(page, "crm")).toHaveValue("maybe");
    await expect(interestSelect(page, "gps")).toHaveValue("no");
  });

  test("Enter en un campo del paso 1 avanza al paso 2 en lugar de enviar", async ({ page }) => {
    await openForm(page);
    await fillStepOne(page);

    await formFields(page).company.press("Enter");

    await expect(page.getByText("Paso 2 de 2")).toBeVisible();
    expect(await countParticipants()).toBe(0);
  });

  test("un número inválido para el país elegido muestra el error y no avanza", async ({ page }) => {
    await openForm(page);
    const form = formFields(page);
    await fillStepOne(page, {
      fullName: "María",
      country: "CL",
      phone: "812345678",
      company: "Cautiva",
    });
    await clickNext(page);

    await expect(form.phone).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(/celular chileno de 9 dígitos/i)).toBeVisible();
    await expect(page.getByText("Paso 2 de 2")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("enviar el paso 2 vacío no registra y muestra cada error bajo su pregunta", async ({
    page,
  }) => {
    await openForm(page);
    const form = formFields(page);
    await fillStepOne(page);
    await clickNext(page);

    await submitAnswers(page);

    await expect(form.trainingArea).toHaveAttribute("aria-invalid", "true");
    await expect(form.guestSuggestion).toHaveAttribute("aria-invalid", "true");
    await expect(form.crmSelect).toHaveAttribute("aria-invalid", "true");
    await expect(form.gpsSelect).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Elige una opción.", { exact: true })).toHaveCount(2);
    // Cada error está asociado a su control con `aria-describedby`.
    const describedBy = await form.trainingArea.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator("#" + (describedBy ?? "").split(" ").at(-1))).toContainText(/área/i);
    // El foco va al primer elemento con error.
    await expect(form.trainingArea).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await countParticipants()).toBe(0);
  });

  test("el foco va al primer desplegable sin responder cuando solo faltan las opciones", async ({
    page,
  }) => {
    await openForm(page);
    const form = formFields(page);
    await fillStepOne(page);
    await clickNext(page);
    await form.trainingArea.fill("Ventas");
    await form.guestSuggestion.fill("Un experto");

    await submitAnswers(page);

    await expect(page.getByText("Elige una opción.", { exact: true })).toHaveCount(2);
    await expect(form.crmSelect).toBeFocused();
    expect(await countParticipants()).toBe(0);
  });

  test("las respuestas de texto de 1 y de 101 caracteres muestran su error", async ({ page }) => {
    await openForm(page);
    const form = formFields(page);
    await fillStepOne(page);
    await clickNext(page);
    await form.crmSelect.selectOption("yes");
    await form.gpsSelect.selectOption("yes");

    await form.trainingArea.fill("a");
    await form.guestSuggestion.fill("b".repeat(101));
    await submitAnswers(page);

    await expect(page.getByText(/mínimo 2 caracteres/i)).toBeVisible();
    await expect(page.getByText("La respuesta no puede pasar de 100 caracteres.")).toBeVisible();
    await expect(form.trainingArea).toHaveValue("a");
    await expect(form.guestSuggestion).toHaveValue("b".repeat(101));
    expect(await countParticipants()).toBe(0);
  });

  test("con las cuatro respuestas válidas se registra y se guardan tal cual las elegidas", async ({
    page,
  }) => {
    await openForm(page);
    await registerViaForm(
      page,
      { fullName: "Ana Pérez", phone: "987654321", company: "Cautiva" },
      { trainingArea: "Ventas", guestSuggestion: "Un experto", crm: "yes", gps: "maybe" },
    );
    await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();

    // Cada opción de los desplegables debe guardarse con su propio valor.
    await page.getByRole("button", { name: "Registrar a otra persona" }).click();
    await registerViaForm(
      page,
      { fullName: "Luis Gómez", phone: "912345678", company: "Cautiva" },
      { trainingArea: "Liderazgo", guestSuggestion: "Una emprendedora", crm: "no", gps: "yes" },
    );
    await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();

    expect(await readParticipantStrings("+51987654321")).toMatchObject({
      trainingArea: "Ventas",
      guestSuggestion: "Un experto",
      crmInterest: "yes",
      gpsInterest: "maybe",
    });
    expect(await readParticipantStrings("+51912345678")).toMatchObject({
      trainingArea: "Liderazgo",
      guestSuggestion: "Una emprendedora",
      crmInterest: "no",
      gpsInterest: "yes",
    });
  });

  test("las áreas táctiles de los campos, los desplegables y los botones miden al menos 44 px", async ({
    page,
  }) => {
    await openForm(page);
    const form = formFields(page);
    await fillStepOne(page);
    const nextBox = await form.next.boundingBox();
    expect(nextBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await clickNext(page);
    for (const control of [
      form.trainingArea,
      form.guestSuggestion,
      form.crmSelect,
      form.gpsSelect,
      form.back,
      form.submit,
    ]) {
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("cada paso cabe en 360 px sin desplazamiento horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openForm(page);
    const overflows = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );

    expect(await overflows()).toBe(false);
    await fillStepOne(page);
    await clickNext(page);
    await expect(page.getByText("Paso 2 de 2")).toBeVisible();
    expect(await overflows()).toBe(false);
  });

  test("abandonar en el paso 2 no deja ningún registro", async ({ page }) => {
    await openForm(page);
    await fillStepOne(page);
    await clickNext(page);
    await fillAnswers(page);

    await page.goto("/");

    expect(await countParticipants()).toBe(0);
  });

  test("recargar la página en el paso 2 vuelve al paso 1 con el formulario vacío", async ({
    page,
  }) => {
    await openForm(page);
    const form = formFields(page);
    await fillStepOne(page);
    await clickNext(page);
    await expect(page.getByText("Paso 2 de 2")).toBeVisible();

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Paso 1 de 2")).toBeVisible();
    await expect(form.fullName).toHaveValue("");
    await expect(form.phone).toHaveValue("");
    await expect(form.company).toHaveValue("");
    expect(await countParticipants()).toBe(0);
  });

  test("un doble clic en «Enviar y participar» envía una sola petición y guarda un solo registro", async ({
    page,
  }) => {
    let requests = 0;
    await page.route("**/api/registrations", async (route) => {
      if (route.request().method() === "POST") {
        requests += 1;
      }
      await route.continue();
    });
    await openForm(page);
    await fillStepOne(page);
    await clickNext(page);
    await fillAnswers(page);

    await formFields(page).submit.dblclick();

    await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
    expect(requests).toBe(1);
    expect(await countParticipants()).toBe(1);
  });
});

test("un celular de Chile con un solo nombre se registra y se ve con su prefijo", async ({
  page,
}) => {
  await openForm(page);
  await registerViaForm(page, {
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

test("un envío válido muestra la ventana de bienvenida con el nombre y el ticket", async ({
  page,
}) => {
  await openForm(page);
  await registerViaForm(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
  await expect(dialog.getByText("José Núñez Güemes")).toBeVisible();
  await expect(dialog.getByText("+51 987 654 321")).toBeVisible();
  await expect(dialog.getByText("En sorteo")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Listo, muchas gracias" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Registrar a otra persona" })).toBeVisible();
});

test("«Registrar a otra persona» reinicia el formulario en el paso 1 con el foco en el primer campo", async ({
  page,
}) => {
  await openForm(page);
  const form = formFields(page);
  await registerViaForm(page);

  await page.getByRole("button", { name: "Registrar a otra persona" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("¡Gracias por registrarte!")).toHaveCount(0);
  await expect(page.getByText("Paso 1 de 2")).toBeVisible();
  await expect(form.fullName).toHaveValue("");
  await expect(form.phone).toHaveValue("");
  await expect(form.company).toHaveValue("");
  await expect(form.country).toHaveValue("PE");
  await expect(form.fullName).toBeFocused();

  // El paso 2 también queda limpio: sin texto y con los desplegables sin respuesta.
  await fillStepOne(page, { fullName: "Otra Persona", phone: "912345678", company: "Otra" });
  await clickNext(page);
  await expect(form.trainingArea).toHaveValue("");
  await expect(form.guestSuggestion).toHaveValue("");
  await expect(form.crmSelect).toHaveValue("");
  await expect(form.gpsSelect).toHaveValue("");
});

test("«Listo, muchas gracias» muestra el aviso final sin el formulario", async ({ page }) => {
  await openForm(page);
  await registerViaForm(page);

  await page.getByRole("button", { name: "Listo, muchas gracias" }).click();

  await expect(page.getByText("¡Gracias por registrarte!")).toBeVisible();
  await expect(formFields(page).fullName).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Creando Valor", exact: true })).toBeVisible();
});

test("el aviso final muestra las redes sociales con enlaces seguros y táctiles", async ({
  page,
}) => {
  await openForm(page);
  await registerViaForm(page);
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
  await registerViaForm(page);
  await page.getByRole("button", { name: "Registrar a otra persona" }).click();
  // El celular repetido se detecta al tocar «Siguiente», antes del paso 2.
  await fillStepOne(page);
  await clickNext(page);
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
  await registerViaForm(page);
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("¡Gracias por registrarte!")).toBeVisible();
});

test("con el teclado el foco no sale de la ventana y el nombre largo no desborda", async ({
  page,
}) => {
  await openForm(page);
  await registerViaForm(page, {
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
  await registerViaForm(page);

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("[data-confetti]")).toBeHidden();
});

test("sin movimiento reducido el confeti se muestra", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openForm(page);
  await registerViaForm(page);

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("[data-confetti]")).toBeVisible();
});

test("los errores del paso 1 aparecen junto a cada campo y se conserva lo escrito", async ({
  page,
}) => {
  await openForm(page);
  const form = formFields(page);

  // Nombre de una sola letra, celular inválido y empresa de 101 caracteres.
  await form.fullName.fill("A");
  await form.phone.fill("812345678");
  const longCompany = "a".repeat(101);
  await form.company.fill(longCompany);
  await clickNext(page);

  const describedError = async (field: ReturnType<typeof formFields>["fullName"]) => {
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
  await expect(page.getByText("Paso 2 de 2")).toHaveCount(0);
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
  await expect(page.getByRole("button", { name: "Siguiente" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar y participar" })).toHaveCount(0);
});

test("el enlace «Volver a la pantalla principal» está bajo el botón y lleva a la pantalla del QR", async ({
  page,
}) => {
  await openForm(page);
  const next = formFields(page).next;
  const back = page.getByRole("link", { name: "Volver a la pantalla principal" });

  await expect(back).toBeVisible();
  const nextBox = await next.boundingBox();
  const backBox = await back.boundingBox();
  expect(backBox?.y ?? 0).toBeGreaterThan((nextBox?.y ?? 0) + (nextBox?.height ?? 0));

  await back.click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("img", { name: /Código QR/ })).toBeVisible();
});

test("el enlace de regreso también está en el aviso final y en el de inscripciones cerradas", async ({
  page,
}) => {
  await openForm(page);
  await registerViaForm(page);
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
