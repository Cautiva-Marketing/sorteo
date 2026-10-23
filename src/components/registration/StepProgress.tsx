export interface StepProgressProps {
  /** Paso actual (empieza en 1). */
  step: 1 | 2;
  total: 2;
}

/** «Paso N de 2» con una barra de avance; el texto se anuncia al cambiar de paso. */
export function StepProgress({ step, total }: StepProgressProps) {
  return (
    <div>
      <p aria-live="polite" className="text-sm font-medium text-ink-600">
        {`Paso ${step} de ${total}`}
      </p>
      <div aria-hidden="true" className="mt-2 flex gap-2">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full ${index < step ? "bg-ink-900" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}
