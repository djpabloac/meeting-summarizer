import type { QaFeature } from "./qaExtraction";

const PENDING = "_[Completar]_";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "feature";
}

/**
 * Renderiza un feature en el documento de evidencias de QA (plantilla de 7 puntos).
 * Solo los puntos 1-4 y la enumeración del 5 salen de la reunión; las evidencias
 * (imágenes), observaciones (6) y hallazgos (7) se completan tras ejecutar las pruebas.
 */
export function renderQaDocument(f: QaFeature): string {
  const lines: string[] = [];

  lines.push(`# 1. ${f.titulo || "[Título del feature a validar]"}`, "");

  lines.push("## 2. Objetivo", f.objetivo || PENDING, "");

  lines.push("## 3. Alcance", f.alcance || PENDING, "");

  lines.push("## 4. Pre-condición");
  if (f.precondiciones?.length) {
    for (const p of f.precondiciones) lines.push(`- ${p}`);
  } else {
    lines.push("_[Completar: información inicial necesaria para ejecutar las evidencias]_");
  }
  lines.push("");

  lines.push("## 5. Evidencias de Casos");
  if (f.casos?.length) {
    f.casos.forEach((c, i) => {
      lines.push(`### 5.${i + 1} ${c}`, "_[Insertar evidencia]_", "");
    });
  } else {
    lines.push("_[Completar: enumerar casos y adjuntar evidencias]_", "");
  }

  lines.push("## 6. Observaciones");
  lines.push("### 6.1 Funcionales", "_[Completar tras la ejecución de pruebas]_", "");
  lines.push("### 6.2 No funcionales", "_[Completar tras la ejecución de pruebas]_", "");

  lines.push("## 7. Resumen Final", "_[Completar: solo hallazgos, sin imágenes]_", "");

  if (f.origen) {
    lines.push("---", `> Origen (reunión): ${f.origen}`);
  }

  return lines.join("\n");
}
