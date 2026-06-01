import { spawnSync } from "bun";
import { basename } from "path";
import { CONFIG } from "./config";

export interface AudioExtractionResult {
  outputPath: string;
  success: boolean;
  error?: string;
}

export function extractAudio(videoPath: string, outputPath: string): AudioExtractionResult {
  const args = ["ffmpeg", "-y", "-i", videoPath, "-vn"];
  if (CONFIG.audioFilter) args.push("-af", CONFIG.audioFilter);
  args.push("-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", outputPath);

  const result = spawnSync(args);

  if (!result.success) {
    return {
      outputPath,
      success: false,
      error: `FFmpeg falló en ${basename(videoPath)}: ${result.stderr.toString()}`,
    };
  }

  return { outputPath, success: true };
}
