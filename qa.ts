import { existsSync, readFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { extractQaFeatures } from "./src/qa/qaExtraction";
import { renderQaDocument, slugify } from "./src/qa/qaDocument";
import { createSpinner } from "./src/progress";
import { getLLMConfig } from "./src/config";

const PROJECTS_DIR = join(import.meta.dir, "projects");

// Acepta el nombre de la sesión ("Exlam") o la ruta al proyecto ("projects/Exlam")
function resolveProjectDir(input: string): string {
  if (existsSync(input)) return input;
  const underProjects = join(PROJECTS_DIR, input);
  if (existsSync(underProjects)) return underProjects;
  console.error(`❌ Proyecto no encontrado: ${input}`);
  console.error("   Corre primero el pipeline (bun run index.ts <ruta>) para generar la transcripción y los hechos.");
  process.exit(1);
}

const input = Bun.argv.slice(2).join(" ");
if (!input) {
  console.error("❌ Uso: bun run qa.ts <nombre-de-sesión o ruta-del-proyecto>");
  process.exit(1);
}

const projectDir = resolveProjectDir(input);
const sessionName = basename(projectDir);

const hechosFile = join(projectDir, `${sessionName}_extraction.md`);
if (!existsSync(hechosFile)) {
  console.error(`❌ No se encontraron los hechos: ${hechosFile}`);
  console.error("   Corre primero el pipeline para generar <sesión>_extraction.md");
  process.exit(1);
}
const hechosJson = readFileSync(hechosFile, "utf-8");

// Opcional: pasar la transcripción completa como contexto para precondiciones (QA_USE_TRANSCRIPT=1)
let transcript: string | undefined;
if (process.env.QA_USE_TRANSCRIPT === "1") {
  const transcriptFile = join(projectDir, "transcriptions", `${sessionName}_completa.txt`);
  if (existsSync(transcriptFile)) transcript = readFileSync(transcriptFile, "utf-8");
}

const llm = getLLMConfig();
console.log(`\n🧪 QA: generando documentos de evidencias para "${sessionName}" con ${llm.model}`);
if (transcript) console.log("   (usando transcripción completa como contexto adicional)");

const spinner = createSpinner("Extrayendo features a validar...");
const result = await extractQaFeatures(hechosJson, projectDir, sessionName, transcript);
if (!result.success) {
  spinner.stop(`❌ ${result.error}`);
  process.exit(1);
}
spinner.stop(`✅ ${result.features.length} feature(s) identificado(s) (${Math.round(result.durationMs / 1000)}s)`);

const qaDir = join(projectDir, "qa");
if (!existsSync(qaDir)) mkdirSync(qaDir, { recursive: true });

for (const feature of result.features) {
  const md = renderQaDocument(feature);
  const outFile = join(qaDir, `${slugify(feature.titulo)}_qa.md`);
  await Bun.write(outFile, md);
  console.log(`   📄 ${basename(outFile)}`);
}

console.log(`\n✅ Documentos QA en: projects/${sessionName}/qa/`);
