"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AlreadyRegisteredDialog } from "@/components/registration/AlreadyRegisteredDialog";
import { BackToHomeLink } from "@/components/registration/BackToHomeLink";
import { ClosedNotice } from "@/components/registration/ClosedNotice";
import { StepProgress } from "@/components/registration/StepProgress";
import { ThanksPanel } from "@/components/registration/ThanksPanel";
import { WelcomeDialog } from "@/components/registration/WelcomeDialog";
import { Alert } from "@/components/ui/Alert";
import { PhoneField } from "@/components/registration/PhoneField";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { CRM_OPTIONS, GPS_OPTIONS } from "@/lib/interest";
import { DEFAULT_COUNTRY } from "@/lib/validation/countries";
import {
  registrationSchema,
  type RegistrationFormInput,
  type RegistrationInput,
} from "@/lib/validation/schemas";
import type { ApiError } from "@/types";

/** El formulario se reemplaza por el aviso final (`thanks`) o el de cierre (`closed`). */
type View = "form" | "thanks" | "closed";

/** Ventana modal abierta sobre el formulario. */
type DialogKind = "welcome" | "already" | null;

/** Paso del formulario: 1 = datos generales, 2 = las cuatro preguntas. */
type Step = 1 | 2;

/** Datos de la ventana de bienvenida: lo que la persona acaba de escribir (ya normalizado). */
interface WelcomeData {
  fullName: string;
  /** Celular en E.164 (`+56912345678`). */
  phone: string;
}

type StepOneField = "fullName" | "country" | "phone" | "company";
type FieldName = StepOneField | "trainingArea" | "guestSuggestion" | "crmInterest" | "gpsInterest";

/** Campos que se validan al tocar «Siguiente». */
const STEP_ONE_FIELDS: readonly StepOneField[] = ["fullName", "country", "phone", "company"];
const FIELD_NAMES: readonly FieldName[] = [
  ...STEP_ONE_FIELDS,
  "trainingArea",
  "guestSuggestion",
  "crmInterest",
  "gpsInterest",
];

const MESSAGES = {
  network: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  unexpected: "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.",
  invalid: "Revisa los datos ingresados e inténtalo de nuevo.",
} as const;

/** Primera opción de los desplegables: sin valor, para que ninguna respuesta venga preseleccionada. */
const CHOOSE_OPTION = "Elige una opción";
const TRAINING_QUESTION = "¿En qué área te gustaría capacitarte?";
const GUEST_QUESTION = "¿Qué invitado te gustaría que trajéramos a Creando Valor?";
const CRM_QUESTION = "¿Deseas adquirir el CRM con Agente IA de Cautiva?";
const GPS_QUESTION = "¿Te interesa un GPS satelital o una cámara para tu vehículo (Satelcom)?";

function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

function isStepOneField(value: FieldName): value is StepOneField {
  return (STEP_ONE_FIELDS as readonly string[]).includes(value);
}

/** Lee el cuerpo de error común de la API; `null` si la respuesta no tiene ese formato. */
async function readApiError(response: Response): Promise<ApiError | null> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      typeof body.code === "string" &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return body as ApiError;
    }
  } catch {
    // Cuerpo vacío o que no es JSON.
  }
  return null;
}

/** Íconos decorativos de los campos (trazo fino, heredan el color del contenedor). */
function FieldIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const personIcon = (
  <FieldIcon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </FieldIcon>
);
const phoneIcon = (
  <FieldIcon>
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <path d="M11 18h2" />
  </FieldIcon>
);
const briefcaseIcon = (
  <FieldIcon>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </FieldIcon>
);

const stepTitleClasses = "font-display text-xl font-extrabold text-ink-900 outline-none";

