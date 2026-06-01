import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function saveLLMPayload(projectDir: string, name: string, payload: unknown): Promise<string> {
  const folder = join(projectDir, "llm_payloads");
  await mkdir(folder, { recursive: true });
  const filename = `${name}.json`;
  const filePath = join(folder, filename);
  const data = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  // Overwrite a single file (no timestamps) so we don't accumulate logs during validation
  await writeFile(filePath, data, "utf8");
  return filePath;
}

export default saveLLMPayload;
