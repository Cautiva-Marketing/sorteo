/**
 * Auditoría de Lighthouse (móvil) sobre "/registro" y "/" en modo producción (SC-003, SC-019,
 * FR-027, constitución VI).
 *
 * Se ejecuta con `npm run perf`, que lo envuelve en `firebase emulators:exec` (la página lee
 * Firestore en cada petición, así que el emulador debe estar arriba). El script:
 *  1. hace `next build` y `next start` con valores ficticios (`demo-sorteo`),
 *  2. espera a que respondan `http://localhost:3000/registro` y `http://localhost:3000/`,
 *  3. ejecuta Lighthouse con emulación móvil sobre cada una e imprime Performance y Accessibility,
 *  4. detiene el servidor (y comprueba que el puerto queda libre) y
 *  5. sale con código 1 si algún puntaje de alguna página es menor que 90.
 *
 * Chrome: usa el instalado; si no hay ninguno, usa el Chromium de Playwright o el que indique
 * `CHROME_PATH`.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

// Puerto 3000 por defecto; `PERF_PORT` permite cambiarlo si está ocupado (p. ej. por `npm run dev`).
const PORT = Number(process.env.PERF_PORT ?? 3000);
const PATHS_TO_AUDIT = ["/registro", "/"];
const urlFor = (path) => `http://localhost:${PORT}${path}`;
const MIN_SCORE = 90;
const SERVER_TIMEOUT_MS = 120_000;
const isWindows = process.platform === "win32";
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

/** Entorno de producción de prueba con valores ficticios. */
function buildEnv() {
  return {
    ...process.env,
    NODE_ENV: "production",
    FIREBASE_PROJECT_ID: "demo-sorteo",
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

function isPortInUse() {
  return new Promise((resolve) => {
    const socket = net.connect({ port: PORT, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function runNext(args, env) {
  const result = spawnSync(process.execPath, [nextBin, ...args], { stdio: "inherit", env });
  if (result.status !== 0) {
    throw new Error(`"next ${args.join(" ")}" terminó con código ${result.status}.`);
  }
}

/** Detiene el servidor y todo su árbol de procesos. */
function stopServer(server) {
  if (server.exitCode !== null || server.pid === undefined) {
    return;
  }
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

async function waitForServer(server, url) {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`"next start" terminó antes de responder (código ${server.exitCode}).`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // El servidor aún no escucha.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${url} no respondió en ${SERVER_TIMEOUT_MS / 1000} s.`);
}

async function launchChrome() {
  const chromeFlags = ["--headless=new", "--disable-gpu"];
  if (process.env.CI) {
    chromeFlags.push("--no-sandbox");
  }
  try {
    return await launch({ chromeFlags });
  } catch (error) {
    if (process.env.CHROME_PATH) {
      throw error;
    }
    // Sin Chrome instalado: usa el Chromium de Playwright.
    const { chromium } = await import("@playwright/test");
    process.env.CHROME_PATH = chromium.executablePath();
    console.log(
      `Chrome no encontrado; se usa el Chromium de Playwright (${process.env.CHROME_PATH}).`,
    );
    return launch({ chromeFlags });
  }
}

async function audit(url) {
  const chrome = await launchChrome();
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      logLevel: "error",
      output: "json",
      onlyCategories: ["performance", "accessibility"],
      // Emulación móvil y estrangulamiento 4G lento: la configuración por defecto de Lighthouse.
      formFactor: "mobile",
    });
    if (!result) {
      throw new Error("Lighthouse no devolvió resultados.");
    }
    return result.lhr;
  } finally {
    await chrome.kill();
  }
}

function printFailedAudits(lhr) {
  for (const category of Object.values(lhr.categories)) {
    for (const ref of category.auditRefs) {
      const item = lhr.audits[ref.id];
      if (ref.weight > 0 && item.score !== null && item.score < 1) {
        console.log(
          `  - [${category.title}] ${item.title} (${item.id}): ${item.displayValue ?? item.score}`,
        );
      }
    }
  }
}

async function main() {
  if (await isPortInUse()) {
    throw new Error(`El puerto ${PORT} ya está en uso: libéralo antes de ejecutar la auditoría.`);
  }

  const env = buildEnv();
  console.log("Compilando la aplicación en modo producción...");
  runNext(["build"], env);

  console.log("Iniciando el servidor de producción...");
  const server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    stdio: "inherit",
    env,
    detached: !isWindows,
  });

  /** @type {Array<{ path: string; performance: number; accessibility: number }>} */
  const results = [];
  try {
    await waitForServer(server, urlFor(PATHS_TO_AUDIT[0]));
    for (const path of PATHS_TO_AUDIT) {
      const url = urlFor(path);
      console.log(`Ejecutando Lighthouse (móvil) sobre ${url} ...`);
      const lhr = await audit(url);
      const scores = {
        path,
        performance: Math.round((lhr.categories.performance.score ?? 0) * 100),
        accessibility: Math.round((lhr.categories.accessibility.score ?? 0) * 100),
      };
      results.push(scores);
      console.log(`\n${path}`);
      console.log(`  Performance:   ${scores.performance}`);
      console.log(`  Accessibility: ${scores.accessibility}`);
      if (scores.performance < MIN_SCORE || scores.accessibility < MIN_SCORE) {
        console.log("\nAuditorías con puntaje menor que 1:");
        printFailedAudits(lhr);
      }
    }
  } finally {
    stopServer(server);
    // Espera a que el puerto quede libre para no dejar procesos huérfanos.
    for (let attempt = 0; attempt < 20 && (await isPortInUse()); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (await isPortInUse()) {
      console.error(`Aviso: el puerto ${PORT} sigue ocupado tras detener el servidor.`);
    }
  }

  const failed = results.filter(
    (result) => result.performance < MIN_SCORE || result.accessibility < MIN_SCORE,
  );
  if (results.length < PATHS_TO_AUDIT.length || failed.length > 0) {
    console.error(
      `\nFallo: Performance y Accessibility deben ser al menos ${MIN_SCORE} en ${PATHS_TO_AUDIT.join(" y ")}.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`\nOK: todos los puntajes son al menos ${MIN_SCORE}.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