export function RegistrationForm() {
  const [view, setView] = useState<View>("form");
  const [step, setStep] = useState<Step>(1);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [welcome, setWelcome] = useState<WelcomeData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  /** Comprobando el celular del paso 1 con el servidor. */
  const [checking, setChecking] = useState(false);
  const submitting = useRef(false);
  const focusFirstField = useRef(false);
  const focusStepTitle = useRef(false);
  const pendingFieldFocus = useRef<StepOneField | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const stepOneTitleRef = useRef<HTMLHeadingElement>(null);
  const stepTwoTitleRef = useRef<HTMLHeadingElement>(null);

  // Al sustituir el formulario por un resultado, el foco se mueve al aviso para que los lectores de
  // pantalla lo anuncien y el teclado no quede en un elemento que ya no existe.
  useEffect(() => {
    if (view !== "form") {
      resultRef.current?.focus();
    }
  }, [view]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    trigger,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormInput, unknown, RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    // Los dos desplegables NO llevan valor por defecto: arrancan en «Elige una opción» (sin respuesta).
    defaultValues: {
      fullName: "",
      country: DEFAULT_COUNTRY,
      phone: "",
      company: "",
      trainingArea: "",
      guestSuggestion: "",
    },
  });
  const country = useWatch({ control, name: "country" }) ?? DEFAULT_COUNTRY;

  // Al cambiar de paso con «Siguiente»/«Atrás» el foco va al título del nuevo paso (el cambio se anuncia
  // por `StepProgress`); si un error del servidor devuelve a la persona al paso 1, al campo con error.
  // Los pasos están siempre montados (el inactivo lleva `hidden`), así que el efecto se ejecuta ya con
  // el paso visible.
  useEffect(() => {
    if (pendingFieldFocus.current && step === 1) {
      setFocus(pendingFieldFocus.current);
      pendingFieldFocus.current = null;
      focusStepTitle.current = false;
      return;
    }
    if (!focusStepTitle.current) {
      return;
    }
    focusStepTitle.current = false;
    (step === 1 ? stepOneTitleRef : stepTwoTitleRef).current?.focus();
  }, [step, setFocus]);

  // Tras «Registrar a otra persona» el foco va al primer campo. Se hace en un efecto del padre:
  // el efecto del `Dialog` hijo ya cerró el `<dialog>` (y devolvió el foco al botón de envío).
  useEffect(() => {
    if (dialog === null && focusFirstField.current) {
      focusFirstField.current = false;
      setFocus("fullName");
    }
  }, [dialog, setFocus]);

  function goToStep(next: Step): void {
    focusStepTitle.current = true;
    setStep(next);
  }

  function registerAnother(): void {
    setDialog(null);
    setWelcome(null);
    reset();
    // Sin `goToStep`: el foco va a «Nombres completos», no al título del paso.
    setStep(1);
    focusFirstField.current = true;
  }

  function done(): void {
    setDialog(null);
    setWelcome(null);
    setView("thanks");
  }

  function applyFieldErrors(fieldErrors: ApiError["fieldErrors"]): boolean {
    let applied = false;
    let backToStepOne: StepOneField | null = null;
    for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
      const message = messages[0];
      if (isFieldName(key) && message) {
        // Un error de un campo del paso 1 devuelve a la persona a ese paso (p. ej. si cambiaron las reglas).
        if (isStepOneField(key) && backToStepOne === null && step === 2) {
          backToStepOne = key;
        }
        setError(
          key,
          { type: "server", message },
          { shouldFocus: !applied && backToStepOne === null },
        );
        applied = true;
      }
    }
    if (backToStepOne !== null) {
      pendingFieldFocus.current = backToStepOne;
      setStep(1);
    }
    return applied;
  }

  async function handleError(response: Response): Promise<void> {
    const error = await readApiError(response);
    if (response.status === 400 && error?.code === "VALIDATION_ERROR") {
      if (!applyFieldErrors(error.fieldErrors)) {
        setServerError(MESSAGES.invalid);
      }
      return;
    }
    if (response.status === 403 && error?.code === "REGISTRATION_CLOSED") {
      setView("closed");
      return;
    }
    if (response.status === 409 && error?.code === "ALREADY_REGISTERED") {
      setDialog("already");
      return;
    }
    setServerError(MESSAGES.unexpected);
  }

  /**
   * «Siguiente»: valida solo los campos del paso 1 y pregunta al servidor si el celular ya está
   * registrado o las inscripciones se cerraron, para avisar antes de pedir las cuatro respuestas.
   * La comprobación es informativa: el envío final la repite dentro de la transacción de registro.
   */
  async function goNext(): Promise<void> {
    setServerError(null);
    const valid = await trigger(STEP_ONE_FIELDS as StepOneField[], { shouldFocus: true });
    if (!valid) {
      return;
    }

    setChecking(true);
    try {
      let response: Response;
      try {
        response = await fetch("/api/registrations/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: getValues("country"), phone: getValues("phone") }),
        });
      } catch {
        setServerError(MESSAGES.network);
        return;
      }

      if (response.ok) {
        goToStep(2);
        return;
      }
      await handleError(response);
    } finally {
      setChecking(false);
    }
  }

  async function submit(values: RegistrationInput): Promise<void> {
    setServerError(null);

    let response: Response;
    try {
      response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `values` es la salida del esquema (celular en E.164, sin país): se envía el país elegido
        // para que el servidor valide el celular contra el mismo país.
        body: JSON.stringify({ ...values, country: getValues("country") }),
      });
    } catch {
      setServerError(MESSAGES.network);
      return;
    }

    if (response.status === 201) {
      setWelcome({ fullName: values.fullName, phone: values.phone });
      setDialog("welcome");
      return;
    }
    await handleError(response);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    // Evita el doble envío (doble toque) además de deshabilitar el botón.
    if (submitting.current) {
      event.preventDefault();
      return;
    }
    submitting.current = true;
    try {
      if (step === 1) {
        // Enter en un campo del paso 1 hace lo mismo que «Siguiente»: no envía el registro.
        event.preventDefault();
        await goNext();
      } else {
        await handleSubmit(submit)(event);
      }
    } finally {
      submitting.current = false;
    }
  }

  if (view !== "form") {
    return (
      <div ref={resultRef} tabIndex={-1} className="outline-none">
        {view === "thanks" ? <ThanksPanel /> : null}
        {view === "closed" ? <ClosedNotice /> : null}
        <div className="mt-3">
          <BackToHomeLink />
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <StepProgress step={step} total={2} />

        <div hidden={step !== 1} className="flex flex-col gap-7">
          <h2 ref={stepOneTitleRef} tabIndex={-1} className={stepTitleClasses}>
            Tus datos
          </h2>
          <TextField
            label="Nombres completos"
            autoComplete="name"
            placeholder="Ej. María"
            icon={personIcon}
            error={errors.fullName?.message}
            {...register("fullName")}
          />
          <PhoneField
            registerCountry={register("country")}
            registerPhone={register("phone")}
            country={country}
            icon={phoneIcon}
            error={errors.phone?.message}
          />
          <TextField
            label="Empresa u ocupación"
            autoComplete="organization"
            placeholder="Ej. Cautiva Marketing"
            icon={briefcaseIcon}
            error={errors.company?.message}
            {...register("company")}
          />
        </div>

        <div hidden={step !== 2} className="flex flex-col gap-7">
          <h2 ref={stepTwoTitleRef} tabIndex={-1} className={stepTitleClasses}>
            Cuéntanos un poco más
          </h2>
          <TextField
            label={TRAINING_QUESTION}
            autoComplete="off"
            placeholder="Ej. Ventas y atención al cliente"
            error={errors.trainingArea?.message}
            {...register("trainingArea")}
          />
          <TextField
            label={GUEST_QUESTION}
            autoComplete="off"
            placeholder="Ej. Marketing digital"
            error={errors.guestSuggestion?.message}
            {...register("guestSuggestion")}
          />
          <SelectField
            label={CRM_QUESTION}
            options={CRM_OPTIONS}
            placeholder={CHOOSE_OPTION}
            error={errors.crmInterest?.message}
            {...register("crmInterest")}
          />
          <SelectField
            label={GPS_QUESTION}
            options={GPS_OPTIONS}
            placeholder={CHOOSE_OPTION}
            error={errors.gpsInterest?.message}
            {...register("gpsInterest")}
          />
        </div>

        {serverError ? <Alert variant="error">{serverError}</Alert> : null}
        <div className="flex flex-col gap-1">
          {step === 1 ? (
            <Button type="submit" loading={checking} className="w-full">
              {checking ? "Comprobando…" : "Siguiente"}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Button type="submit" loading={isSubmitting} className="w-full">
                {isSubmitting ? "Enviando…" : "Enviar y participar"}
              </Button>
              <Button variant="secondary" onClick={() => goToStep(1)} className="w-full">
                Atrás
              </Button>
            </div>
          )}
          <BackToHomeLink />
        </div>
      </form>
      <WelcomeDialog
        open={dialog === "welcome"}
        fullName={welcome?.fullName ?? ""}
        phone={welcome?.phone ?? ""}
        onDone={done}
        onRegisterAnother={registerAnother}
      />
      <AlreadyRegisteredDialog
        open={dialog === "already"}
        onDone={done}
        onRegisterAnother={registerAnother}
      />
    </>
  );
}
