"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { loginSchema, type LoginInput } from "@/lib/validation/schemas";
import { SignInError, signInAdmin, signOutClient } from "@/services/firebase/auth-client";

const MESSAGES = {
  expired: "Tu sesión expiró. Inicia sesión de nuevo.",
  invalidCredentials: "Credenciales incorrectas",
  forbidden: "No tienes permisos de administrador",
  tooManyRequests: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  network: "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
  unexpected: "Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.",
} as const;

function messageForSignInError(error: unknown): string {
  if (error instanceof SignInError) {
    switch (error.reason) {
      case "INVALID_CREDENTIALS":
        return MESSAGES.invalidCredentials;
      case "TOO_MANY_REQUESTS":
        return MESSAGES.tooManyRequests;
      case "NETWORK":
        return MESSAGES.network;
      default:
        return MESSAGES.unexpected;
    }
  }
  return MESSAGES.unexpected;
}

export interface LoginFormProps {
  /** La sesión venció (`?expirada=1`): se muestra el aviso sobre el formulario. */
  sessionExpired?: boolean;
}

export function LoginForm({ sessionExpired = false }: LoginFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const submitting = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function submit(values: LoginInput): Promise<void> {
    setServerError(null);

    let idToken: string;
    try {
      idToken = await signInAdmin(values.email, values.password);
    } catch (error) {
      setServerError(messageForSignInError(error));
      return;
    }

    let response: Response;
    try {
      response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
    } catch {
      setServerError(MESSAGES.network);
      return;
    } finally {
      // La sesión real del panel es la cookie del servidor; no se conserva la del SDK web.
      void signOutClient().catch(() => undefined);
    }

    if (response.status === 204) {
      router.replace("/admin");
      return;
    }
    setServerError(response.status === 403 ? MESSAGES.forbidden : MESSAGES.unexpected);
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

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {sessionExpired ? <Alert variant="info">{MESSAGES.expired}</Alert> : null}
      <TextField
        label="Correo electrónico"
        type="email"
        inputMode="email"
        autoComplete="username"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      {serverError ? <Alert variant="error">{serverError}</Alert> : null}
      <Button type="submit" loading={isSubmitting}>
        {isSubmitting ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
