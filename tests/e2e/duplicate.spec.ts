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
  openForm,
  registerViaForm,
  submitAnswers,
} from "./helpers/registration";

// La primera petición compila las rutas en modo desarrollo: se dejan márgenes amplios.
test.setTimeout(90_000);
test.use({ actionTimeout: 30_000 });

const ALREADY_HEADING = "Ya estás participando en el sorteo";

test.beforeEach(async () => {
  await resetFirestore();
});

test("reintentar con otro formato de celular y otro nombre avisa «ya estás participando» antes del paso 2", async ({
  page,
}) => {
  await openForm(page);
  await registerViaForm(page);
  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar a otra persona" }).click();

  await fillStepOne(page, {
    fullName: "Otra Persona",
    phone: "+51 987-654-321",
    company: "Otra Empresa",
  });
  await clickNext(page);

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: ALREADY_HEADING })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Registrar a otra persona" })).toBeVisible();
  // No se muestra el paso 2 ni la ventana de bienvenida.
  await expect(page.getByText("Paso 2 de 2")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toHaveCount(0);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  // No revela datos del registro existente.
  await expect(dialog.getByText(/José|Núñez|987/)).toHaveCount(0);
  expect(await countParticipants()).toBe(1);

  // «Registrar a otra persona» devuelve el formulario vacío en el paso 1.
  await dialog.getByRole("button", { name: "Registrar a otra persona" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Paso 1 de 2")).toBeVisible();
  await expect(formFields(page).fullName).toHaveValue("");
  await expect(formFields(page).phone).toHaveValue("");
});

test("el mismo número local en otro país es otro participante, no un duplicado", async ({
  page,
}) => {
  await openForm(page);
  await registerViaForm(page);
  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar a otra persona" }).click();

  await registerViaForm(page, {
    fullName: "Sofía",
    country: "CL",
    phone: "987654321",
    company: "Tienda Sur",
  });

  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();
  expect(await countParticipants()).toBe(2);
});

test("volver al paso 1 y cambiar el celular por uno ya registrado vuelve a comprobarlo", async ({
  page,
}) => {
  await openForm(page);
  await registerViaForm(page, { ...DEFAULT_STEP_ONE, phone: "912345678" });
  await page.getByRole("button", { name: "Registrar a otra persona" }).click();

  // Con un celular libre llega al paso 2...
  await fillStepOne(page, { fullName: "Luis Gómez", phone: "987654321", company: "Cautiva" });
  await clickNext(page);
  await expect(page.getByText("Paso 2 de 2")).toBeVisible();

  // ...vuelve, lo cambia por uno ya registrado y la comprobación se repite.
  await formFields(page).back.click();
  await formFields(page).phone.fill("912345678");
  await clickNext(page);

  await expect(page.getByRole("heading", { name: ALREADY_HEADING })).toBeVisible();
  await expect(page.getByText("Paso 2 de 2")).toHaveCount(0);
  expect(await countParticipants()).toBe(1);
});

test("el mismo número en dos pestañas: gana la primera y sus respuestas no se modifican", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await openForm(page);
  await openForm(other);

  // Ambas pasan el paso 1 porque el celular todavía está libre.
  await fillStepOne(page, DEFAULT_STEP_ONE);
  await clickNext(page);
  await fillStepOne(other, { ...DEFAULT_STEP_ONE, fullName: "Otra Persona" });
  await clickNext(other);
  await expect(other.getByText("Paso 2 de 2")).toBeVisible();

  await fillAnswers(page, { ...DEFAULT_ANSWERS, crm: "yes", gps: "yes" });
  await submitAnswers(page);
  await expect(page.getByRole("heading", { name: "¡Bienvenido(a)!" })).toBeVisible();

  await fillAnswers(other, { ...DEFAULT_ANSWERS, crm: "no", gps: "no", trainingArea: "Finanzas" });
  await submitAnswers(other);

  await expect(other.getByRole("heading", { name: ALREADY_HEADING })).toBeVisible();
  expect(await countParticipants()).toBe(1);
  expect(await readParticipantStrings("+51987654321")).toMatchObject({
    fullName: "José Núñez Güemes",
    trainingArea: DEFAULT_ANSWERS.trainingArea,
    crmInterest: "yes",
    gpsInterest: "yes",
  });
});

test("sin conexión al tocar «Siguiente» se queda en el paso 1 con lo escrito y se puede reintentar", async ({
  page,
}) => {
  await openForm(page);
  const form = formFields(page);
  await fillStepOne(page);
  await page.route("**/api/registrations/check", (route) => route.abort());

  await clickNext(page);

  await expect(page.getByText(/No pudimos conectar con el servidor/)).toBeVisible();
  await expect(page.getByText("Paso 1 de 2")).toBeVisible();
  await expect(form.fullName).toHaveValue(DEFAULT_STEP_ONE.fullName);
  await expect(form.phone).toHaveValue(DEFAULT_STEP_ONE.phone);

  await page.unroute("**/api/registrations/check");
  await clickNext(page);
  await expect(page.getByText("Paso 2 de 2")).toBeVisible();
});

test("con las inscripciones cerradas en el paso 1, «Siguiente» muestra el aviso de cierre", async ({
  page,
}) => {
  await openForm(page);
  await fillStepOne(page);
  await setRegistrationOpen(false);

  await clickNext(page);

  await expect(
    page.getByRole("heading", { name: "Las inscripciones están cerradas" }),
  ).toBeVisible();
  await expect(page.getByText("Paso 2 de 2")).toHaveCount(0);
  expect(await countParticipants()).toBe(0);
});

test("un doble clic en «Siguiente» envía una sola comprobación y avanza una vez", async ({
  page,
}) => {
  let checks = 0;
  await page.route("**/api/registrations/check", async (route) => {
    checks += 1;
    await route.continue();
  });
  await openForm(page);
  await fillStepOne(page);

  await formFields(page).next.dblclick();

  await expect(page.getByText("Paso 2 de 2")).toBeVisible();
  expect(checks).toBe(1);
});
