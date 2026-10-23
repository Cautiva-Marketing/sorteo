"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AlreadyRegisteredDialog } from "@/components/registration/AlreadyRegisteredDialog";
import { BackToHomeLink } from "@/components/registration/BackToHomeLink";
import { ClosedNotice } from "@/components/registration/ClosedNotice";
import { ThanksPanel } from "@/components/registration/ThanksPanel";
import { WelcomeDialog } from "@/components/registration/WelcomeDialog";
import { Alert } from "@/components/ui/Alert";
import { PhoneField } from "@/components/registration/PhoneField";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { TextField } from "@/components/ui/TextField";
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

/** Datos de la ventana de bienvenida: lo que la persona acaba de escribir (ya normalizado). */
interface WelcomeData {
  fullName: string;
  /** Celular en E.164 (`+56912345678`). */
  phone: string;
}

type FieldName = "fullName" | "phone" | "company";
const FIELD_NAMES: readonly FieldName[] = ["fullName", "phone", "company"];

const MESSAGES = {
  network: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  unexpected: "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.",
  invalid: "Revisa los datos ingresados e inténtalo de nuevo.",
} as const;

function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
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

export function RegistrationForm() {
  const [view, setView] = useState<View>("form");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [welcome, setWelcome] = useState<WelcomeData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const submitting = useRef(false);
  const focusFirstField = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

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
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormInput, unknown, RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: "",
      country: DEFAULT_COUNTRY,
      phone: "",
      company: "",
      crmInterest: false,
    },
  });
  const country = useWatch({ control, name: "country" }) ?? DEFAULT_COUNTRY;

  // Tras «Registrar a otra persona» el foco va al primer campo. Se hace en un efecto del padre:
  // el efecto del `Dialog` hijo ya cerró el `<dialog>` (y devolvió el foco al botón de envío).
  useEffect(() => {
    if (dialog === null && focusFirstField.current) {
      focusFirstField.current = false;
      setFocus("fullName");
    }
  }, [dialog, setFocus]);

  function registerAnother(): void {
    setDialog(null);
    setWelcome(null);
    reset();
    focusFirstField.current = true;
  }

  function done(): void {
    setDialog(null);
    setWelcome(null);
    setView("thanks");
  }

  function applyFieldErrors(fieldErrors: ApiError["fieldErrors"]): boolean {
    let applied = false;
    for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
      const message = messages[0];
      if (isFieldName(key) && message) {
        setError(key, { type: "server", message }, { shouldFocus: !applied });
        applied = true;
      }
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
      await handleSubmit(submit)(event);
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
        <CheckboxField
          label="¿Deseas adquirir el CRM con Agente IA?"
          {...register("crmInterest")}
        />
        {serverError ? <Alert variant="error">{serverError}</Alert> : null}
        <div className="flex flex-col gap-1">
          <Button type="submit" loading={isSubmitting} className="w-full">
            {isSubmitting ? "Enviando…" : "Enviar y participar"}
          </Button>
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
