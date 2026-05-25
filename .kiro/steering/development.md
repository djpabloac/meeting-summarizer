---
inclusion: always
---

# Guía de Desarrollo - Meeting Summarizer

## Runtime y Comandos

Este proyecto usa **Bun** como runtime. Todos los comandos de ejecución y desarrollo deben usar `bun`:

- Ejecutar el script principal: `bun run index.ts <ruta-del-video-o-carpeta>`
- Instalar dependencias: `bun install`
- Ejecutar TypeScript directamente (sin compilar): `bun run <archivo.ts>`

## Estructura del Proyecto

```
meeting-summarizer/
├── index.ts                    ← Entry point (delega a src/)
├── src/
│   ├── index.ts                ← Orquestador principal del pipeline
│   ├── config.ts               ← Configuración centralizada
│   ├── extractAudio.ts         ← Paso 1: Extracción de audio con FFmpeg
│   ├── transcribe.ts           ← Paso 2: Transcripción con whisper-cpp (con caché)
│   ├── summarize.ts            ← Paso 3: Resumen con Ollama
│   ├── progress.ts             ← Utilidades de progress bar y spinner
│   └── templates/
│       └── meetingSummary.ts   ← Plantilla del prompt para resúmenes
├── transcriptions/             ← Caché de transcripciones (gitignored)
├── .kiro/steering/             ← Guías de desarrollo
└── .gitignore
```

## Stack Tecnológico

- **Runtime**: Bun v1.3.14+
- **Lenguaje**: TypeScript (ESNext, modo bundler)
- **LLM Local**: Ollama con modelo `qwen3:14b` (preferido por calidad de resúmenes)
- **Transcripción**: whisper-cpp (whisper-cli)
- **Extracción de audio**: FFmpeg
- **Cliente LLM**: openai SDK (compatible con API de Ollama)

## Variables de Entorno

```bash
WHISPER_BIN=whisper-cli
WHISPER_MODEL=/opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin
OLLAMA_MODEL=qwen3:14b
OLLAMA_BASE_URL=http://localhost:11434/v1
```

## Pipeline de Procesamiento

1. **Entrada**: Archivo de video o carpeta con múltiples archivos
2. **Paso 1**: Extraer audio con FFmpeg → WAV 16kHz mono
3. **Paso 2**: Transcribir audio con whisper-cpp → texto (con caché en `transcriptions/`)
4. **Paso 3**: Resumir/analizar con Ollama (qwen3:14b) → Markdown
5. **Salida**: Un solo archivo `_resumen.md`

## Caché de Transcripciones

- Las transcripciones se guardan en `transcriptions/` para evitar reprocesar archivos ya transcritos.
- El caché usa un hash MD5 del path del archivo como identificador.
- La carpeta está en `.gitignore` para no rastrear archivos generados.

## Plantillas de Prompts

- Las plantillas de prompts están en `src/templates/`.
- Cada plantilla exporta el system prompt y una función para construir el user prompt.
- Esto permite iterar sobre los prompts sin tocar la lógica del pipeline.
- **IMPORTANTE**: El modelo qwen3:14b requiere `/no_think` al inicio del system prompt para evitar que responda en inglés.

## Convenciones de Código

- Usar APIs nativas de Bun cuando estén disponibles (`Bun.write`, `Bun.argv`, `spawnSync` de bun)
- Cada módulo en `src/` tiene una responsabilidad única
- Interfaces explícitas para resultados de cada paso (Result pattern)
- Mensajes de consola con emojis para indicar progreso
- Progress bar visual para operaciones largas
- Idioma del código: inglés para variables/funciones, español para mensajes al usuario

## Modelo LLM Recomendado

Se usa **qwen3:14b** vía Ollama por las siguientes razones:
- Mejor calidad en resúmenes largos
- Mejor manejo de contexto extenso
- Sigue instrucciones con mayor precisión
- Menos alucinaciones que modelos más pequeños

Para ejecutar: `ollama run qwen3:14b`
