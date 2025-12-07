# AI Chat Page Crash Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the AI Agent page at `/ai-chat` which crashes on load with "Something went wrong" error by adding proper error handling for failed API queries.

**Architecture:** Add error state handling to useQuery hooks, implement loading states, add fallback UI for API failures, and ensure graceful degradation when the AI service is unavailable.

**Tech Stack:** TypeScript, React, TanStack Query, shadcn/ui components

---

## Problem Summary

When users visit `/ai-chat`, the page crashes with "Something went wrong" (React ErrorBoundary):

1. The `useQuery` hook for `/api/ai/conversations` fails (likely API endpoint error)
2. With `retry: false` in queryClient, the error is thrown immediately
3. The component tries to render `conversations?.map()` but the error propagates
4. React ErrorBoundary catches it and shows fallback error UI

**Root Cause Analysis:**

```typescript
// client/src/lib/queryClient.ts:57-70
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),  // Throws on 401
      retry: false,  // No retries - immediate failure
    },
  },
});

// client/src/pages/ai-chat.tsx:84-86
const { data: conversations } = useQuery({
  queryKey: ['/api/ai/conversations'],
  // Missing: isLoading, isError, error handling
});
```

**Key Issue:** The AI Chat component doesn't destructure or handle `isLoading`, `isError`, or `error` from useQuery, causing crashes when the API fails.

---

### Task 1: Add Error and Loading State Handling to useQuery Calls

**Files:**
- Modify: `client/src/pages/ai-chat.tsx:84-92`

**Step 1: Update the conversations query to include error/loading states**

Modify line 84-86 from:
```typescript
const { data: conversations } = useQuery({
  queryKey: ['/api/ai/conversations'],
});
```

To:
```typescript
const {
  data: conversations,
  isLoading: conversationsLoading,
  isError: conversationsError,
  error: conversationsErrorDetails,
} = useQuery({
  queryKey: ['/api/ai/conversations'],
});
```

**Step 2: Update the conversation history query similarly**

Modify lines 89-92 from:
```typescript
const { data: conversationHistory, refetch: refetchHistory } = useQuery({
  queryKey: ['/api/ai/conversations', currentConversationId],
  enabled: !!currentConversationId,
});
```

To:
```typescript
const {
  data: conversationHistory,
  refetch: refetchHistory,
  isLoading: historyLoading,
  isError: historyError,
} = useQuery({
  queryKey: ['/api/ai/conversations', currentConversationId],
  enabled: !!currentConversationId,
});
```

**Step 3: Run type check**

Run: `pnpm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add client/src/pages/ai-chat.tsx
git commit -m "$(cat <<'EOF'
feat(ai-chat): Add error and loading state destructuring to queries

Extract isLoading, isError, and error states from useQuery hooks
to enable proper error handling in the UI.
EOF
)"
```

---

### Task 2: Add Loading State UI for Conversations Sidebar

**Files:**
- Modify: `client/src/pages/ai-chat.tsx:441-503`

**Step 1: Add imports for Alert component if needed**

Add to imports at top of file:
```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCcw } from 'lucide-react';
```

**Step 2: Update the conversations sidebar to show loading state**

Find the ScrollArea for conversations (around line 441) and wrap the content with loading/error handling:

Before the existing conversations map (around line 443), add:
```typescript
{conversationsLoading && (
  <div className="text-center py-8">
    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">Loading conversations...</p>
  </div>
)}

{conversationsError && (
  <div className="p-4">
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed to load conversations</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm mb-3">
          {conversationsErrorDetails?.message || 'Unable to connect to AI service'}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] })}
        >
          <RefreshCcw className="h-3 w-3 mr-2" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  </div>
)}

{!conversationsLoading && !conversationsError && (
  // Existing conversations rendering code...
)}
```

**Step 3: Run type check**

Run: `pnpm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add client/src/pages/ai-chat.tsx
git commit -m "$(cat <<'EOF'
feat(ai-chat): Add loading and error UI for conversations sidebar

Display loading spinner while fetching conversations and show
error alert with retry button when API call fails.
EOF
)"
```

---

### Task 3: Add Error State UI for Main Chat Area

**Files:**
- Modify: `client/src/pages/ai-chat.tsx:526-680`

**Step 1: Add error state display for conversation history**

In the main chat area ScrollArea (around line 526), add error handling before the messages map:

