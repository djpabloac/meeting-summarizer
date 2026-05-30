import { existsSync } from "fs";

export const CONFIG = {
  whisperBin: process.env.WHISPER_BIN || "whisper-cli",
  whisperModel: process.env.WHISPER_MODEL || "/opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin",
  supportedExtensions: [".mp4", ".mkv", ".avi", ".mov", ".webm", ".mp3", ".wav", ".m4a", ".ogg", ".flac"],
  transcriptionsDir: "transcriptions",

  // LLM config — si LLM_API_KEY está definido, usa proveedor externo
  llmProvider: process.env.LLM_API_KEY ? "external" as const : "local" as const,
  ollamaModel: process.env.OLLAMA_MODEL || "gemma4:e4b",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  llmApiKey: process.env.LLM_API_KEY || "",
  llmBaseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
  llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
} as const;

export function getLLMConfig() {
  if (CONFIG.llmProvider === "external") {
    return {
      baseURL: CONFIG.llmBaseUrl,
      apiKey: CONFIG.llmApiKey,
      model: CONFIG.llmModel,
    };
  }
  return {
    baseURL: CONFIG.ollamaBaseUrl,
    apiKey: "ollama",
    model: CONFIG.ollamaModel,
  };
}

export function validateConfig(): void {
  if (!existsSync(CONFIG.whisperModel)) {
    console.error(`❌ Modelo whisper no encontrado: ${CONFIG.whisperModel}`);
    console.error("   Descárgalo: curl -L -o /opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin");
    process.exit(1);
  }

  const llm = getLLMConfig();
  console.log(`🤖 LLM: ${CONFIG.llmProvider === "external" ? "externo" : "local (Ollama)"} → ${llm.model}`);
}
