"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  GiftIcon,
  LogoutIcon,
  MegaphoneIcon,
  PlayIcon,
  QrIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/ui/icons";

export interface AdminNavCounts {
  participants: number;
  /** Premios ya sorteados por completo. */
  prizesDone: number;
  prizesTotal: number;
  /** Ganadores activos. */
  winners: number;
}

export interface AdminNavProps {
  counts: AdminNavCounts;
}

interface NavLink {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700";
const itemClasses = `flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${focusRing}`;

/**
 * Navegación del panel: barra lateral en pantallas anchas y fila desplazable en las angostas, con
 * los contadores de cada sección y, al final, el acceso a la pantalla del QR y «Cerrar sesión».
 */
export function AdminNav({ counts }: AdminNavProps) {
  const pathname = usePathname();
  const [closing, setClosing] = useState(false);

  const links: NavLink[] = [
    { href: "/admin/sorteo", label: "Ruleta de sorteo", icon: <PlayIcon /> },
    {
      href: "/admin/premios",
      label: "Premios",
      icon: <GiftIcon />,
      badge: `${counts.prizesDone}/${counts.prizesTotal}`,
    },
    {
      href: "/admin",
      label: "Participantes",
      icon: <UsersIcon />,
      badge: String(counts.participants),
    },
    {
      href: "/admin/ganadores",
      label: "Ganadores",
      icon: <TrophyIcon />,
      badge: String(counts.winners),
    },
    { href: "/admin/campana", label: "Campaña", icon: <MegaphoneIcon /> },
  ];

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
    <>
      <nav
        aria-label="Panel de administración"
        className="flex min-w-0 gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        <p className="hidden px-3 pb-1 text-[0.65rem] font-semibold tracking-[0.2em] text-ink-500 uppercase lg:block">
          Navegación
        </p>
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`${itemClasses} ${
                active ? "bg-ink-900 text-paper" : "text-ink-600 hover:bg-paper-soft"
              }`}
            >
              {link.icon}
              <span>{link.label}</span>
              {link.badge ? (
                // Decorativo: el nombre accesible del enlace es solo su etiqueta.
                <span
                  aria-hidden="true"
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${
                    active ? "bg-paper text-ink-900" : "bg-paper-soft text-ink-600"
                  }`}
                >
                  {link.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-wrap gap-2 lg:mt-auto lg:flex-col">
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className={`${itemClasses} bg-paper-soft text-ink-600 hover:text-ink-900`}
        >
          <QrIcon />
          Ver pantalla QR
        </a>
        <button
          type="button"
          onClick={logout}
          disabled={closing}
          className={`${itemClasses} bg-danger-100 text-danger-700 hover:opacity-80 disabled:opacity-60`}
        >
          <LogoutIcon />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}