```typescript
{historyError && currentConversationId && (
  <div className="p-4">
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed to load conversation</AlertTitle>
      <AlertDescription>
        <p className="text-sm mb-3">Unable to load this conversation's history.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetchHistory()}
        >
          <RefreshCcw className="h-3 w-3 mr-2" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  </div>
)}

{historyLoading && currentConversationId && (
  <div className="text-center py-8">
    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">Loading conversation...</p>
  </div>
)}
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/pages/ai-chat.tsx
git commit -m "$(cat <<'EOF'
feat(ai-chat): Add error handling for conversation history loading

Show loading state and error alert when fetching conversation
history fails, with retry functionality.
EOF
)"
```

---

### Task 4: Add Global Error Display for AI Service Unavailability

**Files:**
- Modify: `client/src/pages/ai-chat.tsx:424-426`

**Step 1: Add a banner for when AI service is completely unavailable**

At the beginning of the return statement (line 424), wrap the entire component with a service availability check:

```typescript
// Check if AI service appears to be down (both queries failed)
const aiServiceUnavailable = conversationsError && !conversationsLoading;

return (
  <div className="flex h-full flex-col">
    {/* AI Service Status Banner */}
    {aiServiceUnavailable && (
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            AI service is currently unavailable. Some features may not work.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] })}
          >
            <RefreshCcw className="h-3 w-3 mr-2" />
            Retry Connection
          </Button>
        </div>
      </div>
    )}

    <div className="flex flex-1 overflow-hidden">
      {/* Rest of existing layout */}
    </div>
  </div>
);
```

**Step 2: Run type check**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/pages/ai-chat.tsx
git commit -m "$(cat <<'EOF'
feat(ai-chat): Add service unavailability banner

Display a prominent banner when the AI service appears to be
down, with a retry connection button.
EOF
)"
```

---

### Task 5: Verify API Endpoint Returns Proper Error Responses

**Files:**
- Read: `server/routes/ai.routes.ts`

**Step 1: Check the conversations endpoint error handling**

Verify that `/api/ai/conversations` returns proper JSON error responses with appropriate status codes.

Run: `rg "conversations" server/routes/ai.routes.ts -A 10`

**Step 2: Add proper error response if missing**

Ensure the endpoint returns structured error responses:
```typescript
catch (error) {
  res.status(500).json({
    error: 'Failed to fetch conversations',
    message: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

**Step 3: Run type check**

Run: `pnpm run type-check`
Expected: PASS

**Step 4: Commit (if changes made)**

```bash
git add server/routes/ai.routes.ts
git commit -m "$(cat <<'EOF'
fix(api): Ensure AI routes return proper error responses
EOF
)"
```

---

### Task 6: Test the Fix Manually

**Step 1: Start the development server**

Run: `pnpm run dev`

**Step 2: Test scenarios**

1. **Normal load**: Visit `/ai-chat` - should load without crash
2. **API failure simulation**: Stop the server and refresh - should show error UI, not crash
3. **Retry functionality**: Click retry buttons - should attempt to refetch
4. **Conversation selection**: Select a conversation - should show loading then content or error

**Step 3: Verify no console errors**

Check browser console for any uncaught exceptions or React errors.

---

### Task 7: Run Full Test Suite and Lint

**Step 1: Run type check**

Run: `pnpm run type-check`
Expected: PASS

**Step 2: Run lint**

Run: `pnpm run lint`
Expected: PASS with only pre-existing warnings

**Step 3: Run tests if available**

Run: `pnpm test` (if tests exist)
Expected: PASS

---

### Task 8: Final Commit and Push

```bash
git push origin main
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `client/src/pages/ai-chat.tsx` | Add error/loading state destructuring from useQuery |
| `client/src/pages/ai-chat.tsx` | Add loading UI for conversations sidebar |
| `client/src/pages/ai-chat.tsx` | Add error UI with retry for conversations |
| `client/src/pages/ai-chat.tsx` | Add error UI for conversation history |
| `client/src/pages/ai-chat.tsx` | Add service unavailability banner |
| `server/routes/ai.routes.ts` | Ensure proper error responses (if needed) |

## Testing Checklist

- [ ] Page loads without crash when API is working
- [ ] Page shows error UI (not crash) when API fails
- [ ] Loading spinners appear during data fetch
- [ ] Retry buttons work and refetch data
- [ ] Service unavailability banner appears when AI service is down
- [ ] Type check passes
- [ ] Lint passes
- [ ] No React errors in console

## Technical Notes

- The fix leverages TanStack Query's built-in error/loading states
- Uses shadcn/ui Alert component for consistent error styling
- Maintains dark mode compatibility with existing patterns
- Retry functionality uses queryClient.invalidateQueries for fresh fetches
