import { forwardRef, useId, type ComponentPropsWithoutRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<ComponentPropsWithoutRef<"select">, "id"> {
  label: string;
  options: readonly SelectOption[];
  /**
   * Primera opción, sin valor (`""`): el selector arranca en ella y obliga a elegir. Se usa en las
   * preguntas del registro para que ninguna respuesta venga preseleccionada.
   */
  placeholder?: string;
  /** Mensaje de error ya traducido; si existe, el campo se marca como inválido. */
  error?: string;
  id?: string;
}

/**
 * Desplegable nativo con etiqueta visible asociada (área táctil de al menos 44 px): en el teléfono se
 * abre con el selector del sistema y ocupa una sola línea. Compatible con `register` de React Hook
 * Form y también usable como selector controlado (`value` + `onChange`) en los filtros del panel.
 */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, options, placeholder, error, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  const selectClasses = [
    "block min-h-11 w-full rounded-xl border bg-paper px-3 py-2 text-base text-ink-900",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700",
    error ? "border-danger-700" : "border-ink-300",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      {/* El texto en mayúsculas es solo estilo: el nombre accesible no cambia. */}
      <label
        htmlFor={selectId}
        className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-ink-600"
      >
        {label}
      </label>
      <select
        {...props}
        ref={ref}
        id={selectId}
        className={selectClasses}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
