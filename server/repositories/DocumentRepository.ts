import { eq } from 'drizzle-orm';
import { db } from '../db';
import { documents, type Document, type InsertDocument } from '@shared/schema';
import { BaseRepository } from './BaseRepository';

/**
 * Repository for managing documents
 * Handles document CRUD operations and RFP associations
 */
export class DocumentRepository extends BaseRepository<typeof documents> {
  constructor() {
    super(documents);
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document || undefined;
  }

  /**
   * Get all documents for an RFP
   */
  async getDocumentsByRFP(rfpId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.rfpId, rfpId));
  }

  /**
   * Create a new document
   */
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
  }

  /**
   * Update a document
   */
  async updateDocument(
    id: string,
    updates: Partial<Document>
  ): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }
}

export const documentRepository = new DocumentRepository();
