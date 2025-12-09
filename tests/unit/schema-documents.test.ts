// tests/unit/schema-documents.test.ts
import { documents } from '../../shared/schema';

describe('documents schema', () => {
  it('should include download-related fields', () => {
    // Check that the schema has the expected fields
    const columns = Object.keys(documents);

    expect(columns).toContain('sourceSize');
    expect(columns).toContain('downloadedSize');
    expect(columns).toContain('downloadStatus');
    expect(columns).toContain('downloadError');
    expect(columns).toContain('verificationStatus');
    expect(columns).toContain('sourceUrl');
    expect(columns).toContain('downloadedAt');
  });

  it('should have proper types exported', () => {
    // Types are exported via TypeScript type system, verify by checking
    // that the schema has the correct structure for type inference
    type Document = typeof documents.$inferSelect;
    type InsertDocument = typeof documents.$inferInsert;

    // Verify type exists by creating a partial object
    const partialDoc: Partial<Document> = {
      sourceUrl: 'https://example.com/doc.pdf',
      sourceSize: 1024,
      downloadedSize: 1024,
      downloadStatus: 'completed',
      verificationStatus: 'passed',
    };

    expect(partialDoc.sourceUrl).toBe('https://example.com/doc.pdf');
    expect(partialDoc.downloadStatus).toBe('completed');
  });
});
