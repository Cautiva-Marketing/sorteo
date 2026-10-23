"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { Logo } from "@/components/ui/Logo";
import {
  abbreviate,
  indexAtPointer,
  labelLayout,
  PALETTE,
  pinStep,
  segmentColorIndexes,
  targetRotation,
  type ColorToken,
} from "@/lib/wheel";
import type { WheelParticipant } from "@/types";

/** Orden de un giro hacia el ganador ya decidido por el servidor; un `key` nuevo inicia otro. */
export interface SpinTarget {
  winnerRef: string;
  key: number;
  /** Sin animación (reducir movimiento o ganador que no está en la lista): termina de inmediato. */
  instant: boolean;
}

export interface RouletteWheelProps {
  participants: WheelParticipant[];
  /** Lado del canvas en píxeles CSS. */
  size: number;
  spinTarget: SpinTarget | null;
  /**
   * Gira a velocidad constante mientras se espera al servidor; al llegar `spinTarget` la rueda
   * desacelera desde esa velocidad hasta el ganador, sin salto.
   */
  freeSpin?: boolean;
  /** Nombre completo del segmento que pasa bajo el puntero (cada ~60 ms durante el giro). */
  onPointerName: (name: string) => void;
  /** El giro terminó (o era instantáneo); `winnerRef` es el del `spinTarget`. */
  onSpinEnd: (winnerRef: string) => void;
}

/** Duración del giro y desaceleración cuártica (FR-068, research D-211). */
const SPIN_MS = 6500;
/** Giro libre: velocidad de crucero (rad/ms, ~1,9 vueltas/s), rampa de arranque y frenado si no hay ganador. */
const FREE_SPIN_SPEED = 0.012;
const FREE_SPIN_RAMP_MS = 300;
const COAST_TAU_MS = 350;
/** Por debajo de esta velocidad (rad/ms) no se empalma: se usa el giro completo de siempre. */
const MIN_FREE_SPEED = 0.004;
const MIN_SPIN_MS = 3000;
const MAX_SPIN_MS = 12000;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const POINTER_NAME_EVERY_MS = 60;
const MAX_PIXEL_RATIO = 3;
const TWO_PI = Math.PI * 2;

type TokenName = ColorToken;

/** Colores leídos de los design tokens: el canvas no puede usar clases de Tailwind. */
type WheelTokens = Record<TokenName, string>;

const TOKEN_NAMES: TokenName[] = [
  "wheel-purple",
  "wheel-lavender",
  "wheel-cyan",
  "paper",
  "ink-900",
];

function readTokens(): WheelTokens {
  const styles = getComputedStyle(document.documentElement);
  const tokens = {} as WheelTokens;
  for (const name of TOKEN_NAMES) {
    tokens[name] = styles.getPropertyValue(`--color-${name}`).trim();
  }
  return tokens;
}

/** Anchos de las capas de la rueda a partir del radio de los segmentos `r`. */
const RIM_OUTER = 14;
const RIM_FILLET = 10;
const RIM_INNER = 6;

function fillDisc(ctx: CanvasRenderingContext2D, center: number, radius: number, color: string) {
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, TWO_PI);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Dibuja la rueda completa (aro, segmentos, divisores, texto y pines) una sola vez en un canvas
 * fuera de pantalla: cada fotograma solo lo rota, así que el costo no depende de la cantidad de
 * participantes (research D-209).
 */
