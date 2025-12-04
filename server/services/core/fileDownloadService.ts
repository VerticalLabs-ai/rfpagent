import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as dns from 'dns/promises';

/**
 * Validate URL to prevent SSRF attacks
 */
async function validateUrl(url: string): Promise<void> {
  let parsedUrl: URL;

  // Parse URL
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Only allow http and https protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Protocol not allowed: ${parsedUrl.protocol}`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Block obvious local hostnames
  const blockedHostnames = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
  if (blockedHostnames.includes(hostname)) {
    throw new Error(`Access to ${hostname} is not allowed`);
  }

  // Block private IP ranges in hostname
  const privateRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  ];
  if (privateRanges.some(regex => regex.test(hostname))) {
    throw new Error(`Access to private IP range is not allowed: ${hostname}`);
  }

  // Resolve hostname to IPs and validate
  try {
    const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
    const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);

    const allAddresses = [...addresses, ...addresses6];

    for (const ip of allAddresses) {
      // Check for loopback
      if (ip === '127.0.0.1' || ip === '::1') {
        throw new Error(`Hostname resolves to loopback address: ${ip}`);
      }

      // Check for private IPv4 ranges
      if (
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
      ) {
        throw new Error(`Hostname resolves to private IP: ${ip}`);
      }

      // Check for link-local ranges
      if (ip.startsWith('169.254.') || ip.startsWith('fe80:')) {
        throw new Error(`Hostname resolves to link-local address: ${ip}`);
      }

      // Check for unique local IPv6 (fc00::/7)
      if (ip.startsWith('fc') || ip.startsWith('fd')) {
        throw new Error(`Hostname resolves to unique local IPv6: ${ip}`);
      }
    }
  } catch (error) {
    // If DNS resolution fails, allow the request (it will fail naturally)
    // This prevents blocking legitimate domains that might have temporary DNS issues
    if (error instanceof Error && error.message.includes('resolves to')) {
      throw error; // Re-throw validation errors
    }
  }
}

/**
 * Download a file from a URL and save it to the specified path
 */
export async function downloadFile(
  url: string,
  filepath: string
): Promise<void> {
  // Validate URL before proceeding
  await validateUrl(url);

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    console.log(`⬇️ Downloading from: ${url}`);
    console.log(`💾 Saving to: ${filepath}`);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        // Log but don't throw - directory might already exist from race condition
        if ((error as any).code !== 'EEXIST') {
          console.error(
            'Failed to create directory:',
            dir,
            (error as Error).message
          );
          throw error; // Re-throw if it's not EEXIST
        }
      }
    }

    // Download the file with timeout
    const response = await fetch(url, { signal: controller.signal });

    // Clear timeout after successful fetch
    clearTimeout(timeoutId);

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
    // Clear timeout on error
    clearTimeout(timeoutId);

    // Check if error is due to abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`❌ Download timed out for ${url}`);
      throw new Error(`Download timed out after 30 seconds: ${url}`);
    }

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
