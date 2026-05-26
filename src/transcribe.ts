import { spawnSync } from "bun";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { basename, join } from "path";
import { CONFIG } from "./config";

/**
 * Obtiene el directorio de transcripciones para un proyecto.
 */
export function getTranscriptionsDir(projectDir: string): string {
  const dir = join(projectDir, "transcriptions");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Nombre limpio del archivo de caché.
 */
function getCacheFileName(filePath: string): string {
  return basename(filePath).replace(/\.[^.]+$/, "") + ".txt";
}

/**
 * Verifica si la transcripción cacheada sigue siendo válida.
 * Compara la fecha de modificación del archivo fuente con la del caché.
 */
function isCacheValid(sourceFile: string, cacheFile: string): boolean {
  if (!existsSync(cacheFile)) return false;
  const sourceMtime = statSync(sourceFile).mtimeMs;
  const cacheMtime = statSync(cacheFile).mtimeMs;
  return cacheMtime >= sourceMtime;
}

/**
 * Obtiene la transcripción cacheada si existe y es válida.
 */
export function getCachedTranscription(originalFilePath: string, projectDir: string): string | null {
  const transcriptionsDir = getTranscriptionsDir(projectDir);
  const cacheFile = join(transcriptionsDir, getCacheFileName(originalFilePath));

  if (isCacheValid(originalFilePath, cacheFile)) {
    return readFileSync(cacheFile, "utf-8");
  }
  return null;
}

/**
 * Guarda la transcripción en caché.
 */
function saveTranscription(originalFilePath: string, projectDir: string, text: string): void {
  const transcriptionsDir = getTranscriptionsDir(projectDir);
  const cacheFile = join(transcriptionsDir, getCacheFileName(originalFilePath));
  writeFileSync(cacheFile, text, "utf-8");
}

/**
 * Guarda la transcripción completa unificada.
 */
export function saveFullTranscription(projectDir: string, sessionName: string, text: string): void {
  const transcriptionsDir = getTranscriptionsDir(projectDir);
  const cacheFile = join(transcriptionsDir, `${sessionName}_completa.txt`);
  writeFileSync(cacheFile, text, "utf-8");
}

export interface TranscriptionResult {
  text: string;
  cached: boolean;
  success: boolean;
  durationMs: number;
  error?: string;
}

export function transcribeAudio(audioPath: string, originalFilePath: string, projectDir: string): TranscriptionResult {
  // Verificar caché válido
  const cached = getCachedTranscription(originalFilePath, projectDir);
  if (cached) {
    return { text: cached, cached: true, success: true, durationMs: 0 };
  }

  // Transcribir sin timestamps
  const args = [
    CONFIG.whisperBin, "-m", CONFIG.whisperModel,
    "-f", audioPath, "-l", "auto", "--no-timestamps",
  ];

  const startTime = Date.now();
  const result = spawnSync(args);
  const durationMs = Date.now() - startTime;

  if (!result.success) {
    return {
      text: "",
      cached: false,
      success: false,
      durationMs,
      error: `whisper.cpp falló: ${result.stderr.toString()}`,
    };
  }

  const text = result.stdout.toString().trim();
  if (!text) {
    return { text: "", cached: false, success: false, durationMs, error: "Transcripción vacía" };
  }

  // Guardar en caché
  saveTranscription(originalFilePath, projectDir, text);

  return { text, cached: false, success: true, durationMs };
}
