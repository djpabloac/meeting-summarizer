import { run } from "./src";

const input = Bun.argv.slice(2).join(" ");

if (!input) {
  console.error("❌ Uso: bun run index.ts <ruta-del-video-o-carpeta>");
  console.error("   Ejemplo: bun run index.ts /ruta/a/carpeta-de-reunion");
  console.error("   Ejemplo: bun run index.ts /ruta/al/video.mp4");
  process.exit(1);
}

await run(input);
