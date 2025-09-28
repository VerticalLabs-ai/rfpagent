import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * Download a file from a URL and save it to the specified path
 */
export async function downloadFile(
  url: string,
  filepath: string
): Promise<void> {
  try {
    console.log(`⬇️ Downloading from: ${url}`);
    console.log(`💾 Saving to: ${filepath}`);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Download the file
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to download: ${response.status} ${response.statusText}`
      );
    }

    // Convert web stream to Node.js stream
    const nodeStream = Readable.fromWeb(response.body as any);

    // Create write stream
    const fileStream = fs.createWriteStream(filepath);

    // Pipe the response to the file
    await pipeline(nodeStream, fileStream);

    console.log(`✅ Downloaded successfully: ${path.basename(filepath)}`);
  } catch (error) {
    console.error(`❌ Download failed for ${url}:`, error);
    throw error;
  }
}

/**
 * Download multiple files
 */
export async function downloadFiles(
  files: Array<{ url: string; filepath: string }>
): Promise<{
  successful: string[];
  failed: Array<{ url: string; error: string }>;
}> {
  const successful: string[] = [];
  const failed: Array<{ url: string; error: string }> = [];

  for (const file of files) {
    try {
      await downloadFile(file.url, file.filepath);
      successful.push(file.filepath);
    } catch (error) {
      failed.push({
        url: file.url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { successful, failed };
}

/**
 * Get file size
 */
export function getFileSize(filepath: string): number {
  try {
    const stats = fs.statSync(filepath);
    return stats.size;
  } catch (error) {
    console.error(`Failed to get file size for ${filepath}:`, error);
    return 0;
  }
}

/**
 * Clean up old downloads
 */
export async function cleanupOldDownloads(
  directory: string,
  daysOld: number = 30
): Promise<void> {
  try {
    const files = fs.readdirSync(directory);
    const now = Date.now();
    const cutoff = daysOld * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filepath = path.join(directory, file);
      const stats = fs.statSync(filepath);

      if (now - stats.mtimeMs > cutoff) {
        fs.unlinkSync(filepath);
        console.log(`🗑️ Deleted old file: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up old downloads:', error);
  }
}
