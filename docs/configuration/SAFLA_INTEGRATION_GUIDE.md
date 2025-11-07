# SAFLA System Integration Guide

## Current Status

The SAFLA (Self-Aware Feedback Loop Algorithm) system is **fully implemented** but **not yet integrated** into the RFP workflow. This guide explains how to enable learning.

## Why Learning Rate is 0

### Missing Integration Points

1. **RFP Processing** - Not recording events when RFPs are discovered/parsed
2. **Proposal Generation** - Not recording quality metrics and outcomes
3. **Portal Navigation** - Not learning from successful/failed portal scans
4. **Document Processing** - Not tracking extraction accuracy

### Required Integration Steps

#### 1. Add Learning Events to RFP Processing

In `server/services/proposals/manualRfpService.ts`, add after successful RFP creation:

```typescript
import { SAFLALearningEngine } from '../learning/saflaLearningEngine';

// After RFP is created (line ~137)
const learningEngine = SAFLALearningEngine.getInstance();
await learningEngine.recordLearningEvent({
  agentId: 'rfp-processor',
  taskType: 'rfp_extraction',
  context: {
    portalType: scrapingResult.rfp.portalName,
    documentCount: scrapingResult.documents?.length || 0,
    url: input.url,
  },
  outcome: {
    success: true,
    metrics: {
      documentsFound: scrapingResult.documents?.length || 0,
      processingTime: Date.now() - startTime,
    },
  },
  timestamp: new Date(),
});
```

#### 2. Add Learning Events to Proposal Generation

In `server/services/proposals/enhancedProposalService.ts`:

```typescript
// After proposal is generated
await learningEngine.recordLearningEvent({
  agentId: 'proposal-generator',
  taskType: 'proposal_generation',
  context: {
    rfpId: rfpId,
    sections: generatedSections,
    qualityScore: result.qualityScore,
  },
  outcome: {
    success: result.readyForSubmission,
    metrics: {
      qualityScore: result.qualityScore,
      generationTime: result.generationTime,
      sectionsGenerated: Object.keys(generatedSections).length,
    },
  },
  timestamp: new Date(),
});
```

#### 3. Add Learning Events to Portal Scanning

In portal scanning services, record navigation success/failure.

## Proposal Outcome Tracking

### Why Win Rate is 0%

**The system has NO way to know if you won or lost a bid because:**

1. ❌ No manual outcome entry UI
2. ❌ No automated award notice scraping
3. ❌ No integration with portal notifications

### Solution 1: Manual Outcome Tracking (Quick)

Add this API endpoint to record outcomes:

**File**: `server/routes/proposals.routes.ts`

```typescript
/**
 * Record proposal outcome (win/loss)
 */
router.post('/:id/outcome', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, details } = req.body;

    const proposal = await storage.getProposal(id);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Record outcome for learning
    const { ProposalOutcomeTracker } = await import(
      '../services/monitoring/proposalOutcomeTracker'
    );
    const tracker = ProposalOutcomeTracker.getInstance();

    await tracker.recordProposalOutcome({
      proposalId: id,
      rfpId: proposal.rfpId,
      status: status, // 'awarded', 'lost', 'rejected'
      outcomeDetails: details || {},
      learningData: {
        strategiesUsed: proposal.strategies || {},
        marketConditions: {},
        competitiveFactors: {},
        internalFactors: {},
      },
      timestamp: new Date(),
    });

    res.json({ success: true, message: 'Outcome recorded' });
  } catch (error) {
    console.error('Error recording outcome:', error);
    res.status(500).json({ error: 'Failed to record outcome' });
  }
});
```

**Frontend Component** (add to proposal detail page):

```tsx
// In client/src/pages/proposal-details.tsx or similar
<Button
  onClick={() => recordOutcome('awarded')}
  variant="success"
>
  Mark as Won ✅
</Button>

<Button
  onClick={() => recordOutcome('lost')}
  variant="destructive"
>
  Mark as Lost ❌
</Button>
```

### Solution 2: Automated Award Notice Scraping (Advanced)

Set up periodic portal checks to see if awards were announced:

1. **Daily Award Check Job** - Check portals for award announcements
2. **Match to Submitted Proposals** - Link awards back to your proposals
3. **Auto-record Outcomes** - Automatically update win/loss status

## Quick Start Checklist

- [ ] Add learning event recording to RFP processing
- [ ] Add learning event recording to proposal generation
- [ ] Add learning event recording to portal scanning
- [ ] Create manual outcome recording API endpoint
- [ ] Add "Mark Outcome" buttons to proposal UI
- [ ] Test by manually marking a few proposal outcomes
- [ ] Verify SAFLA dashboard shows learning rate > 0
- [ ] Verify win rate updates based on recorded outcomes

## Expected Results After Integration

Once integrated:

- **Learning Rate**: 5-20 events/day (depending on activity)
- **Proposal Win Rate**: Actual percentage based on recorded outcomes
- **Adaptation Success**: System learns from patterns and improves
- **Knowledge Growth**: Increases as more operations are performed

## Testing the System

### 1. Generate Test Learning Events

```bash
# Call the SAFLA test endpoint
curl -X POST http://localhost:5000/api/safla/test/learning-event \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test-agent",
    "taskType": "test_operation",
    "outcome": { "success": true, "metrics": { "score": 0.95 } }
  }'
```

### 2. Record Test Proposal Outcome

```bash
curl -X POST http://localhost:5000/api/proposals/{proposal-id}/outcome \
  -H "Content-Type: application/json" \
  -d '{
    "status": "awarded",
    "details": {
      "awardDate": "2025-01-15",
      "score": 95,
      "feedback": "Excellent proposal"
    }
  }'
```

### 3. Check SAFLA Dashboard

Visit `/safla-dashboard` and verify:

- Learning Rate > 0
- Proposal Win Rate updates
- Recent Learning Events appear

## Future Enhancements

1. **Auto-scrape award notices** from portals
2. **Email notifications** when awards are announced
3. **Competitive intelligence** - track who else is winning bids
4. **Strategy optimization** - AI suggests improvements based on wins/losses
5. **Predictive modeling** - Estimate win probability before submitting

## Support

For questions or issues:

- Check logs: `tail -f server/logs/safla.log`
- Enable debug mode: `DEBUG=safla:* npm run dev`
- Review integration: `docs/configuration/SAFLA_INTEGRATION_GUIDE.md`
