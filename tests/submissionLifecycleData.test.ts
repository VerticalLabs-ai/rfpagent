import { submissionLifecycleDataSchema, insertProposalSchema } from '@shared/schema';

describe('submission lifecycle data schema', () => {
  it('accepts completion metadata with retry information and reference numbers', () => {
    const parsed = submissionLifecycleDataSchema.parse({
      pipelineId: 'pipeline-123',
      completedAt: new Date().toISOString(),
      retryCount: 2,
      referenceNumber: 'REF-001',
    });

    expect(parsed.pipelineId).toBe('pipeline-123');
    expect(parsed.retryCount).toBe(2);
    expect(parsed.referenceNumber).toBe('REF-001');
    expect(parsed.completedAt).toBeTruthy();
  });

  it('allows nullified datetime fields from pipeline metadata', () => {
    const parsed = submissionLifecycleDataSchema.parse({
      deadline: null,
      failedAt: null,
      initiatedAt: undefined,
    });

    expect(parsed.deadline).toBeNull();
    expect(parsed.failedAt).toBeNull();
    expect(parsed.initiatedAt).toBeUndefined();
  });
});

describe('proposal insert schema', () => {
  it('parses receipt metadata alongside submission timestamps', () => {
    const parsed = insertProposalSchema.parse({
      rfpId: 'rfp-123',
      content: {},
      narratives: {},
      pricingTables: {},
      forms: {},
      attachments: {},
      proposalData: {},
      status: 'draft',
      receiptData: { confirmationNumber: 'ABC-123' },
      submittedAt: new Date().toISOString(),
    });

    expect(parsed.receiptData?.confirmationNumber).toBe('ABC-123');
  });
});
