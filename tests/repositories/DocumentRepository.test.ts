import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Document, InsertDocument } from '@shared/schema';

// Mock the database module
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
};

jest.mock('../../server/db', () => ({
  db: mockDb,
}));

import { DocumentRepository } from '../../server/repositories/DocumentRepository';
import { documents } from '@shared/schema';

describe('DocumentRepository', () => {
  let repository: DocumentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DocumentRepository();
  });

  describe('getDocument', () => {
    it('should retrieve a document by ID', async () => {
      const mockDocument: Partial<Document> = {
        id: 'doc-123',
        rfpId: 'rfp-456',
        type: 'proposal',
        filename: 'proposal.pdf',
        url: 'https://storage.example.com/proposal.pdf',
        uploadedBy: 'user-789',
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockDocument]);

      const result = await repository.getDocument('doc-123');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(documents);
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(mockDocument);
    });

    it('should return undefined if document not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      const result = await repository.getDocument('nonexistent-id');

      expect(result).toBeUndefined();
    });

    it('should handle documents with all optional fields', async () => {
      const mockDocument: Partial<Document> = {
        id: 'doc-123',
        rfpId: 'rfp-456',
        type: 'proposal',
        filename: 'proposal.pdf',
        url: 'https://storage.example.com/proposal.pdf',
        size: 1024000,
        mimeType: 'application/pdf',
        uploadedBy: 'user-789',
        metadata: {
          pageCount: 25,
          checksum: 'abc123',
        },
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([mockDocument]);

      const result = await repository.getDocument('doc-123');

      expect(result?.size).toBe(1024000);
      expect(result?.metadata).toEqual(mockDocument.metadata);
    });
  });

  describe('getDocumentsByRFP', () => {
    it('should retrieve all documents for an RFP', async () => {
      const mockDocuments: Partial<Document>[] = [
        {
          id: 'doc-1',
          rfpId: 'rfp-456',
          type: 'proposal',
          filename: 'proposal.pdf',
          url: 'https://storage.example.com/proposal.pdf',
          uploadedBy: 'user-789',
          createdAt: new Date(),
        },
        {
          id: 'doc-2',
          rfpId: 'rfp-456',
          type: 'supporting_doc',
          filename: 'resume.pdf',
          url: 'https://storage.example.com/resume.pdf',
          uploadedBy: 'user-789',
          createdAt: new Date(),
        },
      ];

      mockDb.returning.mockResolvedValueOnce(mockDocuments);

      const result = await repository.getDocumentsByRFP('rfp-456');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(documents);
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result).toEqual(mockDocuments);
    });

    it('should return empty array if no documents found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      const result = await repository.getDocumentsByRFP('rfp-nonexistent');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle RFPs with many documents', async () => {
      const mockDocuments = Array.from({ length: 10 }, (_, i) => ({
        id: `doc-${i}`,
        rfpId: 'rfp-456',
        type: 'supporting_doc',
        filename: `document-${i}.pdf`,
        url: `https://storage.example.com/document-${i}.pdf`,
        uploadedBy: 'user-789',
        createdAt: new Date(),
      }));

      mockDb.returning.mockResolvedValueOnce(mockDocuments);

      const result = await repository.getDocumentsByRFP('rfp-456');

      expect(result).toHaveLength(10);
    });
  });

  describe('createDocument', () => {
    it('should create a new document', async () => {
      const newDocument: InsertDocument = {
        rfpId: 'rfp-789',
        type: 'proposal',
        filename: 'new-proposal.pdf',
        url: 'https://storage.example.com/new-proposal.pdf',
        uploadedBy: 'user-123',
      };

      const createdDocument: Partial<Document> = {
        id: 'doc-new',
        ...newDocument,
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdDocument]);

      const result = await repository.createDocument(newDocument);

      expect(mockDb.insert).toHaveBeenCalledWith(documents);
      expect(mockDb.values).toHaveBeenCalledWith(newDocument);
      expect(mockDb.returning).toHaveBeenCalled();
      expect(result).toEqual(createdDocument);
    });

    it('should create document with file metadata', async () => {
      const newDocument: InsertDocument = {
        rfpId: 'rfp-789',
        type: 'proposal',
        filename: 'proposal-with-metadata.pdf',
        url: 'https://storage.example.com/proposal-with-metadata.pdf',
        size: 2048000,
        mimeType: 'application/pdf',
        uploadedBy: 'user-123',
        metadata: {
          pageCount: 50,
          checksum: 'def456',
          version: '1.0',
        },
      };

      const createdDocument: Partial<Document> = {
        id: 'doc-new',
        ...newDocument,
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdDocument]);

      const result = await repository.createDocument(newDocument);

      expect(result.size).toBe(2048000);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.metadata).toEqual(newDocument.metadata);
    });

    it('should handle different document types', async () => {
      const documentTypes = [
        'proposal',
        'supporting_doc',
        'certification',
        'reference',
      ];

      for (const type of documentTypes) {
        jest.clearAllMocks();

        const newDocument: InsertDocument = {
          rfpId: 'rfp-789',
          type: type as any,
          filename: `${type}.pdf`,
          url: `https://storage.example.com/${type}.pdf`,
          uploadedBy: 'user-123',
        };

        const createdDocument: Partial<Document> = {
          id: `doc-${type}`,
          ...newDocument,
          createdAt: new Date(),
        };

        mockDb.returning.mockResolvedValueOnce([createdDocument]);

        const result = await repository.createDocument(newDocument);

        expect(result.type).toBe(type);
      }
    });

    it('should create document with minimal required fields', async () => {
      const newDocument: InsertDocument = {
        rfpId: 'rfp-789',
        type: 'proposal',
        filename: 'minimal.pdf',
        url: 'https://storage.example.com/minimal.pdf',
        uploadedBy: 'user-123',
      };

      const createdDocument: Partial<Document> = {
        id: 'doc-minimal',
        ...newDocument,
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdDocument]);

      const result = await repository.createDocument(newDocument);

      expect(result.filename).toBe('minimal.pdf');
      expect(result.size).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });
  });

  describe('updateDocument', () => {
    it('should update a document', async () => {
      const documentId = 'doc-123';
      const updates: Partial<Document> = {
        filename: 'updated-filename.pdf',
        metadata: {
          version: '2.0',
          lastModified: new Date().toISOString(),
        },
      };

      const updatedDocument: Partial<Document> = {
        id: documentId,
        rfpId: 'rfp-456',
        type: 'proposal',
        url: 'https://storage.example.com/proposal.pdf',
        uploadedBy: 'user-789',
        ...updates,
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([updatedDocument]);

      const result = await repository.updateDocument(documentId, updates);

      expect(mockDb.update).toHaveBeenCalledWith(documents);
      expect(mockDb.set).toHaveBeenCalledWith(updates);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
      expect(result.filename).toBe('updated-filename.pdf');
      expect(result.metadata).toEqual(updates.metadata);
    });

    it('should update document metadata', async () => {
      const documentId = 'doc-123';
      const updates: Partial<Document> = {
        metadata: {
          status: 'processed',
          extractedText: 'Sample extracted text',
          thumbnailUrl: 'https://storage.example.com/thumb.jpg',
        },
      };

      const updatedDocument: Partial<Document> = {
        id: documentId,
        rfpId: 'rfp-456',
        type: 'proposal',
        filename: 'proposal.pdf',
        url: 'https://storage.example.com/proposal.pdf',
        uploadedBy: 'user-789',
        ...updates,
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([updatedDocument]);

      const result = await repository.updateDocument(documentId, updates);

      expect(result.metadata).toEqual(updates.metadata);
    });

    it('should update multiple fields at once', async () => {
      const documentId = 'doc-123';
      const updates: Partial<Document> = {
        filename: 'renamed-document.pdf',
        size: 3072000,
        metadata: {
          renamed: true,
          previousFilename: 'original.pdf',
        },
      };

      const updatedDocument: Partial<Document> = {
        id: documentId,
        rfpId: 'rfp-456',
        type: 'proposal',
        url: 'https://storage.example.com/proposal.pdf',
        uploadedBy: 'user-789',
        ...updates,
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([updatedDocument]);

      const result = await repository.updateDocument(documentId, updates);

      expect(result.filename).toBe('renamed-document.pdf');
      expect(result.size).toBe(3072000);
      expect(result.metadata).toEqual(updates.metadata);
    });

    it('should allow partial updates', async () => {
      const documentId = 'doc-123';
      const updates: Partial<Document> = {
        metadata: { processed: true },
      };

      const updatedDocument: Partial<Document> = {
        id: documentId,
        rfpId: 'rfp-456',
        type: 'proposal',
        filename: 'original-filename.pdf',
        url: 'https://storage.example.com/proposal.pdf',
        uploadedBy: 'user-789',
        ...updates,
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([updatedDocument]);

      const result = await repository.updateDocument(documentId, updates);

      // Original fields remain unchanged
      expect(result.filename).toBe('original-filename.pdf');
      // Updated field is changed
      expect(result.metadata).toEqual({ processed: true });
    });
  });

  describe('BaseRepository inheritance', () => {
    it('should extend BaseRepository', () => {
      expect(repository).toBeInstanceOf(DocumentRepository);
    });

    it('should have access to table metadata', () => {
      expect(repository).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should propagate database errors on get', async () => {
      const dbError = new Error('Database connection failed');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(
        repository.getDocument('doc-123')
      ).rejects.toThrow('Database connection failed');
    });

    it('should propagate errors during creation', async () => {
      const dbError = new Error('Storage quota exceeded');
      mockDb.returning.mockRejectedValueOnce(dbError);

      const newDocument: InsertDocument = {
        rfpId: 'rfp-789',
        type: 'proposal',
        filename: 'large-file.pdf',
        url: 'https://storage.example.com/large-file.pdf',
        uploadedBy: 'user-123',
      };

      await expect(
        repository.createDocument(newDocument)
      ).rejects.toThrow('Storage quota exceeded');
    });

    it('should propagate errors during update', async () => {
      const dbError = new Error('Document not found');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(
        repository.updateDocument('nonexistent-id', { filename: 'new-name.pdf' })
      ).rejects.toThrow('Document not found');
    });
  });

  describe('File type handling', () => {
    it('should handle PDF documents', async () => {
      const newDocument: InsertDocument = {
        rfpId: 'rfp-789',
        type: 'proposal',
        filename: 'document.pdf',
        url: 'https://storage.example.com/document.pdf',
        mimeType: 'application/pdf',
        uploadedBy: 'user-123',
      };

      const createdDocument: Partial<Document> = {
        id: 'doc-pdf',
        ...newDocument,
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdDocument]);

      const result = await repository.createDocument(newDocument);

      expect(result.mimeType).toBe('application/pdf');
    });

    it('should handle Word documents', async () => {
      const newDocument: InsertDocument = {
        rfpId: 'rfp-789',
        type: 'supporting_doc',
        filename: 'document.docx',
        url: 'https://storage.example.com/document.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploadedBy: 'user-123',
      };

      const createdDocument: Partial<Document> = {
        id: 'doc-docx',
        ...newDocument,
        createdAt: new Date(),
      };

      mockDb.returning.mockResolvedValueOnce([createdDocument]);

      const result = await repository.createDocument(newDocument);

      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    });

    it('should handle various file sizes', async () => {
      const fileSizes = [
        1024, // 1 KB
        1048576, // 1 MB
        10485760, // 10 MB
        52428800, // 50 MB
      ];

      for (const size of fileSizes) {
        jest.clearAllMocks();

        const newDocument: InsertDocument = {
          rfpId: 'rfp-789',
          type: 'supporting_doc',
          filename: `file-${size}.pdf`,
          url: `https://storage.example.com/file-${size}.pdf`,
          size,
          uploadedBy: 'user-123',
        };

        const createdDocument: Partial<Document> = {
          id: `doc-${size}`,
          ...newDocument,
          createdAt: new Date(),
        };

        mockDb.returning.mockResolvedValueOnce([createdDocument]);

        const result = await repository.createDocument(newDocument);

        expect(result.size).toBe(size);
      }
    });
  });
});
