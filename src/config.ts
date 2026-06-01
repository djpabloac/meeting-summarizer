import { existsSync } from "fs";

export const CONFIG = {
  whisperBin: process.env.WHISPER_BIN || "whisper-cli",
  whisperModel: process.env.WHISPER_MODEL || "/opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin",
  supportedExtensions: [".mp4", ".mkv", ".avi", ".mov", ".webm", ".mp3", ".wav", ".m4a", ".ogg", ".flac"],
  transcriptionsDir: "transcriptions",

  // Transcripción — precisión
  whisperLang: process.env.WHISPER_LANG || "es",        // forzar idioma > auto-detect
  whisperMaxContext: process.env.WHISPER_MAX_CONTEXT || "0", // 0 = no arrastrar contexto (anti-loop)
  whisperBeamSize: process.env.WHISPER_BEAM_SIZE || "", // vacío = greedy (default binario); "5" = beam search
  whisperPrompt: process.env.WHISPER_PROMPT || "",      // glosario inline para sesgar vocabulario
  whisperPromptFile: process.env.WHISPER_PROMPT_FILE || "", // o un archivo con el glosario
  whisperVad: process.env.WHISPER_VAD === "1",          // requiere WHISPER_VAD_MODEL
  whisperVadModel: process.env.WHISPER_VAD_MODEL || "",

  // Audio — pre-proceso FFmpeg. "loudnorm" normaliza niveles; añade ",afftdn=nf=-25" si hay ruido
  audioFilter: process.env.AUDIO_FILTER || "loudnorm",

  // LLM config — si LLM_API_KEY está definido, usa proveedor externo
  llmProvider: process.env.LLM_API_KEY ? "external" as const : "local" as const,
  ollamaModel: process.env.OLLAMA_MODEL || "qwen3:14b",
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

  if (CONFIG.whisperVad && (!CONFIG.whisperVadModel || !existsSync(CONFIG.whisperVadModel))) {
    console.error(`❌ WHISPER_VAD=1 pero el modelo VAD no existe: ${CONFIG.whisperVadModel || "(no definido)"}`);
    console.error("   Define WHISPER_VAD_MODEL con la ruta a un modelo VAD ggml (silero) o desactiva WHISPER_VAD.");
    process.exit(1);
  }

  const llm = getLLMConfig();
  console.log(`🤖 LLM: ${CONFIG.llmProvider === "external" ? "externo" : "local (Ollama)"} → ${llm.model}`);
  console.log(`🎙️  Whisper: lang=${CONFIG.whisperLang} mc=${CONFIG.whisperMaxContext}${CONFIG.whisperBeamSize ? ` bs=${CONFIG.whisperBeamSize}` : ""}${CONFIG.whisperVad ? " vad=on" : ""}`);
}
