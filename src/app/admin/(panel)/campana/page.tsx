import { PurgeDialog } from "@/components/admin/PurgeDialog";
import { RegistrationToggle } from "@/components/admin/RegistrationToggle";
import { formatLimaDateTime } from "@/lib/format";
import { requireAdmin } from "@/services/admin-auth.service";
import { getRegistrationStatus } from "@/services/registration-status.service";

/** /admin/campana — estado de las inscripciones y cierre de campaña (borrado de datos). */
export default async function CampaignPage() {
  // El layout ya exige sesión, pero no se vuelve a ejecutar en cada navegación del cliente.
  await requireAdmin();
  const { open, dataPurgedAt } = await getRegistrationStatus();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-bold text-ink-900">Campaña</h1>
      <RegistrationToggle initialOpen={open} />

      <section aria-labelledby="closure-heading" className="flex flex-col gap-4">
        <h2 id="closure-heading" className="font-display text-xl font-bold text-ink-900">
          Cierre de campaña
        </h2>
        <p className="text-base text-ink-600">
          Al terminar la campaña y entregar el premio, borra definitivamente los datos personales de
          los participantes. Solo se puede hacer con las inscripciones cerradas.
        </p>
        {dataPurgedAt ? (
          <p className="text-base text-ink-900">
            {`Los datos de los participantes se borraron el ${formatLimaDateTime(dataPurgedAt)}.`}
          </p>
        ) : null}
        <PurgeDialog registrationOpen={open} />
      </section>
    </div>
  );
}
