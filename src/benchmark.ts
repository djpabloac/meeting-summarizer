import { writeFileSync } from "fs";
import { join } from "path";
import { CONFIG } from "./config";
import type { BenchmarkData } from "./summarize";

export interface TranscriptionBenchmark {
  file: string;
  durationMs: number;
  chars: number;
  cached: boolean;
}

export interface FullBenchmark {
  session: string;
  date: string;
  source: string;
  filesProcessed: number;
  whisper: {
    model: string;
    bin: string;
    files: TranscriptionBenchmark[];
    totalDurationMs: number;
  };
  summary: BenchmarkData;
  totalDurationMs: number;
}

export function generateBenchmarkMarkdown(data: FullBenchmark): string {
  const whisperTime = Math.round(data.whisper.totalDurationMs / 1000);
  const summaryTime = Math.round(data.summary.durationMs / 1000);
  const totalTime = Math.round(data.totalDurationMs / 1000);

  let md = `# Benchmark — ${data.session}

**Fecha**: ${data.date}
**Fuente**: \`${data.source}\`
**Archivos procesados**: ${data.filesProcessed}
**Plantilla**: ${data.summary.template}
**Tiempo total**: ${totalTime}s

---

## Transcripción (Whisper)

| Parámetro | Valor |
|-----------|-------|
| Modelo | \`${data.whisper.model}\` |
| Binario | \`${data.whisper.bin}\` |
| Tiempo total | ${whisperTime}s |

### Detalle por archivo

| Archivo | Tiempo | Caracteres | Caché |
|---------|--------|------------|-------|
`;

  for (const f of data.whisper.files) {
    const time = f.cached ? "—" : `${Math.round(f.durationMs / 1000)}s`;
    const cache = f.cached ? "✅" : "❌";
    md += `| ${f.file} | ${time} | ${f.chars.toLocaleString()} | ${cache} |\n`;
  }

  md += `
---

## Resumen (Ollama)

| Parámetro | Valor |
|-----------|-------|
| Modelo | \`${data.summary.model}\` |
| Temperatura | ${data.summary.temperature} |
| top_p | ${data.summary.topP} |
| Tiempo | ${summaryTime}s |

### Métricas de texto

| Métrica | Valor |
|---------|-------|
| Input (crudo) | ${data.summary.inputChars.toLocaleString()} chars |
| Input (limpio) | ${data.summary.cleanedChars.toLocaleString()} chars |
| Reducción por limpieza | ${data.summary.reductionPercent}% |
| Output (resumen) | ${data.summary.outputChars.toLocaleString()} chars |
| Ratio compresión | ${Math.round((data.summary.outputChars / data.summary.cleanedChars) * 100)}% |

---

## Configuración

\`\`\`json
${JSON.stringify({
  OLLAMA_MODEL: CONFIG.ollamaModel,
  OLLAMA_BASE_URL: CONFIG.ollamaBaseUrl,
  WHISPER_BIN: CONFIG.whisperBin,
  WHISPER_MODEL: CONFIG.whisperModel,
}, null, 2)}
\`\`\`
`;

  return md;
}

export function saveBenchmark(projectDir: string, sessionName: string, data: FullBenchmark): void {
  const md = generateBenchmarkMarkdown(data);
  const outputPath = join(projectDir, `${sessionName}_benchmark.md`);
  writeFileSync(outputPath, md, "utf-8");
}
