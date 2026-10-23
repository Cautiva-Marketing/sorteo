import { forwardRef, useId, type ComponentPropsWithoutRef } from "react";

export interface CheckboxFieldProps extends Omit<ComponentPropsWithoutRef<"input">, "id" | "type"> {
  label: string;
  /** Texto de apoyo opcional bajo la etiqueta. */
  description?: string;
  id?: string;
}

/** Casilla accesible (etiqueta clicable de al menos 44 px), compatible con `register` de React Hook Form. */
export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField({ label, description, id, className, ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const descriptionId = `${inputId}-description`;

    return (
      <div className={["flex min-h-11 items-start gap-3", className].filter(Boolean).join(" ")}>
        <input
          {...props}
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-describedby={description ? descriptionId : undefined}
          className="mt-2.5 size-5 shrink-0 accent-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700"
        />
        <label htmlFor={inputId} className="flex min-h-11 cursor-pointer flex-col justify-center">
          <span className="text-base text-ink-900">{label}</span>
          {description ? (
            <span id={descriptionId} className="text-sm text-ink-600">
              {description}
            </span>
          ) : null}
        </label>
      </div>
    );
  },
);
