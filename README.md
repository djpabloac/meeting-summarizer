# Meeting Summarizer

Herramienta local para transcribir y resumir reuniones a partir de archivos de video o audio, usando modelos de IA locales (Ollama + Whisper).

## Uso Actual

```bash
bun run index.ts <ruta-del-video-o-carpeta>
```

Acepta un archivo suelto o una carpeta. Si es **carpeta**, todos los archivos soportados se procesan en orden alfabético y se tratan como **segmentos de una misma reunión** (una sola transcripción y un solo resumen). Extensiones soportadas: `.mp4 .mkv .avi .mov .webm .mp3 .wav .m4a .ogg .flac`.

## Requisitos

- [Bun](https://bun.com) v1.3.14+
- [FFmpeg](https://ffmpeg.org/) — `brew install ffmpeg`
- [Whisper C++](https://github.com/ggerganov/whisper.cpp) — `brew install whisper-cpp`
- [Ollama](https://ollama.ai/) — `brew install ollama` (opcional si usas un proveedor LLM externo vía `LLM_API_KEY`)

## Cómo Funciona

```
Video/Audio ──FFmpeg──▶ WAV 16kHz mono ──Whisper──▶ texto plano (sin timestamps)
                                                          │
                              (todos los archivos se concatenan en un solo texto)
                                                          │
                                                          ▼
                  Paso 1 ── Extracción de hechos (LLM) ──▶ JSON de hechos explícitos
                                                          │
                  Paso 2 ── Minuta ejecutiva (LLM) ──────▶ resumen.md
```

**Doble pasada LLM**: primero se extraen los hechos mencionados explícitamente (sin inventar ni interpretar), y luego se genera la minuta ejecutiva a partir de esos hechos. Esto reduce alucinaciones y mejora la calidad del resumen. No se hace chunking: la transcripción se procesa como un solo texto continuo para no perder contexto.

### Salida — `projects/<sesión>/` (gitignored)

| Archivo | Contenido |
|---------|-----------|
| `transcriptions/<archivo>.txt` | Caché de transcripción por archivo fuente |
| `transcriptions/<sesión>_completa.txt` | Transcripción unificada |
| `<sesión>_extraction.md` | Hechos extraídos (paso 1, JSON crudo) |
| `<sesión>_resumen.md` | **Minuta ejecutiva final** |
| `<sesión>_benchmark.md` | Modelos, tiempos y métricas de la corrida |
| `llm_payloads/*.json` | Último payload enviado al LLM (debug) |

**Caché por `mtime`**: una transcripción se reutiliza salvo que el archivo fuente sea más reciente que su `.txt`. Para forzar re-transcripción, borra el `.txt` correspondiente.

## Variables de Entorno

```bash
# Transcripción
WHISPER_BIN=whisper-cli
WHISPER_MODEL=/opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin

# LLM local (default)
OLLAMA_MODEL=qwen3:14b
OLLAMA_BASE_URL=http://localhost:11434/v1

# LLM externo (opcional) — si LLM_API_KEY está definido, se usa este proveedor
# OpenAI-compatible (OpenAI, Groq, OpenRouter, etc.) en lugar de Ollama
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

La selección de proveedor es automática: si `LLM_API_KEY` está definido se usa el proveedor externo; si no, Ollama local. Parámetros de muestreo fijos: `temperature=0.2`, `top_p=0.8`.

---

## Roadmap

### Fase 1 — Script CLI (actual) ✅ En progreso

Estructurar el pipeline y encontrar un modelo local que genere resúmenes de calidad.

- [x] Pipeline: video → audio (FFmpeg) → transcripción (Whisper) → resumen (LLM)
- [x] Soporte para carpetas con múltiples archivos de una misma reunión
- [x] Caché de transcripciones organizado por sesión (evita reprocesar)
- [x] Doble pasada LLM: extracción de hechos → minuta ejecutiva
- [x] Soporte de proveedor LLM externo (OpenAI-compatible) además de Ollama local
- [x] Benchmark por corrida (modelos, tiempos, métricas de texto)
- [x] Prompts en español (extracción + minuta ejecutiva)
- [x] Progress bar y spinners para feedback visual
- [x] Evaluar modelos: gemma4:e4b, qwen3:14b, mistral-small
- [ ] Conectar pre-limpieza de transcripción al pipeline (`cleanTranscription.ts` ya existe pero **no está cableado**)
- [ ] Conectar paso de clasificación de hechos por área (`classificationSystem.ts` existe pero **no está cableado**)
- [ ] Benchmark de calidad de resumen por modelo
- [ ] Ajuste fino del prompt según resultados

### Fase 2 — App Web con UI

Diseñar una aplicación con layout para gestionar proyectos, plantillas y transcripciones.

- [ ] Definir stack frontend (React/Next.js o similar)
- [ ] Layout principal con sidebar de navegación
- [ ] Vista de proyectos (lista + detalle)
- [ ] Vista de transcripciones por proyecto
- [ ] Vista de resúmenes generados
- [ ] Vista de plantillas de prompt
- [ ] Panel de configuración

### Fase 3 — Configuración de Modelos

Permitir configurar el motor de transcripción y el modelo de resumen desde la UI.

- [ ] Selector de motor de transcripción: Whisper C++ o Parakeet (NVIDIA)
- [ ] Configuración de ruta del modelo de whisper
- [ ] Selector de modelo Ollama (listar modelos disponibles vía API)
- [ ] Configuración de parámetros LLM (temperatura, top_p)
- [ ] Validación de conexión a Ollama
- [ ] Test rápido de transcripción/resumen desde la UI

### Fase 4 — Plantillas de Contexto

Crear y gestionar plantillas de prompt para personalizar el tipo de resumen.

- [ ] CRUD de plantillas (crear, editar, duplicar, eliminar)
- [ ] Plantillas predefinidas:
  - Minuta ejecutiva (actual)
  - Resumen técnico (para devs)
  - Action items solamente
  - Resumen para stakeholders
- [ ] Variables dinámicas en plantillas (nombre del proyecto, fecha, participantes)
- [ ] Preview del prompt antes de ejecutar
- [ ] Asignar plantilla por defecto a un proyecto

### Fase 5 — Gestión de Proyectos

Crear proyectos para organizar reuniones, transcripciones y resúmenes.

- [ ] CRUD de proyectos
- [ ] Configurar ruta de videos/audios por proyecto
- [ ] Detección automática de nuevos archivos en la ruta
- [ ] Almacenar transcripciones asociadas al proyecto
- [ ] Almacenar resúmenes generados con metadata (fecha, modelo usado, plantilla)
- [ ] Historial de resúmenes por reunión (re-generar con otra plantilla/modelo)
- [ ] Exportar resumen (Markdown, PDF)
- [ ] Búsqueda dentro de transcripciones

---

## Estructura del Proyecto (actual)

```
meeting-summarizer/
├── index.ts                            ← Entry point (parsea argv)
├── src/
│   ├── index.ts                        ← Orquestador del pipeline
│   ├── config.ts                       ← Config + selección de proveedor LLM
│   ├── extractAudio.ts                 ← FFmpeg → WAV 16kHz mono
│   ├── transcribe.ts                   ← Whisper + caché por mtime
│   ├── summarize.ts                    ← Doble pasada LLM (cliente openai)
│   ├── benchmark.ts                    ← Métricas/benchmark por corrida
│   ├── llmUtils.ts                     ← Guarda payloads LLM (debug)
│   ├── cleanTranscription.ts           ← Limpieza de ruido (NO cableado aún)
│   ├── progress.ts                     ← Progress bar y spinners
│   └── templates/
│       ├── extractionSystem.ts         ← Prompt paso 1: extracción de hechos
│       ├── executiveSummarySystem.ts   ← Prompt paso 2: minuta ejecutiva
│       └── classificationSystem.ts     ← Clasificación por área (NO cableado aún)
├── projects/                           ← Salida por reunión (gitignored)
├── .kiro/steering/                     ← Guías de desarrollo
└── package.json
```

## Instalación

```bash
bun install
```

## Modelos Recomendados

| Modelo | Uso | Notas |
|--------|-----|-------|
| `gemma4:e4b` | Resumen | Buen balance calidad/velocidad |
| `qwen3:14b` | Resumen | Requiere `/no_think` para español |
| `mistral-small` | Resumen | Alternativa ligera |
| `ggml-large-v3-turbo` | Transcripción | Whisper, mejor calidad |
