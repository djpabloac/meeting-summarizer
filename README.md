# Meeting Summarizer

Herramienta local para transcribir y resumir reuniones a partir de archivos de video o audio, usando modelos de IA locales (Ollama + Whisper).

## Uso Actual

```bash
bun run index.ts <ruta-del-video-o-carpeta>
```

## Requisitos

- [Bun](https://bun.com) v1.3.14+
- [FFmpeg](https://ffmpeg.org/) — `brew install ffmpeg`
- [Ollama](https://ollama.ai/) — `brew install ollama`
- [Whisper C++](https://github.com/ggerganov/whisper.cpp) — `brew install whisper-cpp`

## Variables de Entorno

```bash
WHISPER_BIN=whisper-cli
WHISPER_MODEL=/opt/homebrew/share/whisper-cpp/ggml-large-v3-turbo.bin
OLLAMA_MODEL=gemma4:e4b
OLLAMA_BASE_URL=http://localhost:11434/v1
```

---

## Roadmap

### Fase 1 — Script CLI (actual) ✅ En progreso

Estructurar el pipeline y encontrar un modelo local que genere resúmenes de calidad.

- [x] Pipeline: video → audio (FFmpeg) → transcripción (Whisper) → resumen (Ollama)
- [x] Soporte para carpetas con múltiples archivos de una misma reunión
- [x] Caché de transcripciones organizado por sesión (evita reprocesar)
- [x] Pre-limpieza de transcripción (eliminar ruido de whisper)
- [x] Prompt optimizado para resúmenes en español
- [x] Progress bar y spinners para feedback visual
- [x] Evaluar modelos: gemma4:e4b, qwen3:14b, mistral-small
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
├── index.ts                        ← Entry point
├── src/
│   ├── index.ts                    ← Orquestador del pipeline
│   ├── config.ts                   ← Configuración
│   ├── extractAudio.ts             ← FFmpeg
│   ├── transcribe.ts               ← Whisper (con caché)
│   ├── cleanTranscription.ts       ← Limpieza de ruido
│   ├── summarize.ts                ← Ollama
│   ├── progress.ts                 ← UI de progreso
│   └── templates/
│       └── meetingSummary.ts       ← Prompt del resumen
├── transcriptions/                 ← Caché por sesión (gitignored)
├── .kiro/steering/                 ← Guías de desarrollo
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
