# Demo RFP Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Load Demo RFP" feature that pre-populates realistic sample data and flows through the entire pipeline for testing.

**Architecture:** Add a "Use Sample Data" button in the Manual RFP dialog that bypasses scraping, directly inserts demo data into the database with a `demoData: true` flag, and triggers the standard proposal generation pipeline. The demo indicator will be displayed throughout the UI.

**Tech Stack:** React, TypeScript, Express, Drizzle ORM, PostgreSQL, Mastra AI agents

---

## Task 1: Add Demo Flag to RFP Schema

**Files:**
- Modify: `shared/schema.ts` (lines 71-132)
- Migrate: Database schema update

**Step 1: Add `isDemo` column to RFP schema**

In `shared/schema.ts`, add a new column to the `rfps` table definition after line 111 (`addedBy`):

```typescript
isDemo: boolean('is_demo').default(false).notNull(), // Flag for demo/test data
```

**Step 2: Run database migration**

Run: `npm run db:push`

Expected: Migration completes successfully with new `is_demo` column added

**Step 3: Verify migration**

Run: `psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='rfps' AND column_name='is_demo';"`

Expected: Returns `is_demo` column

**Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(schema): add isDemo flag to RFPs table for demo data identification"
```

---

## Task 2: Create Demo Data Constant

**Files:**
- Create: `shared/demoData.ts`

**Step 1: Create the demo RFP data file**

Create file `shared/demoData.ts` with the following content:

```typescript
/**
 * Demo RFP Data for testing the full pipeline
 * Based on real SAM.gov opportunity structure
 */

export interface DemoRfpData {
  title: string;
  description: string;
  agency: string;
  category: string;
  naicsCode: string;
  naicsDescription: string;
  pscCode: string;
  pscDescription: string;
  setAsideType: string;
  placeOfPerformance: string;
  state: string;
  contractType: string;
  solicitationNumber: string;
  sourceUrl: string;
  deadline: Date;
  estimatedValue: string;
  requirements: DemoRequirement[];
  complianceItems: Record<string, DemoComplianceItem>;
  riskFlags: string[];
  documents: DemoDocument[];
  contactInfo: {
    name: string;
    email: string;
    phone: string;
  };
}

export interface DemoRequirement {
  id: string;
  section: string;
  text: string;
  mandatory: boolean;
  category: string;
}

export interface DemoComplianceItem {
  requirementText: string;
  status: 'not_addressed' | 'compliant' | 'partial' | 'non_compliant';
  notes: string;
}

export interface DemoDocument {
  filename: string;
  fileType: string;
  fileSize: number;
  description: string;
}

