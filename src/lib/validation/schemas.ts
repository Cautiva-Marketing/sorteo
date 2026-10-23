import { z } from "zod";
import { INTEREST_VALUES } from "@/lib/interest";
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from "@/lib/validation/countries";
import { normalizePhone, phoneErrorMessage } from "@/lib/validation/phone";

/** Máximos de longitud (FR-003, FR-005). */
export const FULL_NAME_MAX = 100;
export const COMPANY_MIN = 2;
export const COMPANY_MAX = 100;
/** Largo de las respuestas de texto libre del paso 2 (FR-126). */
export const ANSWER_MIN = 2;
export const ANSWER_MAX = 100;

const FULL_NAME_MESSAGE = "Ingresa tu nombre usando solo letras, espacios y tildes.";
const PHONE_REQUIRED_MESSAGE = "Ingresa tu número de celular.";
const COUNTRY_MESSAGE = "Elige un país de la lista.";
const INTEREST_MESSAGE = "Elige una opción.";
const ANSWER_MAX_MESSAGE = `La respuesta no puede pasar de ${ANSWER_MAX} caracteres.`;
const ANSWER_CONTROL_MESSAGE = "La respuesta no puede contener caracteres especiales de control.";
const TRAINING_AREA_MESSAGE = `Cuéntanos en qué área te gustaría capacitarte (mínimo ${ANSWER_MIN} caracteres).`;
const GUEST_MESSAGE = `Cuéntanos qué invitado te gustaría que trajéramos (mínimo ${ANSWER_MIN} caracteres).`;
/** Mínimo de letras del nombre en total (un solo nombre es válido, FR-099). */
const FULL_NAME_MIN_LETTERS = 2;
const CONTROL_CHARACTERS = /\p{Cc}/u;
const NAME_TERM = /^\p{L}+$/u;

/** Recorta y colapsa los espacios repetidos. */
function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

const fullNameSchema = z
  .string({ error: "Ingresa tus nombres completos." })
  .transform((value) => collapseSpaces(value.normalize("NFC")))
  .pipe(
    z
      .string()
      // Sin `abort`: un nombre vacío no debe impedir que se informen también los demás campos.
      .min(1, "Ingresa tus nombres completos.")
      .max(FULL_NAME_MAX, `Los nombres no pueden pasar de ${FULL_NAME_MAX} caracteres.`)
      .refine((value) => {
        if (value === "") {
          return true; // ya lo informa `min(1)`
        }
        // Uno o más términos de solo letras y al menos 2 letras en total.
        const terms = value.split(" ");
        const letters = value.replaceAll(" ", "").length;
        return letters >= FULL_NAME_MIN_LETTERS && terms.every((term) => NAME_TERM.test(term));
      }, FULL_NAME_MESSAGE),
  );

const companySchema = z
  .string({ error: "Ingresa tu empresa u ocupación." })
  .refine(
    (value) => !CONTROL_CHARACTERS.test(value),
    "La empresa u ocupación no puede contener caracteres especiales de control.",
  )
  .transform(collapseSpaces)
  .pipe(
    z
      .string()
      .min(COMPANY_MIN, `Ingresa tu empresa u ocupación (mínimo ${COMPANY_MIN} caracteres).`)
      .max(COMPANY_MAX, `La empresa u ocupación no puede pasar de ${COMPANY_MAX} caracteres.`),
  );

/**
 * Respuesta de texto libre del paso 2: NFC, cualquier espacio en blanco (saltos de línea y tabulaciones
 * incluidos) pasa a un espacio simple y se recorta; después no puede quedar ningún carácter de control y
 * el largo debe estar entre `ANSWER_MIN` y `ANSWER_MAX` (research D-404). Es texto plano: nunca se
 * interpreta como HTML ni como fórmula (el CSV la neutraliza).
 */
function answerSchema(requiredMessage: string) {
  return z
    .string({ error: requiredMessage })
    .transform((value) => collapseSpaces(value.normalize("NFC")))
    .pipe(
      z
        .string()
        .refine((value) => !CONTROL_CHARACTERS.test(value), ANSWER_CONTROL_MESSAGE)
        .min(ANSWER_MIN, requiredMessage)
        .max(ANSWER_MAX, ANSWER_MAX_MESSAGE),
    );
}

/** Interés Sí / Tal vez / No: obligatorio y sin valor por defecto (ninguna opción preseleccionada). */
const interestSchema = z.enum(INTEREST_VALUES, { error: INTEREST_MESSAGE });

