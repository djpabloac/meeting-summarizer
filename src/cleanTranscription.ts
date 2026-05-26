/**
 * Pre-limpieza de transcripción antes de enviar al LLM.
 * Elimina ruido, muletillas, repeticiones y líneas vacías.
 * 
 * Patrones detectados en transcripciones reales:
 * - Repeticiones masivas de frases (whisper loop)
 * - Muletillas en español e inglés
 * - Líneas muy cortas sin valor
 * - Palabras sueltas repetidas (No. No. No.)
 * - Fragmentos cortados por error de transcripción
 */

// Muletillas y palabras de relleno (español + inglés)
const FILLER_WORDS = [
  // Español - muletillas comunes
  "ehh", "ehhh", "eh", "mmm", "mhm", "ajá", "aja", "ahá",
  "este", "pues", "o sea", "bueno bueno", "digamos",
  "básicamente", "justamente", "obviamente", "realmente",
  "de repente", "en teoría", "en este caso",
  // Inglés
  "you know", "like", "so", "well", "right", "uh", "uhh", "umm", "um",
  // Confirmaciones vacías repetidas
  "ya ya", "dale dale", "ok ok", "sí sí", "no no",
  "listo listo", "claro claro", "ajá ajá",
];

// Frases que son puro ruido cuando aparecen solas
const NOISE_PHRASES = [
  "ya", "dale", "listo", "ok", "ajá", "aja", "claro",
  "sí", "no", "bueno", "correcto", "exacto", "exactamente",
  "ah", "oh", "eh", "mmm", "este", "a ver",
  "¿no?", "¿no es cierto?", "¿verdad?", "¿correcto?",
  "¿cómo?", "¿qué?", "¿sí?",
];

const FILLER_REGEX = new RegExp(
  `\\b(${FILLER_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})\\b`,
  "gi"
);

/**
 * Detecta si una línea es una repetición masiva (whisper loop).
 * Ejemplo: "no te afecta en nada. no te afecta en nada. no te afecta en nada."
 */
function isRepetitionLoop(line: string): boolean {
  const words = line.split(/\s+/);
  if (words.length < 8) return false;

  // Buscar patrones repetidos de 3-8 palabras
  for (let patternLen = 3; patternLen <= 8; patternLen++) {
    const pattern = words.slice(0, patternLen).join(" ").toLowerCase();
    if (pattern.length < 5) continue;

    let count = 0;
    const lowerLine = line.toLowerCase();
    let pos = 0;
    while ((pos = lowerLine.indexOf(pattern, pos)) !== -1) {
      count++;
      pos += pattern.length;
    }

    // Si el patrón se repite 3+ veces, es un loop
    if (count >= 3) return true;
  }

  return false;
}

/**
 * Detecta líneas que son solo palabras sueltas repetidas.
 * Ejemplo: "Ok. Ok. Ok. Ok. Ok." o "No. No. No. No."
 */
function isSingleWordRepetition(line: string): boolean {
  // Limpiar puntuación y dividir
  const cleaned = line.replace(/[.,!?;:]/g, "").trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);

  if (words.length < 3) return false;

  // Contar palabra más frecuente
  const freq = new Map<string, number>();
  for (const w of words) {
    const lower = w.toLowerCase();
    freq.set(lower, (freq.get(lower) || 0) + 1);
  }

  const maxFreq = Math.max(...freq.values());
  // Si una palabra ocupa más del 60% de la línea, es repetición
  return maxFreq / words.length > 0.6;
}

/**
 * Elimina repeticiones consecutivas de frases dentro de una línea.
 * "que contenedores que contenedores que contenedores" → "que contenedores"
 */
function deduplicateWithinLine(line: string): string {
  // Buscar patrones de 2-6 palabras que se repiten consecutivamente
  let result = line;

  for (let patternLen = 2; patternLen <= 6; patternLen++) {
    const regex = new RegExp(
      `((?:\\S+\\s+){${patternLen - 1}}\\S+)(?:\\s+\\1){2,}`,
      "gi"
    );
    result = result.replace(regex, "$1");
  }

  return result;
}

/**
 * Verifica si una línea es solo una frase de ruido (confirmación vacía).
 */
function isNoiseLine(line: string): boolean {
  const trimmed = line.trim().toLowerCase().replace(/[.,!?¿¡;:]/g, "").trim();
  return NOISE_PHRASES.includes(trimmed);
}

export function cleanTranscription(text: string): string {
  let lines = text.split("\n");

  // 1. Eliminar líneas vacías
  lines = lines.filter((line) => line.trim().length > 0);

  // 2. Eliminar loops de repetición (whisper bug)
  lines = lines.filter((line) => !isRepetitionLoop(line));

  // 3. Eliminar líneas de palabras sueltas repetidas (Ok. Ok. Ok.)
  lines = lines.filter((line) => !isSingleWordRepetition(line));

  // 4. Deduplicar repeticiones dentro de cada línea
  lines = lines.map((line) => deduplicateWithinLine(line));

  // 5. Eliminar muletillas
  lines = lines.map((line) =>
    line.replace(FILLER_REGEX, "").replace(/\s{2,}/g, " ").trim()
  );

  // 6. Eliminar líneas que son solo ruido/confirmaciones
  lines = lines.filter((line) => !isNoiseLine(line));

  // 7. Eliminar líneas muy cortas (< 10 chars) que suelen ser ruido
  lines = lines.filter((line) => line.trim().length >= 10);

  // 8. Eliminar duplicados consecutivos
  lines = lines.filter((line, i) => i === 0 || line.toLowerCase() !== lines[i - 1]?.toLowerCase());

  // 9. Limpiar espacios múltiples finales
  lines = lines.map((line) => line.replace(/\s{2,}/g, " ").trim());

  // 10. Filtrar líneas que quedaron vacías después de toda la limpieza
  lines = lines.filter((line) => line.trim().length >= 10);

  return lines.join("\n");
}
