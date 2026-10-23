/**
 * `fetch` para los componentes del panel que llaman a `/api/admin/*`. Si la sesión venció (401)
 * redirige al login con el aviso y devuelve una promesa que nunca se resuelve, de modo que el
 * componente no muestre un error mientras el navegador cambia de página. Cualquier otra respuesta
 * se devuelve sin modificar.
 */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: "same-origin" });
  if (response.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa a propósito (descarta el estado del cliente)
    window.location.assign("/admin/login?expirada=1");
    return new Promise<Response>(() => {});
  }
  return response;
}