/** País del celular; Perú si no llega. */
const countrySchema = z.enum(COUNTRY_CODES, { error: COUNTRY_MESSAGE }).default(DEFAULT_COUNTRY);

/** Número local tal como lo escribe la persona; se valida junto con el país (`phoneRefinement`). */
const phoneInputSchema = z.string({ error: PHONE_REQUIRED_MESSAGE });

function toCountryCode(value: unknown): CountryCode | null {
  return COUNTRY_CODES.find((code) => code === value) ?? null;
}

/**
 * El celular depende del país, por eso se valida a nivel de objeto (research D-303). Compartida por
 * `registrationSchema` y `registrationCheckSchema` para que ambos acepten y rechacen lo mismo.
 */
function hasValidPhone(data: { country: unknown; phone: unknown }): boolean {
  const country = toCountryCode(data.country);
  if (typeof data.phone !== "string" || country === null) {
    return true; // ya lo informan `phone` o `country`
  }
  return normalizePhone(country, data.phone) !== null;
}

/**
 * Opciones de `.refine(hasValidPhone, …)`. `when` fuerza la comprobación aunque otro campo ya tenga
 * errores, para informar todos los errores a la vez.
 */
const phoneRefinement = {
  path: ["phone"],
  error: (issue: { input?: unknown }) => {
    const input = issue.input as { country?: unknown } | undefined;
    return phoneErrorMessage(toCountryCode(input?.country) ?? DEFAULT_COUNTRY);
  },
  when: () => true,
};

/**
 * Esquema único del registro, compartido por el formulario (React Hook Form) y por el Route
 * Handler (constitución II). Entrada: valores tal como los escribe el visitante; salida:
 * valores normalizados (NFC, espacios colapsados, celular en E.164). Las cuatro respuestas del paso 2
 * son obligatorias.
 */
export const registrationSchema = z
  .object({
    fullName: fullNameSchema,
    country: countrySchema,
    phone: phoneInputSchema,
    company: companySchema,
    /** «¿En qué área te gustaría capacitarte?» (texto libre). */
    trainingArea: answerSchema(TRAINING_AREA_MESSAGE),
    /** «¿Qué invitado te gustaría que trajéramos a Creando Valor?» (texto libre). */
    guestSuggestion: answerSchema(GUEST_MESSAGE),
    /** Interés en el CRM con Agente IA de Cautiva. */
    crmInterest: interestSchema,
    /** Interés en un GPS satelital o cámara de Satelcom. */
    gpsInterest: interestSchema,
  })
  .refine(hasValidPhone, phoneRefinement)
  .transform(({ country, phone, ...rest }) => ({
    ...rest,
    // Ya validado arriba; el `??` solo satisface al compilador.
    phone: normalizePhone(country, phone) ?? phone,
  }));

/** Datos tal como los escribe el visitante. */
export type RegistrationFormInput = z.input<typeof registrationSchema>;

/** Datos validados y normalizados. */
export type RegistrationInput = z.output<typeof registrationSchema>;

/**
 * Cuerpo de `POST /api/registrations/check` (paso 1 del formulario): solo el país y el celular, con la
 * misma regla que el registro. Salida: el celular en E.164.
 */
export const registrationCheckSchema = z
  .object({ country: countrySchema, phone: phoneInputSchema })
  .refine(hasValidPhone, phoneRefinement)
  .transform(({ country, phone }) => ({ phone: normalizePhone(country, phone) ?? phone }));

export type RegistrationCheckInput = z.output<typeof registrationCheckSchema>;

/** Cuerpo de `PUT /api/admin/registration`: abrir (`true`) o cerrar (`false`) las inscripciones. */
export const registrationStatusSchema = z.object({
  open: z.boolean({ error: "Indica si las inscripciones deben estar abiertas o cerradas." }),
});

export type RegistrationStatusInput = z.output<typeof registrationStatusSchema>;

/** Formulario de inicio de sesión del panel (solo validación de campos requeridos). */
export const loginSchema = z.object({
  email: z
    .string({ error: "Ingresa tu correo electrónico." })
    .trim()
    .min(1, "Ingresa tu correo electrónico.")
    .pipe(z.email("Ingresa un correo electrónico válido.")),
  password: z.string({ error: "Ingresa tu contraseña." }).min(1, "Ingresa tu contraseña."),
});

