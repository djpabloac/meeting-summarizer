import { run } from "./src";
import type { TemplateMode } from "./src/summarize";

const args = Bun.argv.slice(2);

// Extraer flags
let mode: TemplateMode = "chronology"; // default: cronología fiel
const modeIndex = args.indexOf("--mode");
if (modeIndex !== -1 && args[modeIndex + 1]) {
  const value = args[modeIndex + 1] as string;
  if (value === "summary" || value === "chronology") {
    mode = value;
  }
  args.splice(modeIndex, 2);
}

const input = args.join(" ");

if (!input) {
  console.error("❌ Uso: bun run index.ts <ruta> [--mode chronology|summary]");
  console.error("");
  console.error("   Modos:");
  console.error("     chronology  — Organiza cronológicamente sin resumir (default)");
  console.error("     summary     — Resumen ejecutivo con interpretación");
  console.error("");
  console.error("   Ejemplos:");
  console.error("     bun run index.ts /ruta/carpeta");
  console.error("     bun run index.ts /ruta/carpeta --mode summary");
  process.exit(1);
}

await run(input, mode);
