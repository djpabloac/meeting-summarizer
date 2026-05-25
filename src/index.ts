import { existsSync, readdirSync, statSync, unlinkSync } from "fs";
import { join, basename, extname } from "path";
import { CONFIG, validateConfig } from "./config";
import { extractAudio } from "./extractAudio";
import { transcribeAudio, getCachedTranscription } from "./transcribe";
import { summarize } from "./summarize";
import { createProgressBar, createSpinner } from "./progress";

export async function run(inputPath: string): Promise<void> {
  if (!existsSync(inputPath)) {
    console.error(`❌ Ruta no encontrada: ${inputPath}`);
    process.exit(1);
  }

  validateConfig();

  // Determinar archivos a procesar
  const stat = statSync(inputPath);
  let files: string[] = [];

  if (stat.isDirectory()) {
    files = readdirSync(inputPath)
      .filter((f) => (CONFIG.supportedExtensions as readonly string[]).includes(extname(f).toLowerCase()))
      .sort()
      .map((f) => join(inputPath, f));

    if (files.length === 0) {
      console.error(`❌ No se encontraron archivos de audio/video en: ${inputPath}`);
      process.exit(1);
    }
    console.log(`\n📂 Carpeta: ${basename(inputPath)} (${files.length} archivo(s))`);
    files.forEach((f) => console.log(`   • ${basename(f)}`));
  } else {
    files = [inputPath];
    console.log(`\n📄 Archivo: ${basename(inputPath)}`);
  }

  // Nombre del archivo de salida
  const outputMd = stat.isDirectory()
    ? join(inputPath, `${basename(inputPath)}_resumen.md`)
    : inputPath.replace(/\.[^.]+$/, "") + "_resumen.md";

  // Procesar cada archivo
  const progress = createProgressBar("📊 Progreso");
  const transcripciones: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const fileName = basename(file);
    const audioTmp = `/tmp/meeting_audio_${i}.wav`;

    progress.update(i, files.length, `Procesando: ${fileName}`);

    // Verificar si ya existe transcripción en caché
    const cached = getCachedTranscription(file);
    if (cached) {
      console.log(`\n   ♻️  [${i + 1}/${files.length}] Caché encontrado: ${fileName}`);
      transcripciones.push(`--- Segmento: ${fileName} ---\n${cached}`);
      continue;
    }

    // Paso 1: Extraer audio
    const spinnerAudio = createSpinner(`[${i + 1}/${files.length}] Extrayendo audio: ${fileName}`);
    const audioResult = extractAudio(file, audioTmp);
    if (!audioResult.success) {
      spinnerAudio.stop(`❌ ${audioResult.error}`);
      process.exit(1);
    }
    spinnerAudio.stop(`✅ [${i + 1}/${files.length}] Audio extraído: ${fileName}`);

    // Paso 2: Transcribir
    const spinnerTranscribe = createSpinner(`[${i + 1}/${files.length}] Transcribiendo: ${fileName} (puede tardar minutos)`);
    const transcribeResult = transcribeAudio(audioTmp, file);
    if (!transcribeResult.success) {
      spinnerTranscribe.stop(`❌ ${transcribeResult.error}`);
      process.exit(1);
    }
    spinnerTranscribe.stop(`✅ [${i + 1}/${files.length}] Transcrito: ${fileName} (${transcribeResult.text.length} chars)`);
    transcripciones.push(`--- Segmento: ${fileName} ---\n${transcribeResult.text}`);

    // Limpiar audio temporal
    if (existsSync(audioTmp)) unlinkSync(audioTmp);
  }

  progress.complete(`${transcripciones.length} archivo(s) procesado(s)`);

  if (transcripciones.length === 0) {
    console.error("❌ No se obtuvo ninguna transcripción.");
    process.exit(1);
  }

  const transcripcionCompleta = transcripciones.join("\n\n");
  console.log(`\n📄 Transcripción total: ${transcripcionCompleta.length} caracteres`);

  // Paso 3: Resumir con Ollama
  const spinnerSummary = createSpinner("Generando resumen con Ollama... (puede tardar varios minutos)");
  const summaryResult = await summarize(transcripcionCompleta, transcripciones.length);
  if (!summaryResult.success) {
    spinnerSummary.stop(`❌ ${summaryResult.error}`);
    process.exit(1);
  }
  spinnerSummary.stop("✅ Resumen generado por Ollama");

  await Bun.write(outputMd, summaryResult.markdown);
  console.log(`\n✅ Archivo guardado: ${outputMd}`);
}
