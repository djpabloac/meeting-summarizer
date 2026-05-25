import { OpenAI } from "openai";
import { CONFIG } from "./config";
import { MEETING_SUMMARY_SYSTEM_PROMPT, buildUserPrompt } from "./templates/meetingSummary";

const ollama = new OpenAI({
  baseURL: CONFIG.ollamaBaseUrl,
  apiKey: "ollama",
});

export interface SummaryResult {
  markdown: string;
  success: boolean;
  error?: string;
}

export async function summarize(transcripcion: string, segmentos: number): Promise<SummaryResult> {
  try {
    const response = await ollama.chat.completions.create({
      model: CONFIG.ollamaModel,
      messages: [
        { role: "system", content: MEETING_SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(transcripcion, segmentos) },
      ],
    });

    const content = response?.choices?.[0]?.message.content;
    if (!content) {
      return { markdown: "", success: false, error: "Ollama no generó contenido" };
    }

    return { markdown: content, success: true };
  } catch (err) {
    return { markdown: "", success: false, error: `Error de Ollama: ${err}` };
  }
}
