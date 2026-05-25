import { existsSync } from "fs";

export const CONFIG = {
  whisperBin: process.env.WHISPER_BIN || "whisper-cli",
  whisperModel: process.env.WHISPER_MODEL || "/opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin",
  ollamaModel: process.env.OLLAMA_MODEL || "qwen3:14b",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  supportedExtensions: [".mp4", ".mkv", ".avi", ".mov", ".webm", ".mp3", ".wav", ".m4a", ".ogg", ".flac"],
  transcriptionsDir: "transcriptions",
} as const;

export function validateConfig(): void {
  if (!existsSync(CONFIG.whisperModel)) {
    console.error(`❌ Modelo whisper no encontrado: ${CONFIG.whisperModel}`);
    console.error("   Descárgalo: curl -L -o /opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin");
    process.exit(1);
  }
}
