import { spawnSync } from "bun";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { createHash } from "crypto";
import { CONFIG } from "./config";

const CACHE_DIR = join(import.meta.dir, "..", CONFIG.transcriptionsDir);

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(filePath: string): string {
  const name = basename(filePath, ".wav").replace(/[^a-zA-Z0-9_-]/g, "_");
  const hash = createHash("md5").update(filePath).digest("hex").slice(0, 8);
  return `${name}_${hash}.txt`;
}

export function getCachedTranscription(originalFilePath: string): string | null {
  ensureCacheDir();
  const cacheFile = join(CACHE_DIR, getCacheKey(originalFilePath));
  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile, "utf-8");
  }
  return null;
}

function saveTranscription(originalFilePath: string, text: string): void {
  ensureCacheDir();
  const cacheFile = join(CACHE_DIR, getCacheKey(originalFilePath));
  writeFileSync(cacheFile, text, "utf-8");
}

export interface TranscriptionResult {
  text: string;
  cached: boolean;
  success: boolean;
  error?: string;
}

export function transcribeAudio(audioPath: string, originalFilePath: string): TranscriptionResult {
  // Verificar caché
  const cached = getCachedTranscription(originalFilePath);
  if (cached) {
    return { text: cached, cached: true, success: true };
  }

  // Transcribir con whisper
  const result = spawnSync([
    CONFIG.whisperBin, "-m", CONFIG.whisperModel,
    "-f", audioPath, "-l", "auto", "--no-timestamps",
  ]);

  if (!result.success) {
    return {
      text: "",
      cached: false,
      success: false,
      error: `whisper.cpp falló: ${result.stderr.toString()}`,
    };
  }

  const text = result.stdout.toString().trim();
  if (!text) {
    return { text: "", cached: false, success: false, error: "Transcripción vacía" };
  }

  // Guardar en caché
  saveTranscription(originalFilePath, text);

  return { text, cached: false, success: true };
}
