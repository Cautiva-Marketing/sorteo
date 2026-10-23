import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  /** Muestra el estado de envío: deshabilita el botón y marca `aria-busy`. */
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink-900 text-paper uppercase tracking-wider hover:bg-ink-600",
  secondary: "border border-ink-300 bg-paper text-ink-900 hover:bg-paper-soft",
  danger: "bg-danger-700 text-paper hover:opacity-90",
};

const baseClasses =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-4 py-2 text-base font-semibold " +
  "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/** Clases del botón; permite dar el mismo aspecto a un enlace de descarga o navegación. */
export function buttonClassName(variant: ButtonVariant = "primary", className?: string): string {
  return [baseClasses, variantClasses[variant], className].filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  type = "button",
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = buttonClassName(variant, className);
  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
    </button>
  );
}
