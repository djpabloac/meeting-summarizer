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
│   ├── summarize.ts                ← Ollama (con benchmark)
│   ├── benchmark.ts                ← Generación de metadata/benchmark
│   ├── progress.ts                 ← UI de progreso
│   └── templates/
│       └── meetingSummary.ts       ← Prompt del resumen
├── projects/                       ← Salida organizada por reunión (gitignored)
│   └── Exlam/
│       ├── transcriptions/
│       │   ├── 2026-05-25 15-04-19.txt
│       │   └── Exlam_completa.txt
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
                                                   Resumen directo (Ollama)
                                                              ↓
                                                      archivo_resumen.md
```

**Sin chunks** — el texto va directo al modelo. Un solo prompt, un solo resumen coherente.

## Configuración LLM

- **Modelo**: `gemma4:e4b`
- **Temperatura**: 0.2 (baja para evitar alucinaciones)
- **top_p**: 0.8
- **Idioma**: ESPAÑOL obligatorio (reforzado en system + user prompt)
- **Sin `/no_think`** — gemma4 no lo necesita

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

En `src/templates/meetingSummary.ts`:
- `MASTER_SUMMARY_SYSTEM_PROMPT`: prompt del resumen ejecutivo
- `buildMasterUserPrompt()`: construye el mensaje del usuario con la transcripción
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
| Sin chunks | Dividir pierde contexto, resumen sale incoherente |
| Sin timestamps | Agregan ruido al texto sin beneficio real |
| Resumen directo | gemma4:e4b tiene ventana de contexto amplia |
| Caché por sesión | Organización clara, fácil de relacionar con el resumen |
| Validación por mtime | Evita re-transcribir si el archivo no cambió |
| Temperatura 0.2 | Evita alucinaciones e invenciones |
| Sin `/no_think` | gemma4 no lo necesita, responde bien en español |
