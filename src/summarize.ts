import { OpenAI } from "openai";
import { CONFIG } from "./config";
import { cleanTranscription } from "./cleanTranscription";
import { MASTER_SUMMARY_SYSTEM_PROMPT, buildMasterUserPrompt } from "./templates/meetingSummary";
import { CHRONOLOGY_SYSTEM_PROMPT, buildChronologyUserPrompt } from "./templates/meetingChronology";
import { createSpinner } from "./progress";

const ollama = new OpenAI({
  baseURL: CONFIG.ollamaBaseUrl,
  apiKey: "ollama",
});

const LLM_OPTIONS = {
  temperature: 0.2,
  top_p: 0.8,
};

export type TemplateMode = "summary" | "chronology";

export interface BenchmarkData {
  model: string;
  template: TemplateMode;
  temperature: number;
  topP: number;
  inputChars: number;
  cleanedChars: number;
  reductionPercent: number;
  outputChars: number;
  durationMs: number;
  segmentos: number;
  timestamp: string;
}

export interface SummaryResult {
  markdown: string;
  success: boolean;
  error?: string;
  benchmark?: BenchmarkData;
}

function getPrompts(mode: TemplateMode, text: string, segmentos: number) {
  if (mode === "chronology") {
    return {
      system: CHRONOLOGY_SYSTEM_PROMPT,
      user: buildChronologyUserPrompt(text, segmentos),
    };
  }
  return {
    system: MASTER_SUMMARY_SYSTEM_PROMPT,
    user: buildMasterUserPrompt(text, segmentos),
  };
}

export async function summarize(
  transcripcion: string,
  segmentos: number,
  mode: TemplateMode = "chronology"
): Promise<SummaryResult> {
  try {
    // Solo limpiar en modo summary — chronology recibe el texto tal cual
    let textToProcess: string;
    let reductionPercent = 0;

    if (mode === "summary") {
      textToProcess = cleanTranscription(transcripcion);
      reductionPercent = Math.round((1 - textToProcess.length / transcripcion.length) * 100);
      console.log(`   🧹 Limpieza: ${transcripcion.length} → ${textToProcess.length} chars (${reductionPercent}% reducido)`);
    } else {
      textToProcess = transcripcion;
      console.log(`   📄 Sin limpieza (modo ${mode}): ${transcripcion.length} chars`);
    }

    console.log(`   📋 Plantilla: ${mode}`);

    const { system, user } = getPrompts(mode, textToProcess, segmentos);

    // Resumen directo
    const spinner = createSpinner(`Procesando con ${CONFIG.ollamaModel} [${mode}]...`);
    const startTime = Date.now();

    const response = await ollama.chat.completions.create({
      model: CONFIG.ollamaModel,
      temperature: LLM_OPTIONS.temperature,
      top_p: LLM_OPTIONS.top_p,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const durationMs = Date.now() - startTime;
    const content = response?.choices?.[0]?.message.content;
    spinner.stop(`✅ Generado con ${CONFIG.ollamaModel} [${mode}] (${Math.round(durationMs / 1000)}s)`);

    if (!content) {
      return { markdown: "", success: false, error: "Ollama no generó contenido" };
    }

    const benchmark: BenchmarkData = {
      model: CONFIG.ollamaModel,
      template: mode,
      temperature: LLM_OPTIONS.temperature,
      topP: LLM_OPTIONS.top_p,
      inputChars: transcripcion.length,
      cleanedChars: textToProcess.length,
      reductionPercent,
      outputChars: content.length,
      durationMs,
      segmentos,
      timestamp: new Date().toISOString(),
    };

    return { markdown: content, success: true, benchmark };
  } catch (err) {
    return { markdown: "", success: false, error: `Error de Ollama: ${err}` };
  }
}