function paintWheel(
  ctx: CanvasRenderingContext2D,
  size: number,
  participants: WheelParticipant[],
  tokens: WheelTokens,
): void {
  const center = size / 2;
  const radius = size / 2 - (RIM_OUTER + 4);
  const hubRadius = size * 0.135;
  const count = participants.length;

  // Aro: banda exterior morada, filete lavanda y banda morada interior donde van los pines.
  fillDisc(ctx, center, radius + RIM_OUTER, tokens["wheel-purple"]);
  fillDisc(ctx, center, radius + RIM_FILLET, tokens["wheel-lavender"]);
  fillDisc(ctx, center, radius + RIM_INNER, tokens["wheel-purple"]);

  if (count === 0) {
    fillDisc(ctx, center, radius, tokens["paper"]);
    return;
  }

  const arc = TWO_PI / count;
  const colorIndexes = segmentColorIndexes(count);
  const layout = labelLayout(count, radius);
  const family = getComputedStyle(document.body).fontFamily;
  const seamStroke = count > 100;

  for (let index = 0; index < count; index += 1) {
    const style = PALETTE[colorIndexes[index] as number] as (typeof PALETTE)[number];
    const start = -Math.PI / 2 + index * arc;
    ctx.beginPath();
    if (count > 1) {
      ctx.moveTo(center, center);
    }
    ctx.arc(center, center, radius, start, start + arc);
    ctx.closePath();
    ctx.fillStyle = tokens[style.background];
    ctx.fill();
    if (seamStroke) {
      // Con muchos segmentos el antialiasing deja rendijas: se cubren con el propio color.
      ctx.strokeStyle = tokens[style.background];
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  if (count > 1 && count <= 100) {
    ctx.strokeStyle = tokens["paper"];
    ctx.lineWidth = Math.max(1, radius * 0.004);
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + index * arc;
      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * hubRadius, center + Math.sin(angle) * hubRadius);
      ctx.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
      ctx.stroke();
    }
  }

  if (layout.showLabel) {
    const available = radius - hubRadius - 18;
    const maxChars = Math.max(1, Math.floor(available / (layout.fontSize * 0.55)));
    ctx.font = `600 ${layout.fontSize}px ${family}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let index = 0; index < count; index += 1) {
      const style = PALETTE[colorIndexes[index] as number] as (typeof PALETTE)[number];
      const middle = -Math.PI / 2 + (index + 0.5) * arc;
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(middle);
      ctx.fillStyle = tokens[style.text];
      ctx.fillText(
        abbreviate(
          (participants[index] as WheelParticipant).fullName,
          maxChars,
          layout.firstNameOnly,
        ),
        radius - 10,
        0,
      );
      ctx.restore();
    }
  }

  // Pines celestes sobre la banda morada, en los límites de los segmentos.
  const step = pinStep(count);
  const pinRadius = Math.max(1.5, radius * 0.01);
  ctx.fillStyle = tokens["wheel-cyan"];
  for (let index = 0; index < count; index += step) {
    const angle = -Math.PI / 2 + index * arc;
    ctx.beginPath();
    ctx.arc(
      center + Math.cos(angle) * (radius + RIM_INNER / 2),
      center + Math.sin(angle) * (radius + RIM_INNER / 2),
      pinRadius,
      0,
      TWO_PI,
    );
    ctx.fill();
  }
}

/** Capa fija: buje blanco con aro morado y puntero triangular morado en el borde superior. */
function paintOverlay(ctx: CanvasRenderingContext2D, size: number, tokens: WheelTokens): void {
  const center = size / 2;
  const radius = size / 2 - (RIM_OUTER + 4);
  const hubRadius = size * 0.135;

  fillDisc(ctx, center, hubRadius + 4, tokens["wheel-purple"]);
  fillDisc(ctx, center, hubRadius, tokens["paper"]);

  const tipY = center - radius + 12;
  ctx.beginPath();
  ctx.moveTo(center, tipY);
  ctx.lineTo(center - 15, 0);
  ctx.lineTo(center + 15, 0);
  ctx.closePath();
  ctx.fillStyle = tokens["wheel-purple"];
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = tokens["paper"];
  ctx.stroke();
}

/**
 * Ruleta en `<canvas>` (sin librerías): un segmento por participante, logo de Creando Valor al centro y
 * puntero fijo arriba. El ganador ya viene decidido por el servidor (`spinTarget`); el aleatorio
 * de este componente solo decide vueltas y desplazamiento dentro del segmento (FR-065).
 */
export function RouletteWheel({
  participants,
  size,
  spinTarget,
  freeSpin = false,
  onPointerName,
  onSpinEnd,
}: RouletteWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wheelImageRef = useRef<HTMLCanvasElement | null>(null);
  const overlayImageRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef(0);
  /** Velocidad angular actual (rad/ms) del giro libre; 0 si la rueda no gira libremente. */
  const velocityRef = useRef(0);
  const spinningRef = useRef(false);

  const latestParticipants = useEffectEvent(() => participants);
  const notifyPointer = useEffectEvent(onPointerName);
  const notifyEnd = useEffectEvent(onSpinEnd);

  /** Pinta un fotograma: rueda rotada + capa fija. */
  const render = useEffectEvent(() => {
    const canvas = canvasRef.current;
    const wheel = wheelImageRef.current;
    const overlay = overlayImageRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !wheel || !overlay) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotationRef.current);
    ctx.drawImage(wheel, -canvas.width / 2, -canvas.height / 2);
    ctx.restore();
    ctx.drawImage(overlay, 0, 0);
  });

  // Prerenderizado: solo cuando cambia la lista o el tamaño.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const device = Math.round(size * ratio);
    canvas.width = device;
    canvas.height = device;

    const tokens = readTokens();
    const make = (): HTMLCanvasElement => {
      const layer = document.createElement("canvas");
      layer.width = device;
      layer.height = device;
      return layer;
    };
    const wheel = make();
    const wheelCtx = wheel.getContext("2d");
    const overlay = make();
    const overlayCtx = overlay.getContext("2d");
    if (!wheelCtx || !overlayCtx) {
      return;
    }
    wheelCtx.scale(device / size, device / size);
    paintWheel(wheelCtx, size, participants, tokens);
    overlayCtx.scale(device / size, device / size);
    paintOverlay(overlayCtx, size, tokens);
    wheelImageRef.current = wheel;
    overlayImageRef.current = overlay;
    render();
  }, [participants, size]);

  // Giro: se inicia cuando cambia el `key` de `spinTarget`.
  const spinKey = spinTarget?.key;
  useEffect(() => {
    if (!spinTarget) {
      return;
    }
    const list = latestParticipants();
    const winnerIndex = list.findIndex((entry) => entry.ref === spinTarget.winnerRef);
    if (winnerIndex === -1 || spinTarget.instant) {
      velocityRef.current = 0;
      notifyEnd(spinTarget.winnerRef);
      return;
    }
    spinningRef.current = true;

    const count = list.length;
    const startRotation = rotationRef.current;
    const freeSpeed = velocityRef.current;
    velocityRef.current = 0;
    // Con giro libre previo, la desaceleración cuártica arranca a la velocidad actual
    // (v₀ = 4·Δθ/T): se eligen las vueltas para durar ~SPIN_MS y T sale de Δθ.
    const resumed = freeSpeed >= MIN_FREE_SPEED;
    const extraTurns = resumed
      ? Math.max(2, Math.round((freeSpeed * SPIN_MS) / 4 / TWO_PI) + Math.floor(Math.random() * 2))
      : 6 + Math.floor(Math.random() * 3);
    const finalRotation = targetRotation({
      winnerIndex,
      count,
      startRotation,
      extraTurns,
      offsetFraction: (Math.random() - 0.5) * 0.5,
    });
    const duration = resumed
      ? Math.min(
          MAX_SPIN_MS,
          Math.max(MIN_SPIN_MS, (4 * (finalRotation - startRotation)) / freeSpeed),
        )
      : SPIN_MS;
    const winner = list[winnerIndex] as WheelParticipant;
    const startedAt = performance.now();
    let lastNameAt = 0;
    let frame = 0;

    const tick = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      rotationRef.current = startRotation + (finalRotation - startRotation) * eased;
      render();
      if (now - lastNameAt >= POINTER_NAME_EVERY_MS) {
        lastNameAt = now;
        const current = list[indexAtPointer(rotationRef.current, count)];
        if (current) {
          notifyPointer(current.fullName);
        }
      }
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      rotationRef.current = ((finalRotation % TWO_PI) + TWO_PI) % TWO_PI;
      spinningRef.current = false;
      render();
      notifyPointer(winner.fullName);
      notifyEnd(winner.ref);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      spinningRef.current = false;
      cancelAnimationFrame(frame);
    };
    // Solo un `key` nuevo inicia un giro; el resto de valores se leen con `useEffectEvent`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  // Giro libre: la rueda acelera y gira a velocidad constante mientras llega el ganador.
  useEffect(() => {
    if (!freeSpin || window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      return;
    }
    const list = latestParticipants();
    const count = list.length;
    if (count === 0) {
      return;
    }
    let last = performance.now();
    let lastNameAt = 0;
    let frame = 0;
    const tick = (now: number): void => {
      const elapsed = Math.min(now - last, 50);
      last = now;
      velocityRef.current = Math.min(
        FREE_SPIN_SPEED,
        velocityRef.current + (FREE_SPIN_SPEED / FREE_SPIN_RAMP_MS) * elapsed,
      );
      rotationRef.current += velocityRef.current * elapsed;
      render();
      if (now - lastNameAt >= POINTER_NAME_EVERY_MS) {
        lastNameAt = now;
        const current = list[indexAtPointer(rotationRef.current, count)];
        if (current) {
          notifyPointer(current.fullName);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [freeSpin]);

  // Si el giro libre termina sin ganador (la petición falló), la rueda frena sola.
  useEffect(() => {
    if (freeSpin || spinningRef.current || velocityRef.current <= 0) {
      return;
    }
    let last = performance.now();
    let frame = 0;
    const tick = (now: number): void => {
      const elapsed = Math.min(now - last, 50);
      last = now;
      velocityRef.current *= Math.exp(-elapsed / COAST_TAU_MS);
      rotationRef.current += velocityRef.current * elapsed;
      render();
      if (velocityRef.current > MIN_FREE_SPEED / 20) {
        frame = requestAnimationFrame(tick);
      } else {
        velocityRef.current = 0;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [freeSpin]);

  const hubIcon = Math.round(size * 0.135 * 1.2);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-testid="roulette-canvas"
        style={{ width: size, height: size }}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <Logo variant="icon" size={hubIcon} />
      </span>
    </div>
  );
}