export const DEMO_RFP_DATA: DemoRfpData = {
  title: 'R699-- Relocation and Removal Service',
  description: `The Department of Veterans Affairs, Network Contracting Office 7 (NCO 7) is seeking qualified Service-Disabled Veteran-Owned Small Businesses (SDVOSB) to provide relocation and removal services for the Atlanta VA Health Care System.

This combined synopsis/solicitation includes:
- Household goods relocation within the Atlanta metropolitan area
- Office furniture and equipment moving services
- Secure handling of sensitive VA equipment
- Packing, loading, transport, and unpacking services
- Storage services as needed

The contractor must demonstrate experience with government relocations and maintain all required insurance and bonding.`,
  agency: 'Veterans Affairs, Department of',
  category: 'Moving and Relocation Services',
  naicsCode: '484210',
  naicsDescription: 'Used Household and Office Goods Moving',
  pscCode: 'R699',
  pscDescription: 'Relocation Services',
  setAsideType: 'Service-Disabled Veteran-Owned Small Business (SDVOSB)',
  placeOfPerformance: 'Atlanta, GA',
  state: 'GA',
  contractType: 'Firm-Fixed-Price (FFP)',
  solicitationNumber: '36C24726R0007',
  sourceUrl: 'https://sam.gov/opp/demo-36C24726R0007/view',
  deadline: new Date('2025-12-31T16:00:00.000Z'), // Dec 31, 2025 11:00 AM EST
  estimatedValue: '250000.00',
  requirements: [
    {
      id: 'req-1',
      section: 'Technical Requirements',
      text: 'Contractor must be registered and verified in VetBiz as a Service-Disabled Veteran-Owned Small Business (SDVOSB)',
      mandatory: true,
      category: 'eligibility',
    },
    {
      id: 'req-2',
      section: 'Technical Requirements',
      text: 'Contractor must have a minimum of 3 years experience in commercial/government relocation services',
      mandatory: true,
      category: 'experience',
    },
    {
      id: 'req-3',
      section: 'Technical Requirements',
      text: 'Contractor must maintain cargo insurance of at least $1,000,000 per occurrence',
      mandatory: true,
      category: 'insurance',
    },
    {
      id: 'req-4',
      section: 'Technical Requirements',
      text: 'All personnel must pass VA background security checks prior to performing work',
      mandatory: true,
      category: 'security',
    },
    {
      id: 'req-5',
      section: 'Technical Requirements',
      text: 'Contractor must provide detailed inventory and tracking system for all moved items',
      mandatory: true,
      category: 'tracking',
    },
    {
      id: 'req-6',
      section: 'Past Performance',
      text: 'Provide at least 3 references for similar government or commercial relocation projects completed within the last 3 years',
      mandatory: true,
      category: 'references',
    },
    {
      id: 'req-7',
      section: 'Pricing',
      text: 'Pricing must include all labor, equipment, materials, and transportation costs',
      mandatory: true,
      category: 'pricing',
    },
    {
      id: 'req-8',
      section: 'Delivery',
      text: 'Contractor must be available to perform services within 10 business days of task order issuance',
      mandatory: false,
      category: 'schedule',
    },
  ],
  complianceItems: {
    'req-1': {
      requirementText: 'SDVOSB Registration',
      status: 'not_addressed',
      notes: '',
    },
    'req-2': {
      requirementText: '3 years experience',
      status: 'not_addressed',
      notes: '',
    },
    'req-3': {
      requirementText: 'Cargo insurance $1M',
      status: 'not_addressed',
      notes: '',
    },
    'req-4': {
      requirementText: 'VA background checks',
      status: 'not_addressed',
      notes: '',
    },
    'req-5': {
      requirementText: 'Inventory tracking system',
      status: 'not_addressed',
      notes: '',
    },
    'req-6': {
      requirementText: '3 past performance references',
      status: 'not_addressed',
      notes: '',
    },
    'req-7': {
      requirementText: 'All-inclusive pricing',
      status: 'not_addressed',
      notes: '',
    },
    'req-8': {
      requirementText: '10-day availability',
      status: 'not_addressed',
      notes: '',
    },
  },
  riskFlags: [
    'SDVOSB certification verification required',
    'Background check processing time may impact start date',
    'High-value cargo insurance requirement',
  ],
  documents: [
    {
      filename: 'Solicitation_36C24726R0007.pdf',
      fileType: 'application/pdf',
      fileSize: 2457600, // ~2.4 MB
      description: 'Full solicitation document with all requirements and clauses',
    },
    {
      filename: 'Statement_of_Work_Relocation_Services.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 156672, // ~153 KB
      description: 'Detailed statement of work and performance requirements',
    },
  ],
  contactInfo: {
    name: 'Gail Bargaineer',
    email: 'gail.bargaineer2@va.gov',
    phone: '404-321-6069',
  },
};

/**
 * Get demo RFP data with a fresh deadline (30 days from now)
 */
