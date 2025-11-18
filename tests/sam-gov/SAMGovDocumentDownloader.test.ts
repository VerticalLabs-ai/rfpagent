import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SAMGovDocumentDownloader } from '../../server/services/scrapers/samGovDocumentDownloader';
import axios from 'axios';
import { storage } from '../../server/storage';
import {
  mockOpportunityDetailsResponse,
  mockAttachmentsResponse,
} from '../fixtures/sam-gov/api-responses';

// Mock dependencies
jest.mock('axios');
jest.mock('../../server/storage');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedStorage = storage as jest.Mocked<typeof storage>;

describe('SAMGovDocumentDownloader', () => {
  let downloader: SAMGovDocumentDownloader;
  const mockNoticeId = 'abc123def456';
  const mockRfpId = 'rfp-test-123';
  const mockApiKey = 'test-api-key-12345';

  beforeEach(() => {
    downloader = new SAMGovDocumentDownloader();
    jest.clearAllMocks();

    // Setup environment
    process.env.SAM_GOV_API_KEY = mockApiKey;
  });

  afterEach(() => {
    delete process.env.SAM_GOV_API_KEY;
  });

  describe('downloadRFPDocuments()', () => {
    it('should successfully download all documents for an RFP', async () => {
      // Arrange
      mockedAxios.get
        // Call 1: Get opportunity details
        .mockResolvedValueOnce({
          data: mockOpportunityDetailsResponse,
          status: 200,
        })
        // Call 2-4: Download each document (3 files)
        .mockResolvedValueOnce({
          data: Buffer.from('PDF content'),
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-length': '524288',
          },
        })
        .mockResolvedValueOnce({
          data: Buffer.from('Excel content'),
          status: 200,
          headers: {
            'content-type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'content-length': '102400',
          },
        })
        .mockResolvedValueOnce({
          data: Buffer.from('Word content'),
          status: 200,
          headers: {
            'content-type':
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'content-length': '204800',
          },
        });

      mockedStorage.uploadFile.mockResolvedValue({
        path: `rfps/${mockRfpId}/test-doc.pdf`,
        url: 'https://storage.example.com/test-doc.pdf',
      });

      mockedStorage.createDocument.mockResolvedValue({
        id: 'doc-1',
        rfpId: mockRfpId,
        filename: 'test-doc.pdf',
        fileType: 'pdf',
        objectPath: `rfps/${mockRfpId}/test-doc.pdf`,
        createdAt: new Date(),
        extractedText: null,
        parsedData: null,
      });

      // Act
      const result = await downloader.downloadRFPDocuments(
        mockNoticeId,
        mockRfpId,
        mockApiKey
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        filename: 'SOW_RFP-2025-001.pdf',
        fileType: 'pdf',
      });
      expect(result[1]).toMatchObject({
        filename: 'Pricing_Template.xlsx',
        fileType: 'excel',
      });
      expect(result[2]).toMatchObject({
        filename: 'Requirements_Matrix.docx',
        fileType: 'doc',
      });

      // Verify API calls
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // 1 details + 3 downloads
      expect(mockedStorage.uploadFile).toHaveBeenCalledTimes(3);
      expect(mockedStorage.createDocument).toHaveBeenCalledTimes(3);
    });

    it('should use environment API key when not provided', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          ...mockOpportunityDetailsResponse,
          attachments: [],
        },
        status: 200,
      });

      // Act
      await downloader.downloadRFPDocuments(mockNoticeId, mockRfpId);

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(mockNoticeId),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': mockApiKey,
          }),
        })
      );
    });

    it('should handle RFP with no attachments', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          ...mockOpportunityDetailsResponse,
          attachments: [],
        },
        status: 200,
      });

      // Act
      const result = await downloader.downloadRFPDocuments(
        mockNoticeId,
        mockRfpId,
        mockApiKey
      );

      // Assert
      expect(result).toHaveLength(0);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Only details call
      expect(mockedStorage.uploadFile).not.toHaveBeenCalled();
    });

    it('should throw error when API key is missing', async () => {
      // Arrange
      delete process.env.SAM_GOV_API_KEY;

      // Act & Assert
      await expect(
        downloader.downloadRFPDocuments(mockNoticeId, mockRfpId)
      ).rejects.toThrow('SAM.gov API key not configured');

      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should handle document download failures gracefully', async () => {
      // Arrange
      mockedAxios.get
        .mockResolvedValueOnce({
          data: mockOpportunityDetailsResponse,
          status: 200,
        })
        // First document succeeds
        .mockResolvedValueOnce({
          data: Buffer.from('PDF content'),
          status: 200,
          headers: {
            'content-type': 'application/pdf',
          },
        })
        // Second document fails
        .mockRejectedValueOnce(new Error('Network error'))
        // Third document succeeds
        .mockResolvedValueOnce({
          data: Buffer.from('Word content'),
          status: 200,
          headers: {
            'content-type':
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        });

      mockedStorage.uploadFile.mockResolvedValue({
        path: `rfps/${mockRfpId}/test.pdf`,
        url: 'https://storage.example.com/test.pdf',
      });

      mockedStorage.createDocument.mockResolvedValue({
        id: 'doc-1',
        rfpId: mockRfpId,
        filename: 'test.pdf',
        fileType: 'pdf',
        objectPath: `rfps/${mockRfpId}/test.pdf`,
        createdAt: new Date(),
        extractedText: null,
        parsedData: null,
      });

      // Act
      const result = await downloader.downloadRFPDocuments(
        mockNoticeId,
        mockRfpId,
        mockApiKey
      );

      // Assert
      expect(result).toHaveLength(2); // Only successful downloads
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // 1 details + 3 attempts
    });

    it('should retry failed uploads before giving up', async () => {
      // Arrange
      const mockDoc = mockOpportunityDetailsResponse.attachments[0];

      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            ...mockOpportunityDetailsResponse,
            attachments: [mockDoc],
          },
          status: 200,
        })
        .mockResolvedValueOnce({
          data: Buffer.from('PDF content'),
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        });

      // First upload fails, second succeeds
      mockedStorage.uploadFile
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValueOnce({
          path: `rfps/${mockRfpId}/test.pdf`,
          url: 'https://storage.example.com/test.pdf',
        });

      mockedStorage.createDocument.mockResolvedValue({
        id: 'doc-1',
        rfpId: mockRfpId,
        filename: 'test.pdf',
        fileType: 'pdf',
        objectPath: `rfps/${mockRfpId}/test.pdf`,
        createdAt: new Date(),
        extractedText: null,
        parsedData: null,
      });

      // Act
      const result = await downloader.downloadRFPDocuments(
        mockNoticeId,
        mockRfpId,
        mockApiKey
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(mockedStorage.uploadFile).toHaveBeenCalledTimes(2); // Retry once
    });
  });

  describe('getOpportunityAttachments()', () => {
    it('should fetch attachments from opportunity details', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValueOnce({
        data: mockOpportunityDetailsResponse,
        status: 200,
      });

      // Act
      const attachments =
        await downloader['getOpportunityAttachments'](mockNoticeId, mockApiKey);

      // Assert
      expect(attachments).toHaveLength(2);
      expect(attachments[0]).toMatchObject({
        name: 'SOW_RFP-2025-001.pdf',
        url: expect.stringContaining('download'),
        fileType: 'pdf',
      });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/opportunities/${mockNoticeId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Api-Key': mockApiKey,
          }),
        })
      );
    });

    it('should handle API errors when fetching attachments', async () => {
      // Arrange
      mockedAxios.get.mockRejectedValueOnce(
        new Error('Opportunity not found')
      );

      // Act & Assert
      await expect(
        downloader['getOpportunityAttachments'](mockNoticeId, mockApiKey)
      ).rejects.toThrow('Opportunity not found');
    });
  });

  describe('downloadFile()', () => {
    it('should download file with correct headers and response type', async () => {
      // Arrange
      const fileUrl = 'https://sam.gov/download/test.pdf';
      const mockBuffer = Buffer.from('test content');

      mockedAxios.get.mockResolvedValueOnce({
        data: mockBuffer,
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      });

      // Act
      const result = await downloader['downloadFile'](fileUrl, mockApiKey);

      // Assert
      expect(result).toEqual(mockBuffer);
      expect(mockedAxios.get).toHaveBeenCalledWith(fileUrl, {
        responseType: 'arraybuffer',
        headers: {
          'X-Api-Key': mockApiKey,
          'User-Agent': 'RFP-Agent/1.0',
        },
        timeout: 60000,
      });
    });
  });

  describe('inferMimeType()', () => {
    it('should correctly infer MIME types from file extensions', () => {
      expect(downloader['inferMimeType']('document.pdf')).toBe(
        'application/pdf'
      );
      expect(downloader['inferMimeType']('spreadsheet.xlsx')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(downloader['inferMimeType']('text.docx')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(downloader['inferMimeType']('data.xls')).toBe(
        'application/vnd.ms-excel'
      );
      expect(downloader['inferMimeType']('old.doc')).toBe(
        'application/msword'
      );
      expect(downloader['inferMimeType']('unknown.xyz')).toBe(
        'application/octet-stream'
      );
    });

    it('should handle filenames with multiple dots', () => {
      expect(downloader['inferMimeType']('my.file.name.pdf')).toBe(
        'application/pdf'
      );
    });

    it('should handle uppercase extensions', () => {
      expect(downloader['inferMimeType']('DOCUMENT.PDF')).toBe(
        'application/pdf'
      );
    });
  });

  describe('verifyFileExists()', () => {
    it('should return true when file exists in storage', async () => {
      // Arrange
      const storagePath = `rfps/${mockRfpId}/test.pdf`;
      mockedStorage.fileExists.mockResolvedValueOnce(true);

      // Act
      const exists = await downloader['verifyFileExists'](storagePath);

      // Assert
      expect(exists).toBe(true);
      expect(mockedStorage.fileExists).toHaveBeenCalledWith(storagePath);
    });

    it('should return false when file does not exist', async () => {
      // Arrange
      const storagePath = `rfps/${mockRfpId}/missing.pdf`;
      mockedStorage.fileExists.mockResolvedValueOnce(false);

      // Act
      const exists = await downloader['verifyFileExists'](storagePath);

      // Assert
      expect(exists).toBe(false);
    });
  });
});
