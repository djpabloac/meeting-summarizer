# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CLI local que transcribe y resume reuniones desde archivos de video/audio usando IA local (Whisper.cpp + Ollama), sin enviar nada a la nube por defecto. El README describe un roadmap de app web (Fases 2-5) que aún no existe — hoy solo hay el script CLI (Fase 1).

## Commands

```bash
bun install                              # instalar dependencias
bun run index.ts <ruta-video-o-carpeta>  # ejecutar el pipeline completo
```

No hay tests, linter ni build configurados. Bun ejecuta TypeScript directamente (no hay paso de compilación).

Requisitos del sistema: `ffmpeg`, `whisper-cli` (whisper.cpp) y un Ollama corriendo en local. `validateConfig()` aborta el proceso si no encuentra el modelo de Whisper en disco.

## Pipeline (el "big picture")

Entry: `index.ts` → `src/index.ts:run()`. El flujo por cada ejecución:

1. **Resolver input** — un archivo o una carpeta. Si es carpeta, procesa todos los archivos con extensión soportada (`CONFIG.supportedExtensions`) ordenados alfabéticamente, tratándolos como segmentos de **una misma reunión**.
2. **Por archivo**: FFmpeg extrae audio a WAV mono 16kHz (`extractAudio.ts`) → Whisper transcribe sin timestamps (`transcribe.ts`). El WAV va a `/tmp` y se borra tras transcribir.
3. **Concatenar** todas las transcripciones en un solo texto continuo (sin chunking — dividir pierde contexto).
4. **Doble pasada LLM** (`summarize.ts`):
   - Paso 1 — **extracción de hechos**: `extractionSystem.ts` pide al LLM devolver JSON de hechos explícitos, sin inventar ni resumir.
   - Paso 2 — **minuta ejecutiva**: `executiveSummarySystem.ts` toma esos hechos y genera el Markdown final con secciones fijas (Temas, Problemas, Decisiones, Tareas, Riesgos, Preguntas, Próximos Pasos).
5. **Persistir** todo en `projects/<sessionName>/` y generar un benchmark (`benchmark.ts`).

`sessionName` = nombre de la carpeta, o el nombre del archivo sin extensión.

## Output: `projects/<sessionName>/` (gitignored)

- `transcriptions/<archivo>.txt` — caché por archivo fuente.
- `transcriptions/<session>_completa.txt` — transcripción unificada.
- `<session>_extraction.md` — salida cruda del paso 1 (hechos JSON).
- `<session>_resumen.md` — la minuta ejecutiva final.
- `<session>_benchmark.md` — modelos, tiempos, métricas de texto, config en JSON.
- `llm_payloads/*.json` — último payload enviado al LLM por paso (debug, se sobrescribe).

**Caché por mtime**: una transcripción se reutiliza salvo que el archivo fuente sea más nuevo que el `.txt`. Para forzar re-transcripción, borrar el `.txt` correspondiente (`transcribe.ts:isCacheValid`).

## Configuración LLM (`config.ts`)

Selección automática de proveedor: si `LLM_API_KEY` está definido → proveedor externo OpenAI-compatible; si no → Ollama local. Ambos usan el cliente `openai`. Variables: `WHISPER_BIN`, `WHISPER_MODEL`, `OLLAMA_MODEL`, `OLLAMA_BASE_URL`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`. Defaults pensados para macOS/Homebrew (`/opt/homebrew/...`). `temperature: 0.2`, `top_p: 0.8` (hardcoded en `summarize.ts`).

## Gotchas (estado real del código, no del README/.kiro)

- **`cleanTranscription.ts` NO se usa.** El pipeline pasa la transcripción cruda directo al LLM. Por eso en el benchmark `cleanedChars === inputChars` y `reductionPercent: 0`. Si tu tarea es "mejorar la limpieza", primero hay que cablearlo en `src/index.ts`.
- **`classificationSystem.ts` NO se usa.** Define un paso de clasificación de hechos por área (frontend/backend/etc.) que no está conectado a la doble pasada actual.
- **`.kiro/steering/development.md` está desactualizado.** Menciona templates `organizeTranscription.ts` y `meetingSummary.ts` que ya no existen; los reales son `extractionSystem.ts` / `executiveSummarySystem.ts`. Confía en el código, no en ese doc.
- **Todo en español.** Los system prompts empiezan con "RESPONDE EXCLUSIVAMENTE EN ESPAÑOL" — el idioma es un requisito del producto, no un detalle.

## Convenciones

- APIs nativas de Bun: `Bun.write`, `Bun.argv`, `spawnSync` from `"bun"`.
- Patrón Result: cada módulo devuelve `{ success, error?, ... }` en vez de lanzar; el orquestador hace `process.exit(1)` ante fallos.
- Un módulo = una responsabilidad.
- Código y nombres en inglés; mensajes al usuario en español.
