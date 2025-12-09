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

  describe('verifyFileSize', () => {
    it('should return true when file size matches expected within tolerance', () => {
      const result = service.verifyFileSize(279930, 279930, 0.05); // exact match
      expect(result.valid).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should return true when file size is within tolerance', () => {
      const expectedBytes = 279930; // ~279.93 KB
      const actualBytes = 280000; // slightly larger
      const result = service.verifyFileSize(actualBytes, expectedBytes, 0.05);
      expect(result.valid).toBe(true);
    });

    it('should return false when file size difference exceeds tolerance', () => {
      const expectedBytes = 279930;
      const actualBytes = 100000; // much smaller
      const result = service.verifyFileSize(actualBytes, expectedBytes, 0.05);
      expect(result.valid).toBe(false);
      expect(result.difference).toBeLessThan(0);
    });

    it('should handle zero expected size', () => {
      const result = service.verifyFileSize(1000, 0, 0.05);
      expect(result.valid).toBe(false);
    });

    it('should verify actual document sizes match expected', () => {
      // Test with actual expected sizes from the plan
      const doc1Result = service.verifyFileSize(286649, 286649, 0.05); // 36C24726R0007 Relocation Services 1225.docx
      expect(doc1Result.valid).toBe(true);
      expect(doc1Result.actualSize).toBe(286649);
      expect(doc1Result.expectedSize).toBe(286649);

      const doc2Result = service.verifyFileSize(14303, 14303, 0.05); // 36C24726R0007_1.docx
      expect(doc2Result.valid).toBe(true);
      expect(doc2Result.actualSize).toBe(14303);
      expect(doc2Result.expectedSize).toBe(14303);
    });

    it('should detect file size within 5% tolerance', () => {
      const expectedBytes = 100000;
      const withinTolerance = 104999; // 4.999% larger
      const exceedsTolerance = 105001; // 5.001% larger

      const validResult = service.verifyFileSize(withinTolerance, expectedBytes, 0.05);
      expect(validResult.valid).toBe(true);

      const invalidResult = service.verifyFileSize(exceedsTolerance, expectedBytes, 0.05);
      expect(invalidResult.valid).toBe(false);
    });
  });
});
