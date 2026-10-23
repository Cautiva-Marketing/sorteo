"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

function isNativeFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/**
 * Pantalla completa de un elemento (FR-080). Usa la Fullscreen API y, si el navegador no la
 * soporta o la rechaza, un respaldo CSS: `active` pasa a `true` igualmente y el componente aplica
 * `fixed inset-0`. Escape sale en ambos casos (nativo: lo gestiona el navegador; respaldo: el
 * `keydown` de este hook).
 */
export function useFullscreen() {
  const ref = useRef<HTMLElement | null>(null);
  const [fallback, setFallback] = useState(false);
  const native = useSyncExternalStore(subscribe, isNativeFullscreen, () => false);
  const active = native || fallback;

  const enter = useCallback(async (): Promise<void> => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (document.fullscreenEnabled && typeof element.requestFullscreen === "function") {
      try {
        await element.requestFullscreen();
        return;
      } catch {
        // El navegador la rechazó: se usa el respaldo CSS.
      }
    }
    setFallback(true);
  }, []);

  const exit = useCallback(async (): Promise<void> => {
    setFallback(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ya había salido: nada que hacer.
      }
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      // Con una ventana abierta, Escape cierra primero la ventana.
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        void exit();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, exit]);

  return { ref, active, enter, exit };
}
