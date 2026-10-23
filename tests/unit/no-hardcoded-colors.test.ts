import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Constitución V: los colores se definen únicamente como design tokens en `src/app/globals.css`.
 * Ningún otro archivo de `src/` puede contener valores de color literales.
 */
const SRC_DIR = path.resolve(import.meta.dirname, "../../src");
const ALLOWED_FILE = path.join(SRC_DIR, "app", "globals.css");
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

// #rgb, #rgba, #rrggbb, #rrggbbaa  |  rgb( rgba( hsl( hsla( oklch(
const COLOR_PATTERN =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])|\b(?:rgba?|hsla?|oklch)\(/;

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (EXTENSIONS.has(path.extname(entry.name)) && fullPath !== ALLOWED_FILE) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("colores hardcodeados", () => {
  it("el detector reconoce los formatos de color prohibidos", () => {
    for (const sample of ["#fff", "#3d8cd3", "#3d8cd3cc", "rgb(0 0 0)", "rgba(0,0,0,.5)"]) {
      expect(COLOR_PATTERN.test(sample), sample).toBe(true);
    }
    for (const sample of ["hsl(0 0% 0%)", "oklch(0.5 0.1 200)"]) {
      expect(COLOR_PATTERN.test(sample), sample).toBe(true);
    }
    for (const sample of ["bg-brand-600", "#main-content", "text-ink-900", 'href="#"']) {
      expect(COLOR_PATTERN.test(sample), sample).toBe(false);
    }
  });

  it("ningún archivo de src/ (salvo globals.css) contiene colores literales", () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_DIR)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (COLOR_PATTERN.test(line)) {
          offenders.push(`${path.relative(SRC_DIR, file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