export function getDemoRfpDataWithFreshDeadline(): DemoRfpData {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return {
    ...DEMO_RFP_DATA,
    deadline: thirtyDaysFromNow,
  };
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit shared/demoData.ts`

Expected: No errors

**Step 3: Commit**

```bash
git add shared/demoData.ts
git commit -m "feat(demo): add demo RFP data constant with realistic VA opportunity"
```

---

## Task 3: Create Backend Demo RFP Service

**Files:**
- Create: `server/services/proposals/demoRfpService.ts`

**Step 1: Create the demo RFP service**

Create file `server/services/proposals/demoRfpService.ts`:

```typescript
import { nanoid } from 'nanoid';
import { storage } from '../../storage';
import { progressTracker } from '../monitoring/progressTracker';
import { getDemoRfpDataWithFreshDeadline, DEMO_RFP_DATA } from '@shared/demoData';

export interface CreateDemoRfpResult {
  success: boolean;
  sessionId: string;
  rfpId?: string;
  error?: string;
  message: string;
}

export class DemoRfpService {
  /**
   * Creates a demo RFP with pre-populated data for testing the full pipeline
   */
  async createDemoRfp(sessionId?: string): Promise<CreateDemoRfpResult> {
    const sid = sessionId || nanoid();

    try {
      console.log(`[DemoRfpService] Creating demo RFP with session: ${sid}`);

      // Start progress tracking
      progressTracker.startTracking(sid, 'demo://rfp-agent/demo-rfp');
      progressTracker.updateStep(sid, 'portal_detection', 'completed', 'Demo mode - using sample data');

      // Get demo data with fresh deadline
      const demoData = getDemoRfpDataWithFreshDeadline();

      // Simulate portal detection step
      progressTracker.updateStep(sid, 'page_navigation', 'completed', 'Demo data loaded');

      // Create the RFP record
      progressTracker.updateStep(sid, 'data_extraction', 'in_progress', 'Creating RFP record...');

      const rfpId = nanoid();

      // Find or create a demo portal
      const portalId = await this.findOrCreateDemoPortal();

      const rfp = {
        id: rfpId,
        title: demoData.title,
        description: `${demoData.description}\n\n**Contact:** ${demoData.contactInfo.name} | ${demoData.contactInfo.email} | ${demoData.contactInfo.phone}`,
        agency: demoData.agency,
        category: demoData.category,
        naicsCode: demoData.naicsCode,
        naicsDescription: demoData.naicsDescription,
        pscCode: demoData.pscCode,
        pscDescription: demoData.pscDescription,
        setAsideType: demoData.setAsideType,
        placeOfPerformance: demoData.placeOfPerformance,
        state: demoData.state,
        contractType: demoData.contractType,
        solicitationNumber: demoData.solicitationNumber,
        portalId: portalId,
        sourceUrl: demoData.sourceUrl,
        deadline: demoData.deadline,
        estimatedValue: demoData.estimatedValue,
        status: 'discovered' as const,
        progress: 10,
        requirements: demoData.requirements,
        complianceItems: demoData.complianceItems,
        riskFlags: demoData.riskFlags,
        addedBy: 'manual' as const,
        manuallyAddedAt: new Date(),
        isDemo: true,
        discoveredAt: new Date(),
        updatedAt: new Date(),
      };

      await storage.createRFP(rfp);

      progressTracker.updateStep(sid, 'data_extraction', 'completed', 'RFP record created');

      // Create mock documents (without actual file content)
      progressTracker.updateStep(sid, 'document_discovery', 'in_progress', `Found ${demoData.documents.length} documents`);

      for (const doc of demoData.documents) {
        await storage.createDocument({
          rfpId: rfpId,
          filename: doc.filename,
          fileType: doc.fileType,
          objectPath: `demo/${rfpId}/${doc.filename}`, // Mock path
          extractedText: `[DEMO] This is simulated extracted text from ${doc.filename}. In a real scenario, this would contain the actual document content extracted via AI/OCR processing.`,
          parsedData: {
            isDemo: true,
            description: doc.description,
            fileSize: doc.fileSize,
          },
        });
      }

      progressTracker.updateStep(sid, 'document_discovery', 'completed', `${demoData.documents.length} documents attached`);
      progressTracker.updateStep(sid, 'document_download', 'completed', 'Demo documents ready');
      progressTracker.updateStep(sid, 'database_save', 'completed', 'RFP saved to database');
      progressTracker.setRfpId(sid, rfpId);

      // Create notification
      await storage.createNotification({
        type: 'info',
        title: 'Demo RFP Created',
        message: `Demo RFP "${demoData.title}" has been created with ${demoData.documents.length} sample documents. This is test data for pipeline validation.`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfpId,
        isRead: false,
      });

      // Trigger AI analysis and proposal generation
      progressTracker.updateStep(sid, 'ai_analysis', 'in_progress', 'Starting AI analysis and proposal generation');
      this.triggerProposalGeneration(rfpId, sid);

      console.log(`[DemoRfpService] Demo RFP created successfully: ${rfpId}`);

      return {
        success: true,
        sessionId: sid,
        rfpId: rfpId,
        message: `Demo RFP "${demoData.title}" created successfully with ${demoData.documents.length} sample documents.`,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[DemoRfpService] Error creating demo RFP:', error);

      progressTracker.failTracking(sid, `Failed to create demo RFP: ${errorMessage}`);

      return {
        success: false,
        sessionId: sid,
        error: errorMessage,
        message: 'Failed to create demo RFP. Please try again.',
      };
    }
  }

  private async findOrCreateDemoPortal(): Promise<string> {
    const portals = await storage.getAllPortals();
    const demoPortal = portals.find((p: any) => p.name === 'Demo Portal (Test Data)');

    if (demoPortal) {
      return demoPortal.id;
    }

    // Create demo portal
    const portalId = nanoid();
    await storage.createPortal({
      id: portalId,
      name: 'Demo Portal (Test Data)',
      url: 'https://demo.rfpagent.local',
      type: 'federal',
      isActive: true,
      monitoringEnabled: false,
      loginRequired: false,
      status: 'active',
      scanFrequency: 24,
      maxRfpsPerScan: 50,
      errorCount: 0,
    });

    return portalId;
  }

  private async triggerProposalGeneration(rfpId: string, sessionId: string) {
    try {
      console.log(`[DemoRfpService] Triggering proposal generation for demo RFP: ${rfpId}`);

      // Update RFP status to parsing
      await storage.updateRFP(rfpId, {
        status: 'parsing',
        progress: 25,
        updatedAt: new Date(),
      });

      // Import enhanced proposal service dynamically
      const { enhancedProposalService } = await import('./enhancedProposalService.js');

      // Trigger proposal generation
      enhancedProposalService
        .generateProposal({
          rfpId: rfpId,
          generatePricing: true,
          autoSubmit: false,
          companyProfileId: undefined,
        })
        .then(async (result) => {
          console.log(`[DemoRfpService] Proposal generation completed for demo RFP: ${rfpId}`, result);

          await storage.updateRFP(rfpId, {
            status: result.readyForSubmission ? 'review' : 'drafting',
            progress: result.readyForSubmission ? 90 : 75,
            updatedAt: new Date(),
          });

          progressTracker.completeTracking(sessionId, rfpId);

          await storage.createNotification({
            type: 'success',
            title: 'Demo RFP Processing Complete',
            message: `Demo proposal has been generated and is ready for review. ${result.humanActionItems?.length || 0} action items identified.`,
            relatedEntityType: 'rfp',
            relatedEntityId: rfpId,
            isRead: false,
          });
        })
        .catch(async (error) => {
          console.error(`[DemoRfpService] Proposal generation failed for demo RFP: ${rfpId}`, error);

          progressTracker.failTracking(sessionId, `Proposal generation failed: ${error.message}`);

          await storage.createNotification({
            type: 'error',
            title: 'Demo RFP Processing Failed',
            message: 'Proposal generation failed for demo RFP. The RFP data is still available for manual testing.',
            relatedEntityType: 'rfp',
            relatedEntityId: rfpId,
            isRead: false,
          });

          await storage.updateRFP(rfpId, {
            status: 'discovered',
            progress: 15,
            updatedAt: new Date(),
          });
        });

    } catch (error) {
      console.error('[DemoRfpService] Error triggering proposal generation:', error);
      progressTracker.failTracking(sessionId, 'Failed to start proposal generation');
    }
  }
}

export const demoRfpService = new DemoRfpService();
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit server/services/proposals/demoRfpService.ts`

Expected: No errors

**Step 3: Commit**

```bash
git add server/services/proposals/demoRfpService.ts
git commit -m "feat(demo): add DemoRfpService for creating pre-populated test RFPs"
```

---

## Task 4: Add Demo RFP API Endpoint

**Files:**
- Modify: `server/routes/rfps.routes.ts` (add new endpoint after line 297)

**Step 1: Import the demo service**

At the top of `server/routes/rfps.routes.ts` (around line 8), add:

```typescript
import { demoRfpService } from '../services/proposals/demoRfpService';
```

**Step 2: Add the demo endpoint**

After line 297 (after the `/manual` endpoint), add:

```typescript
/**
 * Create a demo RFP with sample data for testing
 * This bypasses scraping and uses pre-populated data
 */
router.post('/demo', async (req, res) => {
  try {
    console.log('📦 Creating demo RFP with sample data');

    // Start processing asynchronously and return sessionId immediately
    const sessionId = randomUUID();

    // Return sessionId immediately so frontend can connect to progress stream
    res.status(202).json({
      success: true,
      sessionId,
      isDemo: true,
      message: 'Demo RFP creation started. Connect to the progress stream for updates.',
    });

    // Process asynchronously in the background
    demoRfpService
      .createDemoRfp(sessionId)
      .then(async (result) => {
        if (result.success && result.rfpId) {
          // Create audit log for demo RFP creation
          await storage.createAuditLog({
            entityType: 'rfp',
            entityId: result.rfpId,
            action: 'created_demo',
            details: {
              isDemo: true,
              message: 'Demo RFP created for pipeline testing',
            },
          });
          console.log(`✅ Demo RFP created successfully: ${result.rfpId}`);
        } else {
          console.error(`❌ Demo RFP creation failed: ${result.error}`);
        }
      })
      .catch((error) => {
        console.error('Error in background demo RFP creation:', error);
      });

  } catch (error) {
    console.error('Error creating demo RFP:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to create the demo RFP. Please try again.',
    });
  }
});
```

**Step 3: Verify the route works**

Run: `curl -X POST http://localhost:3000/api/rfps/demo -H "Content-Type: application/json"`

Expected: Returns 202 with sessionId and isDemo: true

**Step 4: Commit**

```bash
git add server/routes/rfps.routes.ts
git commit -m "feat(api): add POST /api/rfps/demo endpoint for demo RFP creation"
```

---

## Task 5: Add Demo Badge Component

**Files:**
- Create: `client/src/components/ui/demo-badge.tsx`

**Step 1: Create the demo badge component**

Create file `client/src/components/ui/demo-badge.tsx`:

```tsx
import { Badge } from '@/components/ui/badge';
import { FlaskConical } from 'lucide-react';

interface DemoBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function DemoBadge({ className = '', size = 'sm' }: DemoBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-sm px-2 py-1';

  return (
    <Badge
      variant="outline"
      className={`bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700 ${sizeClasses} ${className}`}
    >
      <FlaskConical className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1.5'} />
      Demo
    </Badge>
  );
}
```

**Step 2: Verify component compiles**

Run: `npx tsc --noEmit client/src/components/ui/demo-badge.tsx`

Expected: No errors

**Step 3: Commit**

```bash
git add client/src/components/ui/demo-badge.tsx
git commit -m "feat(ui): add DemoBadge component for identifying demo data"
```

---

## Task 6: Update ActiveRFPsTable with Demo Button and Badge

**Files:**
- Modify: `client/src/components/ActiveRFPsTable.tsx`

**Step 1: Import DemoBadge and add demo button to dialog**

At the top of the file (around line 28), add the DemoBadge import:

```typescript
import { DemoBadge } from '@/components/ui/demo-badge';
```

**Step 2: Add demo RFP mutation**

After the `manualRfpMutation` definition (around line 217), add:

```typescript
const demoRfpMutation = useMutation({
  mutationFn: async () => {
    console.log('🧪 Creating demo RFP');
    const response = await apiRequest('POST', '/api/rfps/demo');
    console.log('📡 Demo RFP response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Demo RFP API response not ok:', response.status, errorText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Demo RFP response:', JSON.stringify(result, null, 2));
    return result;
  },
  onSuccess: (data) => {
    console.log('🎉 Demo RFP mutation onSuccess:', JSON.stringify(data, null, 2));

    if (data.success && data.sessionId) {
      // Show progress modal
      setProgressSessionId(data.sessionId);
      setProgressDialogOpen(true);
      setManualRfpDialogOpen(false);

      toast({
        title: 'Demo RFP Creation Started',
        description: 'Creating sample RFP with realistic test data. Track progress in real-time.',
      });
    } else {
      toast({
        title: 'Demo RFP Failed',
        description: data.message || 'Failed to create demo RFP.',
        variant: 'destructive',
      });
    }
  },
  onError: (error: any) => {
    toast({
      title: 'Demo RFP Failed',
      description: error?.message || 'Failed to create demo RFP. Please try again.',
      variant: 'destructive',
    });
  },
});
```

**Step 3: Add "Use Sample Data" button in the dialog**

Find the dialog content (around line 512, the blue info box section). Replace the entire blue info box `<div className="bg-blue-50...">` section with:

```tsx
<div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg border border-blue-200 dark:border-blue-800/50">
  <div className="flex items-start space-x-3">
    <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
    <div className="flex-1">
      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
        How Manual RFP Processing Works
      </h4>
      <ul className="text-xs text-blue-800 dark:text-blue-200 mt-2 space-y-1">
        <li>• AI analyzes the URL and extracts RFP information</li>
        <li>• Documents are automatically downloaded and processed</li>
        <li>• Competitive pricing research is conducted</li>
        <li>• Human oversight requirements are identified</li>
        <li>• Complete proposal generation begins automatically</li>
      </ul>
    </div>
  </div>
</div>

{/* Demo Data Option */}
<div className="bg-purple-50 dark:bg-purple-950/50 p-4 rounded-lg border border-purple-200 dark:border-purple-800/50">
  <div className="flex items-start justify-between">
    <div className="flex items-start space-x-3">
      <i className="fas fa-flask text-purple-600 dark:text-purple-400 mt-0.5"></i>
      <div>
        <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100">
          Test with Sample Data
        </h4>
        <p className="text-xs text-purple-800 dark:text-purple-200 mt-1">
          Skip URL entry and test the full pipeline with a realistic VA relocation services RFP.
        </p>
      </div>
    </div>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => demoRfpMutation.mutate()}
      disabled={demoRfpMutation.isPending}
      className="shrink-0 border-purple-400 text-purple-700 hover:bg-purple-100 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-950"
      data-testid="demo-rfp-button"
    >
      {demoRfpMutation.isPending ? (
        <>
          <i className="fas fa-spinner fa-spin mr-2"></i>
          Creating...
        </>
      ) : (
        <>
          <i className="fas fa-flask mr-2"></i>
          Use Sample Data
        </>
      )}
    </Button>
  </div>
</div>
```

**Step 4: Add demo badge to RFP rows**

In the RFP title cell (around line 624), update the title display to show demo badge:

Find this section:
```tsx
<Link href={`/rfps/${item.rfp.id}`}>
  <h4
    className="text-sm font-medium text-foreground hover:text-primary cursor-pointer transition-colors"
    data-testid={`rfp-title-${item.rfp.id}`}
  >
    {item.rfp.title}
  </h4>
</Link>
```

Replace with:
```tsx
<div className="flex items-center gap-2">
  <Link href={`/rfps/${item.rfp.id}`}>
    <h4
      className="text-sm font-medium text-foreground hover:text-primary cursor-pointer transition-colors"
      data-testid={`rfp-title-${item.rfp.id}`}
    >
      {item.rfp.title}
    </h4>
  </Link>
  {item.rfp.isDemo && <DemoBadge size="sm" />}
</div>
```

**Step 5: Test the UI changes**

Run: `npm run dev` and verify:
1. Manual RFP dialog shows "Use Sample Data" button
2. Demo badge appears on demo RFPs in the table

**Step 6: Commit**

```bash
git add client/src/components/ActiveRFPsTable.tsx
git commit -m "feat(ui): add demo RFP creation button and demo badge display in table"
```

---

## Task 7: Update RFP Detail Page with Demo Badge

**Files:**
- Modify: `client/src/pages/rfp-detail.tsx` (or equivalent RFP detail component)

**Step 1: Find the RFP detail page**

Run: `fd rfp-detail -e tsx` or `fd rfp.*.tsx -p client/src/pages`

**Step 2: Add DemoBadge import**

```typescript
import { DemoBadge } from '@/components/ui/demo-badge';
```

**Step 3: Add demo indicator to page header**

In the page header where RFP title is displayed, add conditional demo badge:

```tsx
{/* In the header section, after the title */}
{rfp.isDemo && (
  <div className="flex items-center gap-2 mt-2">
    <DemoBadge size="md" />
    <span className="text-sm text-muted-foreground">
      This is demo data for testing purposes
    </span>
  </div>
)}
```

**Step 4: Commit**

```bash
git add client/src/pages/rfp-detail.tsx
git commit -m "feat(ui): add demo indicator to RFP detail page"
```

---

## Task 8: Update Proposals Page with Demo Badge

**Files:**
- Modify: `client/src/pages/proposals.tsx`

**Step 1: Add DemoBadge import**

```typescript
import { DemoBadge } from '@/components/ui/demo-badge';
```

**Step 2: Add demo badge to proposal cards/rows**

In the proposal list rendering, add conditional demo badge near the proposal title:

```tsx
{/* Where proposals are displayed */}
{proposal.rfp?.isDemo && <DemoBadge size="sm" />}
```

**Step 3: Commit**

```bash
git add client/src/pages/proposals.tsx
git commit -m "feat(ui): add demo indicator to proposals page"
```

---

## Task 9: Add Demo Filter to RFP Queries

**Files:**
- Modify: `server/storage.ts` or relevant repository file

**Step 1: Find the getAllRFPs function**

Locate where RFPs are queried and add optional `excludeDemo` filter:

```typescript
async getAllRFPs(options?: {
  status?: string;
  portalId?: string;
  limit?: number;
  offset?: number;
  excludeDemo?: boolean;
}) {
  const { status, portalId, limit = 20, offset = 0, excludeDemo = false } = options || {};

  let query = db.select().from(rfps);

  const conditions = [];
  if (status) conditions.push(eq(rfps.status, status));
  if (portalId) conditions.push(eq(rfps.portalId, portalId));
  if (excludeDemo) conditions.push(eq(rfps.isDemo, false));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  // ... rest of query
}
```

**Step 2: Commit**

```bash
git add server/storage.ts
git commit -m "feat(api): add excludeDemo filter to RFP queries"
```

---

## Task 10: Write Integration Tests

**Files:**
- Create: `tests/integration/demo-rfp.test.ts`

**Step 1: Create test file**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { db } from '../../server/db';
import { rfps, documents, proposals } from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Demo RFP Feature', () => {
  let createdRfpId: string;

  afterAll(async () => {
    // Cleanup demo data
    if (createdRfpId) {
      await db.delete(documents).where(eq(documents.rfpId, createdRfpId));
      await db.delete(proposals).where(eq(proposals.rfpId, createdRfpId));
      await db.delete(rfps).where(eq(rfps.id, createdRfpId));
    }
  });

  it('POST /api/rfps/demo should create a demo RFP', async () => {
    const response = await request(app)
      .post('/api/rfps/demo')
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.sessionId).toBeDefined();
    expect(response.body.isDemo).toBe(true);
  });

  it('Demo RFP should have isDemo flag set to true', async () => {
    // Wait for async creation
    await new Promise(resolve => setTimeout(resolve, 2000));

    const demoRfps = await db
      .select()
      .from(rfps)
      .where(eq(rfps.isDemo, true))
      .limit(1);

    expect(demoRfps.length).toBeGreaterThan(0);
    createdRfpId = demoRfps[0].id;

    expect(demoRfps[0].title).toBe('R699-- Relocation and Removal Service');
    expect(demoRfps[0].agency).toBe('Veterans Affairs, Department of');
    expect(demoRfps[0].naicsCode).toBe('484210');
  });

  it('Demo RFP should have mock documents attached', async () => {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.rfpId, createdRfpId));

    expect(docs.length).toBe(2);
    expect(docs.some(d => d.filename.includes('.pdf'))).toBe(true);
    expect(docs.some(d => d.filename.includes('.docx'))).toBe(true);
  });

  it('GET /api/rfps should include demo RFPs with isDemo flag', async () => {
    const response = await request(app)
      .get('/api/rfps')
      .expect(200);

    const demoRfp = response.body.data.find((r: any) => r.isDemo === true);
    expect(demoRfp).toBeDefined();
  });
});
```

**Step 2: Run tests**

Run: `npm run test tests/integration/demo-rfp.test.ts`

Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/demo-rfp.test.ts
git commit -m "test: add integration tests for demo RFP feature"
```

