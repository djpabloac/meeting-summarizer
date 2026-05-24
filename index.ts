import { spawnSync } from "bun";
import { OpenAI } from "openai";
import { existsSync, unlinkSync } from "fs";

const WHISPER_BIN = process.env.WHISPER_BIN || "whisper-cli";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "/opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3:8b";

const ollama = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
});

const videoInput = Bun.argv.slice(2).join(" ");
if (!videoInput) {
  console.error("❌ Uso: bun run index.ts <ruta-del-video>");
  process.exit(1);
}
if (!existsSync(videoInput)) {
  console.error(`❌ Archivo no encontrado: ${videoInput}`);
  process.exit(1);
}

const audioTmp = "/tmp/meeting_audio.wav";
const outputMd = videoInput.replace(/\.[^.]+$/, "") + "_resumen.md";

// Paso 1: Extraer audio con FFmpeg
console.log("🎬 1/3 Extrayendo audio con FFmpeg...");
const ffmpeg = spawnSync([
  "ffmpeg", "-y", "-i", videoInput,
  "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", audioTmp,
]);
if (!ffmpeg.success) {
  console.error("❌ FFmpeg falló:", ffmpeg.stderr.toString());
  process.exit(1);
}

// Paso 2: Transcribir con whisper.cpp
console.log("🧠 2/3 Transcribiendo con whisper.cpp...");
if (!existsSync(WHISPER_MODEL)) {
  console.error(`❌ Modelo no encontrado: ${WHISPER_MODEL}`);
  console.error("   Descárgalo: curl -L -o /opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin");
  process.exit(1);
}

const whisper = spawnSync([
  WHISPER_BIN, "-m", WHISPER_MODEL,
  "-f", audioTmp, "-l", "auto", "--no-timestamps",
]);
if (!whisper.success) {
  console.error("❌ whisper.cpp falló:", whisper.stderr.toString());
  process.exit(1);
}
const transcripcion = whisper.stdout.toString().trim();
if (!transcripcion) {
  console.error("❌ La transcripción está vacía.");
  process.exit(1);
}
console.log(`   ✓ Transcripción: ${transcripcion.length} caracteres`);

// Paso 3: Resumir con Ollama
console.log("📝 3/3 Generando resumen con Ollama...");
const response = await ollama.chat.completions.create({
  model: OLLAMA_MODEL,
  messages: [
    {
      role: "system",
      content: `Eres un Project Manager experto. Transforma la transcripción de una reunión en un reporte Markdown profesional en español con:
- Resumen ejecutivo
- Puntos clave discutidos
- Decisiones tomadas
- Tareas pendientes (tabla con Tarea, Responsable, Prioridad)
- Próximos pasos`,
    },
    { role: "user", content: `Transcripción:\n\n${transcripcion}` },
  ],
});

const markdown = response?.choices?.[0]?.message.content || "❌ Sin contenido generado.";
await Bun.write(outputMd, markdown);

// Limpiar audio temporal
if (existsSync(audioTmp)) unlinkSync(audioTmp);

console.log(`\n✅ Resumen generado: ${outputMd}`);