export type LoginInput = z.output<typeof loginSchema>;

/** Cuerpo de `POST /api/admin/session`: ID token de Firebase Auth del administrador. */
export const sessionRequestSchema = z.object({
  idToken: z
    .string({ error: "Falta el token de inicio de sesión." })
    .min(1, "Falta el token de inicio de sesión."),
});

/** Límites de un premio (FR-060). */
export const PRIZE_NAME_MIN = 2;
export const PRIZE_NAME_MAX = 60;
export const PRIZE_QUANTITY_MIN = 1;
export const PRIZE_QUANTITY_MAX = 100;

const PRIZE_NAME_LENGTH_MESSAGE = `El nombre debe tener entre ${PRIZE_NAME_MIN} y ${PRIZE_NAME_MAX} caracteres.`;
const PRIZE_QUANTITY_MESSAGE = `Ingresa una cantidad entera entre ${PRIZE_QUANTITY_MIN} y ${PRIZE_QUANTITY_MAX}.`;

const prizeNameSchema = z
  .string({ error: "Ingresa el nombre del premio." })
  .refine(
    (value) => !CONTROL_CHARACTERS.test(value),
    "El nombre no puede contener caracteres especiales de control.",
  )
  .transform((value) => collapseSpaces(value.normalize("NFC")))
  .pipe(
    z
      .string()
      .min(1, { error: "Ingresa el nombre del premio.", abort: true })
      .min(PRIZE_NAME_MIN, PRIZE_NAME_LENGTH_MESSAGE)
      .max(PRIZE_NAME_MAX, PRIZE_NAME_LENGTH_MESSAGE),
  );

/** El formulario entrega la cantidad como texto: se convierte a número antes de validarla. */
const prizeQuantitySchema = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
    z
      .number({ error: PRIZE_QUANTITY_MESSAGE })
      .int(PRIZE_QUANTITY_MESSAGE)
      .min(PRIZE_QUANTITY_MIN, PRIZE_QUANTITY_MESSAGE)
      .max(PRIZE_QUANTITY_MAX, PRIZE_QUANTITY_MESSAGE),
  )
  .default(PRIZE_QUANTITY_MIN);

/**
 * Cuerpo de `POST /api/admin/prizes` y `PUT /api/admin/prizes/{id}`, compartido con el formulario
 * de premios: nombre de 2 a 60 caracteres sin caracteres de control y cantidad entera de 1 a 100
 * (por defecto 1). La unicidad del nombre y `quantity >= delivered` los valida el servicio.
 */
export const prizeSchema = z.object({
  name: prizeNameSchema,
  quantity: prizeQuantitySchema,
});

export type PrizeFormInput = z.input<typeof prizeSchema>;
export type PrizeInput = z.output<typeof prizeSchema>;

/** Cuerpo de `PUT /api/admin/prizes/order`: todos los ids de premio, sin repetidos, en el orden nuevo. */
export const prizeOrderSchema = z.object({
  ids: z
    .array(z.string().min(1, "La lista de premios no es válida."), {
      error: "La lista de premios no es válida.",
    })
    .min(1, "La lista de premios no es válida.")
    .refine((ids) => new Set(ids).size === ids.length, "La lista de premios no es válida."),
});

export type PrizeOrderInput = z.output<typeof prizeOrderSchema>;

/**
 * Cuerpo de `POST /api/admin/spins`: el premio por el que se gira. Ya no se pide confirmar el cierre
 * de inscripciones (FR-106): el giro real las cierra solo; una clave antigua de confirmación
 * enviada por clientes viejos se ignora.
 */
export const spinRequestSchema = z.object({
  prizeId: z.string({ error: "Elige un premio." }).min(1, "Elige un premio."),
});

export type SpinRequestInput = z.output<typeof spinRequestSchema>;

/** Frase que el administrador debe escribir para confirmar el borrado definitivo de datos. */
export const PURGE_CONFIRMATION = "BORRAR";

/** Cuerpo de `DELETE /api/admin/participants`: la frase de confirmación literal `BORRAR`. */
export const purgeRequestSchema = z.object({
  confirm: z.literal(PURGE_CONFIRMATION, {
    error: `Escribe ${PURGE_CONFIRMATION} para confirmar el borrado.`,
  }),
});

export type PurgeRequestInput = z.output<typeof purgeRequestSchema>;
