import { OpenAI } from "openai";
import { CONFIG, getLLMConfig } from "./config";
import { cleanTranscription } from "./cleanTranscription";
import { ORGANIZE_SYSTEM_PROMPT, buildOrganizeUserPrompt } from "./templates/organizeTranscription";
import { MASTER_SUMMARY_SYSTEM_PROMPT, buildMasterUserPrompt } from "./templates/meetingSummary";
import { createSpinner } from "./progress";

const llmConfig = getLLMConfig();
const client = new OpenAI({
  baseURL: llmConfig.baseURL,
  apiKey: llmConfig.apiKey,
});

const LLM_OPTIONS = {
  temperature: 0.2,
  top_p: 0.8,
};

export interface BenchmarkData {
  model: string;
  temperature: number;
  topP: number;
  inputChars: number;
  cleanedChars: number;
  reductionPercent: number;
  organizedChars: number;
  organizeDurationMs: number;
  outputChars: number;
  summaryDurationMs: number;
  durationMs: number;
  segmentos: number;
  timestamp: string;
}

export interface SummaryResult {
  markdown: string;
  organizedText: string;
  success: boolean;
  error?: string;
  benchmark?: BenchmarkData;
}

async function callLLM(system: string, user: string): Promise<{ content: string; durationMs: number }> {
  const start = Date.now();
  const response = await client.chat.completions.create({
    model: llmConfig.model,
    temperature: LLM_OPTIONS.temperature,
    top_p: LLM_OPTIONS.top_p,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const durationMs = Date.now() - start;
  const content = response?.choices?.[0]?.message.content ?? "";
  return { content, durationMs };
}

export async function summarize(transcripcion: string, segmentos: number): Promise<SummaryResult> {
  try {
    // Pre-limpieza
    const cleaned = cleanTranscription(transcripcion);
    const reductionPercent = Math.round((1 - cleaned.length / transcripcion.length) * 100);
    console.log(`   🧹 Limpieza: ${transcripcion.length} → ${cleaned.length} chars (${reductionPercent}% reducido)`);

    // Paso 1: Ordenar transcripción
    const spinnerOrg = createSpinner(`Paso 1/2: Organizando transcripción con ${llmConfig.model}...`);
    const organized = await callLLM(ORGANIZE_SYSTEM_PROMPT, buildOrganizeUserPrompt(cleaned, segmentos));

    if (!organized.content) {
      spinnerOrg.stop("❌ No se pudo organizar la transcripción");
      return { markdown: "", organizedText: "", success: false, error: "Ollama no generó contenido en paso de organización" };
    }
    spinnerOrg.stop(`✅ Paso 1/2: Transcripción organizada (${organized.content.length} chars, ${Math.round(organized.durationMs / 1000)}s)`);

    // Paso 2: Generar resumen
    const spinnerSum = createSpinner(`Paso 2/2: Generando resumen con ${llmConfig.model}...`);
    const summary = await callLLM(MASTER_SUMMARY_SYSTEM_PROMPT, buildMasterUserPrompt(organized.content, segmentos));

    if (!summary.content) {
      spinnerSum.stop("❌ No se pudo generar el resumen");
      return { markdown: "", organizedText: organized.content, success: false, error: "Ollama no generó contenido en paso de resumen" };
    }
    spinnerSum.stop(`✅ Paso 2/2: Resumen generado (${summary.content.length} chars, ${Math.round(summary.durationMs / 1000)}s)`);

    const totalDurationMs = organized.durationMs + summary.durationMs;

    const benchmark: BenchmarkData = {
      model: llmConfig.model,
      temperature: LLM_OPTIONS.temperature,
      topP: LLM_OPTIONS.top_p,
      inputChars: transcripcion.length,
      cleanedChars: cleaned.length,
      reductionPercent,
      organizedChars: organized.content.length,
      organizeDurationMs: organized.durationMs,
      outputChars: summary.content.length,
      summaryDurationMs: summary.durationMs,
      durationMs: totalDurationMs,
      segmentos,
      timestamp: new Date().toISOString(),
    };

    return { markdown: summary.content, organizedText: organized.content, success: true, benchmark };
  } catch (err) {
    return { markdown: "", organizedText: "", success: false, error: `Error de Ollama: ${err}` };
  }
}
