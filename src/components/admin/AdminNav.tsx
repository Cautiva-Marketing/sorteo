"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/admin", label: "Participantes" },
  { href: "/admin/premios", label: "Premios" },
  { href: "/admin/sorteo", label: "Sorteo" },
  { href: "/admin/campana", label: "Campaña" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

const itemClasses =
  "inline-flex min-h-11 min-w-11 items-center border-b-2 px-3 py-2 text-base font-medium text-ink-900 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600";

/** Navegación del panel (sobre fondo blanco) con el botón de cerrar sesión. */
export function AdminNav() {
  const pathname = usePathname();
  const [closing, setClosing] = useState(false);

  async function logout(): Promise<void> {
    setClosing(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" });
    } finally {
      // Navegación completa: el layout del panel vuelve a exigir la sesión en el servidor.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa a propósito (descarta el estado del cliente)
      window.location.assign("/admin/login");
    }
  }

  return (
    <nav aria-label="Panel de administración" className="flex flex-wrap items-center gap-1">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`${itemClasses} ${
              active ? "border-ink-900 font-semibold" : "border-transparent hover:border-ink-300"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={logout}
        disabled={closing}
        className={`${itemClasses} ml-auto border-transparent underline hover:text-accent-600 disabled:opacity-60`}
      >
        Cerrar sesión
      </button>
    </nav>
  );
}
