# SAM.gov Workspace URL Import Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Manual RFP import flow to properly handle SAM.gov workspace URLs by detecting the authenticated URL pattern, providing clear user guidance to use public URLs, and ensuring errors are properly displayed.

**Architecture:** Add URL pattern detection for SAM.gov workspace URLs, provide user-friendly error messages explaining that workspace URLs require authentication, suggest the equivalent public URL format, and ensure all errors are properly propagated to the frontend via SSE.

**Tech Stack:** TypeScript, Express, React, SSE (Server-Sent Events)

---

## Problem Summary

When users submit a SAM.gov workspace URL (e.g., `https://sam.gov/workspace/contract/opp/{id}/view`):
1. Processing starts but fails silently
2. No RFP is added to the database
3. No error message is shown to the user
4. The Activity Feed is never updated

**Root Cause:** The workspace URL pattern is not recognized by `validateSAMGovUrl()` and errors are not properly propagated through the SSE progress tracking system.

---

### Task 1: Add SAM.gov Workspace URL Detection and User Guidance

**Files:**
- Modify: `server/services/mastra/utils/urlValidation.ts:178-193`

**Step 1: Write the failing test**

Create test file `server/services/mastra/utils/__tests__/urlValidation.test.ts`:

```typescript
import { validateSAMGovUrl } from '../urlValidation';

describe('validateSAMGovUrl', () => {
  describe('valid public URLs', () => {
    it('should accept /opp/ format URLs with opportunity ID', () => {
      const url = 'https://sam.gov/opp/abc123def456/view';
      expect(validateSAMGovUrl(url)).toBe(url);
    });

    it('should accept /opportunities/ format URLs', () => {
      const url = 'https://sam.gov/opportunities/opp-12345/view';
      expect(validateSAMGovUrl(url)).toBe(url);
    });
  });

  describe('workspace URLs (authentication required)', () => {
    it('should return special error object for workspace/contract/opp URLs', () => {
      const url = 'https://sam.gov/workspace/contract/opp/abc123/view';
      const result = validateSAMGovUrl(url);
      expect(result).toEqual({
        error: 'WORKSPACE_URL_REQUIRES_AUTH',
        message: 'SAM.gov workspace URLs require authentication. Please use the public URL format instead.',
        suggestedUrl: 'https://sam.gov/opp/abc123/view',
        originalUrl: url,
      });
    });

    it('should extract opportunity ID from workspace URL', () => {
      const url = 'https://sam.gov/workspace/contract/opp/def456ghi789/view';
      const result = validateSAMGovUrl(url);
      expect(result.suggestedUrl).toBe('https://sam.gov/opp/def456ghi789/view');
    });
  });

  describe('invalid URLs', () => {
    it('should return null for generic sam.gov URLs without opportunity ID', () => {
      const url = 'https://sam.gov/search';
      expect(validateSAMGovUrl(url)).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest server/services/mastra/utils/__tests__/urlValidation.test.ts -v`
Expected: FAIL with "Cannot find module" or test failures for new behavior

**Step 3: Update validateSAMGovUrl to detect workspace URLs**

Modify `server/services/mastra/utils/urlValidation.ts`:

```typescript
/**
 * SAM.gov URL validation result type
 */
export interface SAMGovUrlValidationError {
  error: 'WORKSPACE_URL_REQUIRES_AUTH';
  message: string;
  suggestedUrl: string;
  originalUrl: string;
}

/**
 * Validate SAM.gov URLs
 * Must contain opportunity IDs
 * Detects workspace URLs that require authentication
 */
export function validateSAMGovUrl(url: string): string | SAMGovUrlValidationError | null {
  // Check for workspace URLs (authentication required)
  // Pattern: https://sam.gov/workspace/contract/opp/{id}/view
  const workspaceMatch = url.match(/sam\.gov\/workspace\/contract\/opp\/([a-zA-Z0-9]+)\/view/i);
  if (workspaceMatch) {
    const opportunityId = workspaceMatch[1];
    logger.debug('Detected SAM.gov workspace URL (requires authentication)', {
      url,
      opportunityId,
    });
    return {
      error: 'WORKSPACE_URL_REQUIRES_AUTH',
      message: 'SAM.gov workspace URLs require authentication. Please use the public URL format instead.',
      suggestedUrl: `https://sam.gov/opp/${opportunityId}/view`,
      originalUrl: url,
    };
  }

  // SAM.gov URLs typically contain opportunity IDs
  // Support both /opportunities/ (legacy/search) and /opp/ (direct link) formats
  if (
    (url.includes('/opportunities/') || url.includes('/opp/')) &&
    (url.includes('opp-') ||
      url.includes('opportunity-') ||
      /[a-f0-9]{32}/i.test(url) ||
      /\/opp\/[a-zA-Z0-9]+\/view/i.test(url))
  ) {
    logger.debug('Valid SAM.gov detail URL', { url });
    return url;
  }

  logger.debug('Invalid SAM.gov URL (missing opportunity ID)', { url });
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest server/services/mastra/utils/__tests__/urlValidation.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/mastra/utils/urlValidation.ts server/services/mastra/utils/__tests__/urlValidation.test.ts
git commit -m "$(cat <<'EOF'
feat: Add SAM.gov workspace URL detection with user guidance

