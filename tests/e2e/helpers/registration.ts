/**
 * Helpers de Playwright para el formulario de registro en dos pasos (feature 005): paso 1 con los
 * datos generales y «Siguiente»; paso 2 con las cuatro preguntas y «Enviar y participar».
 */
import type { Locator, Page } from "@playwright/test";

export interface StepOneValues {
  fullName: string;
  phone: string;
  company: string;
  /** Código del país en el selector (p. ej. `CL`); por defecto se deja Perú. */
  country?: string;
}

export type InterestChoice = "yes" | "maybe" | "no";

export interface AnswerValues {
  trainingArea: string;
  guestSuggestion: string;
  crm: InterestChoice;
  gps: InterestChoice;
}

export const DEFAULT_STEP_ONE: StepOneValues = {
  fullName: "José Núñez Güemes",
  phone: "987 654 321",
  company: "Cautiva Marketing",
};

export const DEFAULT_ANSWERS: AnswerValues = {
  trainingArea: "Ventas y atención al cliente",
  guestSuggestion: "Un experto en marketing digital",
  crm: "maybe",
  gps: "no",
};

/** Texto de cada opción de los desplegables de interés. */
export const CRM_LABELS: Record<InterestChoice, string> = {
  yes: "Sí, me interesa",
  maybe: "Tal vez, envíenme más información",
  no: "No, por ahora",
};
export const GPS_LABELS: Record<InterestChoice, string> = {
  yes: "Sí, me interesa",
  maybe: "Tal vez, envíenme una cotización",
  no: "No, por ahora",
};

export const CRM_QUESTION = "¿Deseas adquirir el CRM con Agente IA de Cautiva?";
export const GPS_QUESTION =
  "¿Te interesa un GPS satelital o una cámara para tu vehículo (Satelcom)?";
export const TRAINING_QUESTION = "¿En qué área te gustaría capacitarte?";
export const GUEST_QUESTION = "¿Qué invitado te gustaría que trajéramos a Creando Valor?";

/** Controles del formulario, ubicados por su nombre accesible. */
export function formFields(page: Page) {
  return {
    fullName: page.getByLabel("Nombres completos", { exact: true }),
    country: page.getByLabel("País", { exact: true }),
    phone: page.getByLabel("Celular", { exact: true }),
    company: page.getByLabel("Empresa u ocupación", { exact: true }),
    next: page.getByRole("button", { name: "Siguiente" }),
    back: page.getByRole("button", { name: "Atrás" }),
    submit: page.getByRole("button", { name: "Enviar y participar" }),
    trainingArea: page.getByLabel(TRAINING_QUESTION, { exact: true }),
    guestSuggestion: page.getByLabel(GUEST_QUESTION, { exact: true }),
    crmSelect: page.getByLabel(CRM_QUESTION, { exact: true }),
    gpsSelect: page.getByLabel(GPS_QUESTION, { exact: true }),
  };
}

/** Abre `/registro` y espera a la hidratación para no enviar el formulario de forma nativa. */
export async function openForm(page: Page): Promise<void> {
  await page.goto("/registro");
  await page.waitForLoadState("networkidle");
}

/** Escribe los datos del paso 1 sin avanzar. */
export async function fillStepOne(page: Page, values: StepOneValues = DEFAULT_STEP_ONE) {
  const form = formFields(page);
  await form.fullName.fill(values.fullName);
  if (values.country) {
    await form.country.selectOption(values.country);
  }
  await form.phone.fill(values.phone);
  await form.company.fill(values.company);
}

export async function clickNext(page: Page): Promise<void> {
  await formFields(page).next.click();
}

/** Desplegable de una de las preguntas de interés. */
export function interestSelect(page: Page, question: "crm" | "gps"): Locator {
  const form = formFields(page);
  return question === "crm" ? form.crmSelect : form.gpsSelect;
}

/** Responde las cuatro preguntas del paso 2 sin enviar. */
export async function fillAnswers(page: Page, values: AnswerValues = DEFAULT_ANSWERS) {
  const form = formFields(page);
  await form.trainingArea.fill(values.trainingArea);
  await form.guestSuggestion.fill(values.guestSuggestion);
  await interestSelect(page, "crm").selectOption(values.crm);
  await interestSelect(page, "gps").selectOption(values.gps);
}

export async function submitAnswers(page: Page): Promise<void> {
  await formFields(page).submit.click();
}

/** Recorre los dos pasos y envía el registro (abre la ventana de bienvenida o el aviso que toque). */
export async function registerViaForm(
  page: Page,
  stepOne: StepOneValues = DEFAULT_STEP_ONE,
  answers: AnswerValues = DEFAULT_ANSWERS,
): Promise<void> {
  await fillStepOne(page, stepOne);
  await clickNext(page);
  await fillAnswers(page, answers);
  await submitAnswers(page);
}
