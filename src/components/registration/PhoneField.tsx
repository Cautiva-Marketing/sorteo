"use client";

import { useId, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { COUNTRIES, getCountry, type CountryCode } from "@/lib/validation/countries";

export interface PhoneFieldProps {
  /** Resultado de `register("country")` de React Hook Form. */
  registerCountry: UseFormRegisterReturn;
  /** Resultado de `register("phone")` de React Hook Form. */
  registerPhone: UseFormRegisterReturn;
  /** País elegido: define el ejemplo del `placeholder`. */
  country: CountryCode;
  /** Mensaje de error ya traducido; si existe, el número se marca como inválido. */
  error?: string;
  /** Ícono decorativo a la izquierda del número. */
  icon?: ReactNode;
}

/** Ejemplo del país en grupos legibles (los de 9 dígitos de 3 en 3). */
function examplePlaceholder(country: CountryCode): string {
  const { example } = getCountry(country);
  return example.length === 9 ? example.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3") : example;
}

const focusClasses =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700";

/**
 * Celular con país (FR-092, FR-093): `<select>` nativo con los 12 países de Sudamérica (Perú
 * primero) y el número local. Sin texto de ayuda (FR-098). Compatible con React Hook Form.
 */
export function PhoneField({
  registerCountry,
  registerPhone,
  country,
  error,
  icon,
}: PhoneFieldProps) {
  const id = useId();
  const phoneId = `${id}-phone`;
  const errorId = `${id}-error`;

  return (
    <div>
      {/* El texto en mayúsculas es solo estilo: el nombre accesible no cambia. */}
      <label
        htmlFor={phoneId}
        className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-600"
      >
        Celular
      </label>
      <div className="flex gap-2">
        <select
          {...registerCountry}
          aria-label="País"
          className={`min-h-11 w-[9.25rem] shrink-0 rounded-xl border border-ink-300 bg-paper px-2 py-2 text-base text-ink-900 ${focusClasses}`}
        >
          {COUNTRIES.map((item) => (
            <option key={item.code} value={item.code}>
              {`${item.name} (+${item.dial})`}
            </option>
          ))}
        </select>
        <div className="relative min-w-0 flex-1">
          {icon ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-500"
            >
              {icon}
            </span>
          ) : null}
          <input
            {...registerPhone}
            id={phoneId}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={examplePlaceholder(country)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={[
              "block min-h-11 w-full rounded-xl border bg-paper px-3 py-2 text-base text-ink-900 placeholder:text-ink-500",
              focusClasses,
              icon ? "pl-11" : "",
              error ? "border-danger-700" : "border-ink-300",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        </div>
      </div>
      <div aria-live="polite">
        {error ? (
          <p id={errorId} className="mt-1 text-sm font-medium text-danger-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
