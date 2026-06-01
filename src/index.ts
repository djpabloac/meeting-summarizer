import { existsSync, readdirSync, statSync, unlinkSync, mkdirSync } from "fs";
import { join, basename, extname } from "path";
import { CONFIG, validateConfig, getLLMConfig } from "./config";
import { extractAudio } from "./extractAudio";
import { transcribeAudio, getCachedTranscription, saveFullTranscription } from "./transcribe";
import { summarize } from "./summarize";
import { saveBenchmark, type FullBenchmark, type TranscriptionBenchmark } from "./benchmark";
import { createProgressBar, createSpinner } from "./progress";

const PROJECTS_DIR = join(import.meta.dir, "..", "projects");

function ensureProjectDir(sessionName: string): string {
  const projectDir = join(PROJECTS_DIR, sessionName);
  if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true });
  return projectDir;
}

export async function run(inputPath: string): Promise<void> {
  const pipelineStart = Date.now();

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

  // Nombre de la sesión y directorio del proyecto
  const sessionName = stat.isDirectory() ? basename(inputPath) : basename(inputPath).replace(/\.[^.]+$/, "");
  const projectDir = ensureProjectDir(sessionName);

  console.log(`   📁 Proyecto: projects/${sessionName}/`);

  // Procesar cada archivo
  const progress = createProgressBar("📊 Progreso");
  const textos: string[] = [];
  const transcriptionBenchmarks: TranscriptionBenchmark[] = [];
  let totalWhisperMs = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const fileName = basename(file);
    const audioTmp = `/tmp/meeting_audio_${i}.wav`;

    progress.update(i, files.length, `Procesando: ${fileName}`);

    // Verificar si ya existe transcripción válida en caché
    const cached = getCachedTranscription(file, projectDir);
    if (cached) {
      console.log(`\n   ♻️  [${i + 1}/${files.length}] Caché válido: ${fileName}`);
      textos.push(cached);
      transcriptionBenchmarks.push({ file: fileName, durationMs: 0, chars: cached.length, cached: true });
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
    const transcribeResult = transcribeAudio(audioTmp, file, projectDir);
    if (!transcribeResult.success) {
      spinnerTranscribe.stop(`❌ ${transcribeResult.error}`);
      process.exit(1);
    }
    spinnerTranscribe.stop(`✅ [${i + 1}/${files.length}] Transcrito: ${fileName} (${transcribeResult.text.length} chars, ${Math.round(transcribeResult.durationMs / 1000)}s)`);
    textos.push(transcribeResult.text);
    totalWhisperMs += transcribeResult.durationMs;
    transcriptionBenchmarks.push({
      file: fileName,
      durationMs: transcribeResult.durationMs,
      chars: transcribeResult.text.length,
      cached: false,
    });

    // Limpiar audio temporal
    if (existsSync(audioTmp)) unlinkSync(audioTmp);
  }

  progress.complete(`${textos.length} archivo(s) procesado(s)`);

  if (textos.length === 0) {
    console.error("❌ No se obtuvo ninguna transcripción.");
    process.exit(1);
  }

  // Unir todo como un solo texto continuo
  const transcripcionCompleta = textos.join(" ");
  console.log(`\n📄 Transcripción total: ${transcripcionCompleta.length} caracteres`);

  // Guardar transcripción completa
  saveFullTranscription(projectDir, sessionName, transcripcionCompleta);

  // Paso 3: Resumir con Ollama (doble pasada)
  const llm = getLLMConfig();
  console.log(`\n📝 Procesando con ${llm.model} (doble pasada)...`);
  const summaryResult = await summarize(transcripcionCompleta, textos.length, projectDir, sessionName);
  if (!summaryResult.success) {
    console.error(`❌ ${summaryResult.error}`);
    process.exit(1);
  }

  // Guardar resultado en el proyecto
  const outputMd = join(projectDir, `${sessionName}_resumen.md`);
  await Bun.write(outputMd, summaryResult.markdown);

  // Guardar transcripción organizada (paso 1)
  const organizedFile = join(projectDir, `${sessionName}_extraction.md`);
  await Bun.write(organizedFile, summaryResult.extraction);

  // Guardar benchmark
  const totalDurationMs = Date.now() - pipelineStart;
  const benchmarkData: FullBenchmark = {
    session: sessionName,
    date: new Date().toLocaleString("es-PE"),
    source: inputPath,
    filesProcessed: files.length,
    whisper: {
      model: basename(CONFIG.whisperModel),
      bin: CONFIG.whisperBin,
      files: transcriptionBenchmarks,
      totalDurationMs: totalWhisperMs,
    },
    summary: summaryResult.benchmark!,
    totalDurationMs,
  };
  saveBenchmark(projectDir, sessionName, benchmarkData);

  console.log(`\n✅ Guardado: projects/${sessionName}/${sessionName}_resumen.md`);
  console.log(`📋 Extracción: projects/${sessionName}/${sessionName}_extraction.md`);
  console.log(`📊 Benchmark: projects/${sessionName}/${sessionName}_benchmark.md`);
  console.log(`⏱️ Tiempo total: ${Math.round(totalDurationMs / 1000)}s`);
}
