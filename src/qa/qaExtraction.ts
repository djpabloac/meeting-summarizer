import { OpenAI } from "openai";
import { getLLMConfig } from "../config";
import { QA_EXTRACTION_SYSTEM_PROMPT, buildQaExtractionPrompt } from "./qaTemplate";
import saveLLMPayload from "../llmUtils";

const llmConfig = getLLMConfig();
const client = new OpenAI({ baseURL: llmConfig.baseURL, apiKey: llmConfig.apiKey });

export interface QaFeature {
  titulo: string;
  objetivo: string;
  alcance: string;
  precondiciones: string[];
  casos: string[];
  origen?: string;
}

export interface QaExtractionResult {
  features: QaFeature[];
  success: boolean;
  durationMs: number;
  error?: string;
}

// El LLM a veces envuelve el JSON en fences ```json ... ```
function parseFeatures(content: string): QaFeature[] {
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const data = JSON.parse(cleaned);
  return Array.isArray(data?.features) ? data.features : [];
}

export async function extractQaFeatures(
  hechosJson: string,
  projectDir: string,
  sessionName: string,
  transcript?: string
): Promise<QaExtractionResult> {
  const payload = {
    model: llmConfig.model,
    temperature: 0.2,
    top_p: 0.8,
    messages: [
      { role: "system", content: QA_EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: buildQaExtractionPrompt(hechosJson, transcript) },
    ],
  };

  try {
    await saveLLMPayload(projectDir, `qa_extraction_${sessionName}`, payload);
  } catch (err) {
    console.warn("No se pudo guardar payload LLM:", err);
  }

  const start = Date.now();
  let content = "";
  try {
    const response = await client.chat.completions.create(payload as any);
    content = response?.choices?.[0]?.message.content ?? "";
  } catch (err) {
    return { features: [], success: false, durationMs: Date.now() - start, error: `Error LLM: ${err}` };
  }
  const durationMs = Date.now() - start;

  if (!content) {
    return { features: [], success: false, durationMs, error: "El LLM no generó contenido" };
  }

  let features: QaFeature[];
  try {
    features = parseFeatures(content);
  } catch (err) {
    return { features: [], success: false, durationMs, error: `JSON inválido del LLM: ${err}` };
  }

  if (features.length === 0) {
    return { features: [], success: false, durationMs, error: "No se identificaron features a validar" };
  }

  return { features, success: true, durationMs };
}
