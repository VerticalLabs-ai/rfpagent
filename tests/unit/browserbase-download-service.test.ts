import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import {
  BrowserbaseDownloadService,
  DownloadResult,
} from '../../server/services/downloads/browserbaseDownloadService';
import AdmZip from 'adm-zip';

// Create a valid ZIP buffer before mocking
let testZipBuffer: Buffer;

beforeAll(() => {
  // Create a real ZIP file with a test file
  const zip = new AdmZip();
  zip.addFile(
    'test-file-1719265797164.pdf',
    Buffer.from('PDF content here'),
    'Test file',
  );
  testZipBuffer = zip.toBuffer();
});

// Mock the Browserbase SDK
jest.mock('@browserbasehq/sdk', () => {
  const mockList = jest.fn();

  return {
    Browserbase: jest.fn().mockImplementation(() => ({
      sessions: {
        downloads: {
          list: mockList,
        },
      },
    })),
    __mockList: mockList,
  };
});

describe('BrowserbaseDownloadService', () => {
  let service: BrowserbaseDownloadService;

  beforeEach(() => {
    // Reset and reconfigure the mock
    const { Browserbase } = require('@browserbasehq/sdk');
    Browserbase.mockClear();
    Browserbase.mockImplementation(() => ({
      sessions: {
        downloads: {
          list: jest.fn().mockResolvedValue({
            arrayBuffer: () => Promise.resolve(testZipBuffer.buffer),
          }),
        },
      },
    }));

    service = new BrowserbaseDownloadService();
  });

  describe('retrieveDownloads', () => {
    it('should retrieve downloads from a Browserbase session', async () => {
      const result = await service.retrieveDownloads('test-session-id', 30);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      expect(result.files.length).toBeGreaterThan(0);

      // Verify file structure
      const file = result.files[0];
      expect(file.name).toBe('test-file-1719265797164.pdf');
      expect(file.originalName).toBe('test-file.pdf'); // Timestamp removed
      expect(file.mimeType).toBe('application/pdf');
      expect(file.size).toBeGreaterThan(0);
      expect(file.buffer).toBeInstanceOf(Buffer);
    });

    it('should return empty files array when no downloads available', async () => {
      // Mock empty download (22 bytes = empty ZIP)
      const { Browserbase } = require('@browserbasehq/sdk');
      Browserbase.mockImplementation(() => ({
        sessions: {
          downloads: {
            list: jest.fn().mockResolvedValue({
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(22)),
            }),
          },
        },
      }));

      const newService = new BrowserbaseDownloadService();
      const result = await newService.retrieveDownloads('test-session-id', 5);

      expect(result.success).toBe(false);
      expect(result.files).toEqual([]);
    });
  });
});