Detect workspace URLs that require authentication and provide
users with the equivalent public URL format to use instead.
EOF
)"
```

---

### Task 2: Update manualRfpService to Handle SAM.gov Workspace URL Errors

**Files:**
- Modify: `server/services/proposals/manualRfpService.ts:43-121`

**Step 1: Write the failing test**

Create test file `server/services/proposals/__tests__/manualRfpService.samgov.test.ts`:

```typescript
import { ManualRfpService } from '../manualRfpService';

describe('ManualRfpService - SAM.gov URLs', () => {
  let service: ManualRfpService;

  beforeEach(() => {
    service = new ManualRfpService();
  });

  describe('workspace URLs', () => {
    it('should return helpful error for workspace URLs', async () => {
      const result = await service.processManualRfp({
        url: 'https://sam.gov/workspace/contract/opp/abc123def456/view',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('workspace');
      expect(result.message).toContain('public URL');
      expect(result.suggestedUrl).toBe('https://sam.gov/opp/abc123def456/view');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest server/services/proposals/__tests__/manualRfpService.samgov.test.ts -v --testTimeout=30000`
Expected: FAIL - suggestedUrl property does not exist

**Step 3: Add SAM.gov workspace URL detection to manualRfpService**

Modify `server/services/proposals/manualRfpService.ts`:

First, add the import at the top of the file:

```typescript
import { SAMGovUrlValidationError } from '../mastra/utils/urlValidation';
```

Update the `ManualRfpResult` interface:

```typescript
export interface ManualRfpResult {
  success: boolean;
  sessionId: string;
  rfpId?: string;
  error?: string;
  message: string;
  suggestedUrl?: string; // For workspace URL errors
}
```

Add detection logic at the start of `processManualRfp` method (after line 52):

```typescript
async processManualRfp(input: ManualRfpInput): Promise<ManualRfpResult> {
  const sessionId = input.sessionId || randomUUID();

  try {
    console.log(
      `[ManualRfpService] Processing manual RFP from URL: ${input.url}`
    );

    // Check for SAM.gov workspace URLs (require authentication)
    const samGovWorkspaceMatch = input.url.match(
      /sam\.gov\/workspace\/contract\/opp\/([a-zA-Z0-9]+)\/view/i
    );
    if (samGovWorkspaceMatch) {
      const opportunityId = samGovWorkspaceMatch[1];
      const suggestedUrl = `https://sam.gov/opp/${opportunityId}/view`;

      console.log(
        `[ManualRfpService] SAM.gov workspace URL detected - requires authentication`
      );

      // Update progress tracker with helpful error
      progressTracker.startTracking(sessionId, input.url);
      progressTracker.updateStep(
        sessionId,
        'portal_detection',
        'failed',
        'SAM.gov workspace URLs require authentication'
      );
      progressTracker.failTracking(
        sessionId,
        `This is a SAM.gov workspace URL that requires you to be logged in. Please use the public URL instead: ${suggestedUrl}`
      );

      return {
        success: false,
        sessionId,
        error: 'SAM.gov workspace URLs require authentication',
        message: `This URL is from your SAM.gov workspace and requires authentication. Please use the public URL format instead: ${suggestedUrl}`,
        suggestedUrl,
      };
    }

    // Start progress tracking (existing code continues...)
    progressTracker.startTracking(sessionId, input.url);
    // ... rest of existing code
```

**Step 4: Run test to verify it passes**

Run: `npx jest server/services/proposals/__tests__/manualRfpService.samgov.test.ts -v --testTimeout=30000`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/proposals/manualRfpService.ts server/services/proposals/__tests__/manualRfpService.samgov.test.ts
git commit -m "$(cat <<'EOF'
feat: Detect SAM.gov workspace URLs and provide public URL alternative

When users submit a SAM.gov workspace URL, detect it early and
provide a helpful error message with the equivalent public URL
that doesn't require authentication.
EOF
)"
```

---

### Task 3: Update Frontend to Display SAM.gov URL Suggestions

**Files:**
- Modify: `client/src/components/ActiveRFPsTable.tsx:128-200`

**Step 1: Write the test (manual verification)**

Since this is UI code, we'll verify manually after implementation.

**Step 2: Update the mutation handler to show suggested URL**

Modify `client/src/components/ActiveRFPsTable.tsx`:

Update the `manualRfpMutation` onError handler and add suggested URL display:

```typescript
const manualRfpMutation = useMutation({
  mutationFn: async (data: { url: string; userNotes?: string }) => {
    console.log('🚀 Submitting manual RFP:', data);
    const response = await apiRequest('POST', '/api/rfps/manual', data);
    console.log('📡 Raw response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API response not ok:', response.status, errorText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Parsed API response:', JSON.stringify(result, null, 2));
    return result;
  },
  onSuccess: data => {
    console.log(
      '🎉 Manual RFP mutation onSuccess called with data:',
      JSON.stringify(data, null, 2)
    );

    if (data.success && data.sessionId) {
      console.log('✅ Success conditions met, opening progress modal');

      // Show progress modal
      setProgressSessionId(data.sessionId);
      setProgressDialogOpen(true);
      setManualRfpDialogOpen(false);

      // Clear form
      setManualRfpUrl('');
      setManualRfpNotes('');

      toast({
        title: 'RFP Processing Started',
        description:
          'Processing has begun. You can track progress in real-time.',
      });
    } else {
      console.log('❌ Success conditions not met:', {
        success: data.success,
        sessionId: data.sessionId,
        message: data.message,
        suggestedUrl: data.suggestedUrl,
      });

      // Check if there's a suggested URL (SAM.gov workspace URL case)
      if (data.suggestedUrl) {
        toast({
          title: 'SAM.gov Workspace URL Detected',
          description: (
            <div className="space-y-2">
              <p>{data.message}</p>
              <p className="font-medium">Try this URL instead:</p>
              <code className="block p-2 bg-muted rounded text-xs break-all">
                {data.suggestedUrl}
              </code>
            </div>
          ),
          variant: 'destructive',
          duration: 15000, // Show longer for user to copy URL
        });
        // Pre-fill the form with suggested URL
        setManualRfpUrl(data.suggestedUrl);
      } else {
        toast({
          title: 'Manual RFP Failed',
          description: data.message || 'Failed to process the RFP URL.',
          variant: 'destructive',
        });
      }
    }
  },
  onError: (error: any) => {
    const errorMessage =
      error?.message ||
      'Failed to process the RFP URL. Please check the URL and try again.';
    toast({
      title: 'Manual RFP Failed',
      description: errorMessage,
      variant: 'destructive',
    });
  },
});
```

**Step 3: Verify the toast component supports JSX description**

Check that the toast description accepts ReactNode (it should with shadcn/ui).

**Step 4: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add client/src/components/ActiveRFPsTable.tsx
git commit -m "$(cat <<'EOF'
feat: Display SAM.gov suggested URL in error toast with auto-fill

When a SAM.gov workspace URL is detected, show the suggested
public URL in the error toast and pre-fill the form field.
EOF
)"
```

---

### Task 4: Update RFPProcessingProgressModal to Display Error Details

**Files:**
- Modify: `client/src/components/RFPProcessingProgress.tsx:329-342`

**Step 1: Enhance error display to show suggested URL**

Modify `client/src/components/RFPProcessingProgress.tsx`:

Update the error display section to parse and display suggested URLs:

```typescript
{/* Error Display */}
{progress.error && (
  <Card className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
    <CardHeader>
      <CardTitle className="text-lg text-red-800 dark:text-red-200">
        Error
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-red-700 dark:text-red-300">
        {progress.error}
      </p>
      {/* Check if error contains a suggested URL */}
      {progress.error.includes('sam.gov/opp/') && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
            Suggested Action:
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Copy the public URL from the error message above and try again.
          </p>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add client/src/components/RFPProcessingProgress.tsx
git commit -m "$(cat <<'EOF'
feat: Enhance error display in progress modal with actionable guidance

Add visual callout when SAM.gov URL errors contain suggested
alternatives, guiding users on how to proceed.
EOF
)"
```

---

### Task 5: Add SAM.gov URL Validation Helper for URL Input

**Files:**
- Modify: `client/src/components/ActiveRFPsTable.tsx:36-50`
- Add URL validation helper

**Step 1: Add client-side validation for SAM.gov workspace URLs**

Add validation function and state updates to `ActiveRFPsTable.tsx`:

```typescript
// Add after existing state declarations (around line 45)
const [samGovSuggestion, setSamGovSuggestion] = useState<string | null>(null);

// Add validation helper function
const validateSamGovUrl = (url: string): { isWorkspace: boolean; suggestedUrl: string | null } => {
  const workspaceMatch = url.match(
    /sam\.gov\/workspace\/contract\/opp\/([a-zA-Z0-9]+)\/view/i
  );
  if (workspaceMatch) {
    return {
      isWorkspace: true,
      suggestedUrl: `https://sam.gov/opp/${workspaceMatch[1]}/view`,
    };
  }
  return { isWorkspace: false, suggestedUrl: null };
};

// Update the URL input onChange handler (find the existing Input for manualRfpUrl)
// Add validation check:
const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const url = e.target.value;
  setManualRfpUrl(url);
  setManualRfpUrlError('');

  // Check for SAM.gov workspace URL
  const samValidation = validateSamGovUrl(url);
  if (samValidation.isWorkspace) {
    setSamGovSuggestion(samValidation.suggestedUrl);
    setManualRfpUrlError(
      'This is a workspace URL that requires authentication.'
    );
  } else {
    setSamGovSuggestion(null);
  }
};
```

**Step 2: Add UI component to show suggestion below input**

Add this after the URL input field in the dialog:

```typescript
{samGovSuggestion && (
  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-md">
    <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
      SAM.gov Workspace URL Detected
    </p>
    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
      Workspace URLs require authentication. Use the public URL instead:
    </p>
    <div className="flex items-center gap-2 mt-2">
      <code className="flex-1 p-2 bg-white dark:bg-gray-900 rounded text-xs break-all border">
        {samGovSuggestion}
      </code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setManualRfpUrl(samGovSuggestion);
          setSamGovSuggestion(null);
          setManualRfpUrlError('');
        }}
      >
        Use This URL
      </Button>
    </div>
  </div>
)}
```

**Step 3: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Run lint**

Run: `pnpm run lint`
Expected: No errors (or only pre-existing warnings)

**Step 5: Commit**

```bash
git add client/src/components/ActiveRFPsTable.tsx
git commit -m "$(cat <<'EOF'
feat: Add real-time SAM.gov workspace URL detection in form

Detect SAM.gov workspace URLs as user types and show inline
suggestion with one-click "Use This URL" button to auto-fill
the public URL format.
EOF
)"
```

---

### Task 6: Add Comprehensive Error Handling for Extraction Failures

**Files:**
- Modify: `server/services/proposals/manualRfpService.ts:99-121`

**Step 1: Improve error messages for failed extractions**

Update the error handling block in `processManualRfp`:

```typescript
// TC002 Timeout Fix: Skip fallback methods to avoid timeout
// Fallbacks can take minutes and cause 15-minute test timeout
if (!scrapingResult || !scrapingResult.rfp) {
  // Determine more specific error message based on URL pattern
  let errorMessage = 'Primary RFP extraction failed. This portal may not be supported yet.';
  let userMessage = 'Unable to extract RFP information from this URL.';

  // Check for SAM.gov specific issues
  if (input.url.includes('sam.gov')) {
    if (input.url.includes('/search')) {
      errorMessage = 'SAM.gov search URLs cannot be imported directly.';
      userMessage = 'Please navigate to a specific opportunity page and use that URL instead of a search results page.';
    } else if (!input.url.includes('/opp/') && !input.url.includes('/opportunities/')) {
      errorMessage = 'Invalid SAM.gov URL format.';
      userMessage = 'Please use a direct opportunity URL in the format: https://sam.gov/opp/{opportunity-id}/view';
    } else {
      errorMessage = 'Failed to extract SAM.gov opportunity data.';
      userMessage = 'The SAM.gov page could not be processed. This may be due to page structure changes or the opportunity being unavailable. Please verify the URL and try again.';
    }
  }

  progressTracker.updateStep(
    sessionId,
    'page_navigation',
    'failed',
    errorMessage
  );

  console.error(`[ManualRfpService] ${errorMessage}:`, input.url);

  progressTracker.failTracking(sessionId, userMessage);
  return {
    success: false,
    sessionId,
    error: errorMessage,
    message: userMessage + ' Supported portals: BeaconBid, Austin Finance, SAM.gov (public URLs only).',
  };
}
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add server/services/proposals/manualRfpService.ts
git commit -m "$(cat <<'EOF'
feat: Add contextual error messages for SAM.gov extraction failures

Provide specific, actionable error messages based on the type of
SAM.gov URL submitted (search, workspace, invalid format).
EOF
)"
```

---

### Task 7: Update API Route to Return suggestedUrl in Response

**Files:**
- Modify: `server/routes/rfps.routes.ts:265-295`

**Step 1: Pass suggestedUrl from service to API response**

Update the manual RFP route handler:

```typescript
// Process asynchronously in the background
manualRfpService
  .processManualRfp({ ...validationResult.data, sessionId })
  .then(async result => {
    if (result.success && result.rfpId) {
      // Create audit log for manual RFP addition
      await storage.createAuditLog({
        entityType: 'rfp',
        entityId: result.rfpId,
        action: 'created_manually',
        details: {
          url: validationResult.data.url,
          userNotes: validationResult.data.userNotes,
        },
      });
      console.log(`✅ Manual RFP processing completed: ${result.rfpId}`);
    } else {
      // Log the failure with details for debugging
      console.error(`❌ Manual RFP processing failed: ${result.error}`);
      if (result.suggestedUrl) {
        console.log(`💡 Suggested URL provided: ${result.suggestedUrl}`);
      }
    }
  })
  .catch(error => {
    console.error('Error in background RFP processing:', error);
  });
```

Note: The current implementation returns immediately with sessionId, so the suggestedUrl needs to come through the SSE progress stream for synchronous workspace URL detection. The early detection in Task 2 handles this before async processing begins.

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add server/routes/rfps.routes.ts
git commit -m "$(cat <<'EOF'
chore: Add logging for suggested URL in manual RFP route
EOF
)"
```

---

### Task 8: Run Full Integration Test

**Files:**
- No file changes (verification only)

**Step 1: Start the development server**

Run: `pnpm run dev` (in a separate terminal)

**Step 2: Test SAM.gov workspace URL**

1. Navigate to the Active RFPs page
2. Click "Manual RFP" button
3. Enter: `https://sam.gov/workspace/contract/opp/abc123/view`
4. Verify:
   - [ ] Warning appears below input field
   - [ ] Suggested public URL is shown
   - [ ] "Use This URL" button works
   - [ ] After clicking button, URL field updates

**Step 3: Test submission with workspace URL**

1. Submit without clicking "Use This URL"
2. Verify:
   - [ ] Progress modal opens
   - [ ] Error is displayed with suggested URL
   - [ ] Toast notification shows suggested URL

**Step 4: Test with public URL**

1. Enter: `https://sam.gov/opp/abc123/view`
2. Submit
3. Verify:
   - [ ] No workspace warning appears
   - [ ] Processing attempts to scrape (may fail if invalid ID, but shouldn't fail with workspace error)

**Step 5: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass

**Step 6: Run type check and lint**

Run: `pnpm run type-check && pnpm run lint`
Expected: No errors

---

### Task 9: Final Commit and Push

**Step 1: Review all changes**

Run: `git status && git diff --stat HEAD~8`

**Step 2: Push to remote**

Run: `git push origin main`

**Step 3: Verify deployment (if applicable)**

Check Fly.io deployment or staging environment.

---

## Summary of Changes

| File | Change |
|------|--------|
| `server/services/mastra/utils/urlValidation.ts` | Add workspace URL detection with suggested public URL |
| `server/services/proposals/manualRfpService.ts` | Early workspace URL detection, improved error messages |
| `server/routes/rfps.routes.ts` | Logging improvements |
| `client/src/components/ActiveRFPsTable.tsx` | Real-time URL validation, suggestion UI |
| `client/src/components/RFPProcessingProgress.tsx` | Enhanced error display |

## Testing Checklist

- [ ] SAM.gov workspace URL detected in form input
- [ ] Suggested public URL shown with "Use This URL" button
- [ ] Form auto-fills with suggested URL when button clicked
- [ ] Backend returns proper error for workspace URLs
- [ ] Progress modal shows error with guidance
- [ ] Toast shows suggested URL on error
- [ ] Public SAM.gov URLs still work correctly
- [ ] Other portal URLs unaffected
- [ ] All existing tests pass
- [ ] No TypeScript errors
- [ ] No lint errors
