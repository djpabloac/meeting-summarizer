import { OpenAI } from "openai";
import { getLLMConfig } from "./config";
import { createSpinner } from "./progress";
import { buildFactExtractionPrompt, FACT_EXTRACTION_SYSTEM_PROMPT } from "./templates/extractionSystem";
import { buildExecutiveSummaryPrompt, EXECUTIVE_SUMMARY_SYSTEM_PROMPT } from "./templates/executiveSummarySystem";
import saveLLMPayload from "./llmUtils";

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
  extraction: string;
  success: boolean;
  error?: string;
  benchmark?: BenchmarkData;
}

async function callLLM(
  system: string,
  user: string,
  projectDir?: string,
  label?: string
): Promise<{ content: string; durationMs: number }> {
  const payload = {
    model: llmConfig.model,
    temperature: LLM_OPTIONS.temperature,
    top_p: LLM_OPTIONS.top_p,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  // Save payload for debugging/validation if projectDir provided
  if (projectDir) {
    try {
      const name = label ? `${label}` : "payload";
      await saveLLMPayload(projectDir, name, payload);
    } catch (err) {
      // Non-fatal: log and continue
      console.warn("No se pudo guardar payload LLM:", err);
    }
  }

  const start = Date.now();
  const response = await client.chat.completions.create(payload as any);

  const durationMs = Date.now() - start;
  const content = response?.choices?.[0]?.message.content ?? "";
  return { content, durationMs };
}

export async function summarize(transcripcion: string, segmentos: number, projectDir?: string, sessionName?: string): Promise<SummaryResult> {
  try {
    // Paso 1: Extracción de hechos
    const spinnerOrg = createSpinner(`Paso 1/2: Extracción de hechos con ${llmConfig.model}...`);
    const organized = await callLLM(
      FACT_EXTRACTION_SYSTEM_PROMPT,
      buildFactExtractionPrompt(transcripcion, segmentos),
      projectDir,
      sessionName ? `fact_extraction_${sessionName}` : "fact_extraction"
    );

    if (!organized.content) {
      spinnerOrg.stop("❌ No se pudo extracción de hechos la transcripción");
      return { markdown: "", extraction: "", success: false, error: "Ollama no generó contenido en paso de extracción de hechos" };
    }
    spinnerOrg.stop(`✅ Paso 1/2: Extracción de hechos (${organized.content.length} chars, ${Math.round(organized.durationMs / 1000)}s)`);

    // Paso 2: Resumen ejecutivo
    const spinnerSum = createSpinner(`Paso 2/2: Generando resumen ejecutivo con ${llmConfig.model}...`);
    const summary = await callLLM(
      EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
      buildExecutiveSummaryPrompt(organized.content),
      projectDir,
      sessionName ? `executive_summary_${sessionName}` : "executive_summary"
    );

    if (!summary.content) {
      spinnerSum.stop("❌ No se pudo generar el resumen ejecutivo");
      return { markdown: "", extraction: organized.content, success: false, error: "Ollama no generó contenido en paso de resumen ejecutivo" };
    }
    spinnerSum.stop(`✅ Paso 2/2: Resumen ejecutivo generado (${summary.content.length} chars, ${Math.round(summary.durationMs / 1000)}s)`);

    const totalDurationMs = organized.durationMs + summary.durationMs;

    const benchmark: BenchmarkData = {
      model: llmConfig.model,
      temperature: LLM_OPTIONS.temperature,
      topP: LLM_OPTIONS.top_p,
      inputChars: transcripcion.length,
      cleanedChars: transcripcion.length,
      reductionPercent: 0,
      organizedChars: organized.content.length,
      organizeDurationMs: organized.durationMs,
      outputChars: summary.content.length,
      summaryDurationMs: summary.durationMs,
      durationMs: totalDurationMs,
      segmentos,
      timestamp: new Date().toISOString(),
    };

    return { markdown: summary.content, extraction: organized.content, success: true, benchmark };
  } catch (err) {
    return { markdown: "", extraction: "", success: false, error: `Error de Ollama: ${err}` };
  }
}
