import { spawnSync } from "bun";
import { basename } from "path";

export interface AudioExtractionResult {
  outputPath: string;
  success: boolean;
  error?: string;
}

export function extractAudio(videoPath: string, outputPath: string): AudioExtractionResult {
  const result = spawnSync([
    "ffmpeg", "-y", "-i", videoPath,
    "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", outputPath,
  ]);

  if (!result.success) {
    return {
      outputPath,
      success: false,
      error: `FFmpeg falló en ${basename(videoPath)}: ${result.stderr.toString()}`,
    };
  }

  return { outputPath, success: true };
}
