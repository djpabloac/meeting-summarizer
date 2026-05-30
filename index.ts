import { run } from "./src";

const input = Bun.argv.slice(2).join(" ");

if (!input) {
  console.error("❌ Uso: bun run index.ts <ruta-del-video-o-carpeta>");
  process.exit(1);
}

await run(input);
