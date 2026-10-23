import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

export interface TextFieldProps extends Omit<ComponentPropsWithoutRef<"input">, "id"> {
  label: string;
  helpText?: string;
  /** Mensaje de error ya traducido; si existe, el campo se marca como inválido. */
  error?: string;
  /** Ícono decorativo a la izquierda del campo (se oculta a los lectores de pantalla). */
  icon?: ReactNode;
  id?: string;
}

/** Campo de texto accesible, compatible con `register` de React Hook Form. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, helpText, error, icon, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = [helpText ? helpId : null, error ? errorId : null].filter(Boolean).join(" ");

  const inputClasses = [
    "block min-h-11 w-full rounded-xl border bg-paper px-3 py-2 text-base text-ink-900 placeholder:text-ink-500",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700",
    icon ? "pl-11" : "",
    error ? "border-danger-700" : "border-ink-300",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      {/* El texto en mayúsculas es solo estilo: el nombre accesible no cambia. */}
      <label
        htmlFor={inputId}
        className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-600"
      >
        {label}
      </label>
      {helpText ? (
        <p id={helpId} className="mb-1 text-sm text-ink-600">
          {helpText}
        </p>
      ) : null}
      <div className="relative">
        {icon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-500"
          >
            {icon}
          </span>
        ) : null}
        <input
          {...props}
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
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
});
