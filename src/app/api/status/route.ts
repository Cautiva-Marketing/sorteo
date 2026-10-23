import { errorResponse } from "@/lib/http";
import { getPublicStatus } from "@/services/public-status.service";

// Cada consulta debe ver el estado actual: sin caché de Next ni del navegador.
export const dynamic = "force-dynamic";

/**
 * GET /api/status — estado público: `{ open, count }` (FR-043 a FR-045). Solo devuelve si las
 * inscripciones están abiertas y el total de participantes; nunca datos de personas.
 */
export async function GET(): Promise<Response> {
  try {
    return Response.json(await getPublicStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Sin datos personales en los logs: solo el tipo de error.
    console.error(
      "Error al leer el estado público:",
      error instanceof Error ? error.name : "desconocido",
    );
    return errorResponse("INTERNAL_ERROR", 500, "Ocurrió un error inesperado. Inténtalo de nuevo.");
  }
}
