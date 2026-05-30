---
inclusion: always
---

# Guía de Desarrollo - Meeting Summarizer

## Runtime y Comandos

Este proyecto usa **Bun** como runtime:

- Ejecutar: `bun run index.ts <ruta-del-video-o-carpeta>`
- Instalar dependencias: `bun install`

## Estructura del Proyecto

```
meeting-summarizer/
├── index.ts                        ← Entry point
├── src/
│   ├── index.ts                    ← Orquestador del pipeline
│   ├── config.ts                   ← Configuración
│   ├── extractAudio.ts             ← FFmpeg → WAV
│   ├── transcribe.ts               ← Whisper (con caché por proyecto)
│   ├── cleanTranscription.ts       ← Limpieza de ruido
│   ├── summarize.ts                ← Ollama doble pasada (organizar + resumir)
│   ├── benchmark.ts                ← Generación de metadata/benchmark
│   ├── progress.ts                 ← UI de progreso
│   └── templates/
│       ├── organizeTranscription.ts ← Prompt paso 1: ordenar transcripción
│       └── meetingSummary.ts        ← Prompt paso 2: resumen ejecutivo
├── projects/                       ← Salida organizada por reunión (gitignored)
│   └── Exlam/
│       ├── transcriptions/
│       │   ├── 2026-05-25 15-04-19.txt
│       │   └── Exlam_completa.txt
│       ├── Exlam_organizada.txt
│       ├── Exlam_resumen.md
│       └── Exlam_benchmark.md
├── .kiro/steering/
└── package.json
```

## Pipeline de Procesamiento

```
Video/Audio → FFmpeg → WAV → Whisper (sin timestamps) → Texto plano
                                                              ↓
                                                   Concatenar todo (un solo texto)
                                                              ↓
                                                        Pre-limpieza
                                                              ↓
                                              Paso 1: Organizar transcripción (Ollama)
                                                              ↓
                                              Paso 2: Resumen ejecutivo (Ollama)
                                                              ↓
                                                      archivo_resumen.md
```

**Doble pasada LLM** — primero se organiza la transcripción por temas (elimina ruido, agrupa contexto), luego se genera el resumen ejecutivo sobre el texto ya organizado. Esto mejora significativamente la calidad del resumen.

## Configuración LLM

Soporta dos proveedores: **local (Ollama)** o **externo (OpenAI-compatible)**.

- Si `LLM_API_KEY` está definido → usa proveedor externo
- Si no → usa Ollama local

| Variable | Descripción | Default |
|----------|-------------|---------|
| `OLLAMA_MODEL` | Modelo local | `gemma4:e4b` |
| `OLLAMA_BASE_URL` | URL de Ollama | `http://localhost:11434/v1` |
| `LLM_API_KEY` | API key del proveedor externo | (vacío = local) |
| `LLM_BASE_URL` | URL del proveedor externo | `https://api.openai.com/v1` |
| `LLM_MODEL` | Modelo externo | `gpt-4o-mini` |

- **Temperatura**: 0.2 (baja para evitar alucinaciones)
- **top_p**: 0.8
- **Idioma**: ESPAÑOL obligatorio (reforzado en system + user prompt)

## Variables de Entorno

```bash
WHISPER_BIN=whisper-cli
WHISPER_MODEL=/opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin
OLLAMA_MODEL=gemma4:e4b
OLLAMA_BASE_URL=http://localhost:11434/v1
```

## Caché de Transcripciones

- Cada reunión genera su carpeta en `projects/<nombre>/transcriptions/`.
- Los archivos individuales se nombran igual que el video original (sin extensión).
- `<nombre>_completa.txt` es el texto unificado.
- **Validación por fecha de modificación**: si el video fuente fue modificado después del caché, se re-transcribe. Si no cambió, se reutiliza.
- Para forzar re-transcripción: borrar el `.txt` correspondiente.

## Benchmark

Cada ejecución genera `<nombre>_benchmark.md` con:
- Modelo de Ollama usado, temperatura, top_p
- Modelo de Whisper, binario
- Tiempo por archivo de transcripción (y si usó caché)
- Tiempo del resumen
- Métricas de texto: input crudo, input limpio, output, ratio de compresión
- Tiempo total del pipeline
- Configuración completa en JSON

## Plantilla de Prompt

Dos plantillas en `src/templates/`:

**organizeTranscription.ts** (Paso 1):
- `ORGANIZE_SYSTEM_PROMPT`: reorganiza por temas, elimina ruido, conserva detalles
- `buildOrganizeUserPrompt()`: envía la transcripción limpia para organizar

**meetingSummary.ts** (Paso 2):
- `MASTER_SUMMARY_SYSTEM_PROMPT`: prompt del resumen ejecutivo
- `buildMasterUserPrompt()`: envía el texto ya organizado para resumir
- Formato de salida: Markdown con secciones (Resumen Ejecutivo, Participantes, Temas, Decisiones, Tareas, Riesgos, Próximos Pasos)

## Convenciones de Código

- APIs nativas de Bun (`Bun.write`, `Bun.argv`, `spawnSync`)
- Cada módulo = una responsabilidad (SRP)
- Interfaces explícitas para resultados (Result pattern)
- Progress bar visual para operaciones largas
- Idioma: inglés para código, español para mensajes al usuario

## Pre-limpieza de Transcripciones

El módulo `cleanTranscription.ts` aplica 10 pasos:

1. Eliminar líneas vacías
2. Detectar y eliminar loops de repetición (bug de whisper)
3. Eliminar líneas de palabras sueltas repetidas ("Ok. Ok. Ok.")
4. Deduplicar repeticiones inline
5. Eliminar muletillas (ehh, mmm, o sea, básicamente, digamos, etc.)
6. Eliminar confirmaciones vacías (ya, dale, listo, ok, sí, no)
7. Eliminar líneas muy cortas (< 10 chars)
8. Eliminar duplicados consecutivos
9. Limpiar espacios múltiples
10. Filtro final

## Decisiones Técnicas

| Decisión | Razón |
|----------|-------|
| Doble pasada LLM | Organizar primero mejora contexto → mejor resumen |
| Sin chunks | Dividir pierde contexto, resumen sale incoherente |
| Sin timestamps | Agregan ruido al texto sin beneficio real |
| Sin selección de modo | El objetivo siempre es el resumen ejecutivo |
| Caché por sesión | Organización clara, fácil de relacionar con el resumen |
| Validación por mtime | Evita re-transcribir si el archivo no cambió |
| Temperatura 0.2 | Evita alucinaciones e invenciones |
| Sin `/no_think` | gemma4 no lo necesita, responde bien en español |

## Historial de Cambios

| Fecha | Cambio |
|-------|--------|
| 2026-05-30 | Agregado soporte para proveedor LLM externo (OpenAI-compatible). Se guarda `_organizada.txt` con el resultado del paso 1 para revisión. |
| 2026-05-30 | Implementada doble pasada LLM: paso 1 organiza transcripción por temas, paso 2 genera resumen ejecutivo. Eliminado flag `--mode` y `TemplateMode` (siempre resumen). Eliminada plantilla `meetingChronology.ts`. Creada `organizeTranscription.ts`. Benchmark ahora incluye métricas de ambos pasos. |
