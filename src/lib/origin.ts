/**
 * Nombre de host válido: letras, dígitos, `.` y `-` (sin empezar ni terminar en `.` o `-`) y un
 * puerto opcional de hasta 5 dígitos. Rechaza `/`, `@`, `?`, `#`, `\`, espacios y todo lo demás.
 * No admite direcciones IPv6.
 */
const HOST_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

/** Primer valor de un encabezado que puede traer varios separados por comas. */
function firstValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}

function isLocalHost(host: string): boolean {
  const name = host.split(":")[0]?.toLowerCase();
  return name === "localhost" || name === "127.0.0.1";
}

/**
 * Origen público (`https://host`) a partir de los encabezados de la petición, para el QR.
 *
 * Host: el primer valor de `x-forwarded-host` y, si no es válido, `host`. Protocolo: el primer
 * valor de `x-forwarded-proto` si es `http` o `https`; si no, `http` para `localhost` y
 * `127.0.0.1` y `https` para el resto. No hay valor de respaldo: si ningún encabezado trae un host
 * válido devuelve `null`, para no generar nunca un QR que apunte a `localhost` en producción.
 */
export function buildOrigin(headers: Pick<Headers, "get">): string | null {
  const host = [firstValue(headers.get("x-forwarded-host")), firstValue(headers.get("host"))].find(
    (candidate): candidate is string => candidate !== null && HOST_PATTERN.test(candidate),
  );
  if (!host) {
    return null;
  }

  const forwardedProto = firstValue(headers.get("x-forwarded-proto"))?.toLowerCase();
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : isLocalHost(host)
        ? "http"
        : "https";
  return `${protocol}://${host}`;
}