---

## Task 11: Final Integration Test - Full Pipeline

**Files:**
- Manual testing checklist

**Step 1: Start the application**

Run: `npm run dev`

**Step 2: Test the demo flow**

1. [ ] Navigate to Dashboard
2. [ ] Click "Manual RFP" button
3. [ ] Click "Use Sample Data" button
4. [ ] Verify progress modal appears
5. [ ] Wait for processing to complete
6. [ ] Verify RFP appears in table with Demo badge
7. [ ] Click on RFP to view details - verify Demo indicator
8. [ ] Navigate to Proposals page
9. [ ] Verify proposal was generated (may take a few minutes)
10. [ ] Verify Demo badge appears on proposal
11. [ ] Test compliance and pricing features with demo data

**Step 3: Verify Analytics**

Check that demo RFP contributes to:
- [ ] Total RFP count
- [ ] Status distribution
- [ ] Proposal count

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete demo RFP feature with full pipeline integration"
```

---

## Summary

This implementation adds:

1. **Database schema**: `isDemo` flag on RFPs table
2. **Demo data**: Realistic VA relocation services RFP constant
3. **Backend service**: `DemoRfpService` for creating demo RFPs
4. **API endpoint**: `POST /api/rfps/demo`
5. **UI components**: `DemoBadge` component
6. **UI integration**: Demo button in Manual RFP dialog, badges throughout
7. **Tests**: Integration tests for demo feature

The demo data flows through the entire pipeline:
- Saves to database with `isDemo: true`
- Creates mock documents
- Triggers AI analysis and proposal generation
- Updates status through workflow stages
- Populates proposals page
- Visible in analytics
- Supports compliance and pricing features
