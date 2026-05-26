# Task 9-c: Request and AI Intake Pages

## Agent: Page Component Developer

## Work Summary
Created 4 page components for the Enterprise AI Workflow Platform's Request and AI Intake modules, and integrated them into the app layout.

## Files Created

### 1. `/home/z/my-project/src/components/pages/requests-page.tsx`
- Comprehensive request management page with:
  - Header showing request count with "New Request" and "AI Intake" buttons
  - Filter bar with Status, Type, Priority dropdowns and Search input
  - Full table with columns: Code, Title, Type, Priority, Status, Project, Assigned To, Created, Actions
  - Color-coded badges for Type (FEATURE=green, BUG=red, etc.), Priority (LOW=gray, URGENT=red), Status (workflow colors)
  - Row click navigation to request-detail
  - Pagination with prev/next buttons
  - API integration: GET /api/requests with filter params

### 2. `/home/z/my-project/src/components/pages/request-create-page.tsx`
- Request creation form with:
  - All form fields: Title, Description, Type, Priority, Project, Affected System, Business Impact, Acceptance Criteria, Due Date
  - "Save as Draft" button (POST /api/requests then stays in DRAFT)
  - "Submit" button (POST /api/requests + POST /api/requests/[id]/submit)
  - "AI Assist" button (POST /api/ai/request-intake/generate-draft) - auto-fills form fields with toast notification
  - Sidebar with action buttons and AI Assist info
  - Pre-population from AI Intake via viewParams.draft
  - Back button navigates to 'requests'

### 3. `/home/z/my-project/src/components/pages/request-detail-page.tsx`
- Detailed request view with:
  - Two-column layout (desktop) / single column (mobile)
  - Left column: request header with badges, status workflow timeline (horizontal stepped circles), description, acceptance criteria, business impact sections
  - Tabs: Comments, History, AI
    - Comments: list with avatars, add comment form, POST to /api/requests/[id]/comments
    - History: status change timeline with from/to badges
    - AI: "Get AI Recommendation" button calling POST /api/requests/[id]/workflow/next-action
  - Right sidebar: Details card, Assigned People card (BA/Dev/QA with avatars and assign buttons), Action buttons
  - Status-based actions: DRAFT→Submit, SUBMITTED→Approve/Reject, APPROVED→Assign BA, ASSIGNED→Assign Dev, IN_DEVELOPMENT→Assign QA
  - Dialogs: Reject (with comment), Assign User (with user select)
  - Fetches users from /api/users with role filter for assignment

### 4. `/home/z/my-project/src/components/pages/ai-intake-page.tsx`
- AI-powered request intake chat interface with:
  - Split layout: Left chat area, Right preview panel
  - Chat: user messages right-aligned, AI messages left-aligned with Bot/User icons
  - Initial AI greeting message
  - On message: calls POST /api/ai/request-intake/classify then POST /api/ai/request-intake/generate-draft
  - AI classification displayed with type/priority/affected system badges and confidence score
  - Follow-up questions shown when missing info detected
  - Preview panel: generated draft with title, description, type, priority, affected system, business impact, acceptance criteria
  - Missing fields highlighted in yellow with alert icon
  - "Create Request" button (POST /api/requests)
  - "Edit & Submit" button (navigates to request-create with draft data)
  - Loading indicator while AI processes

### 5. Modified `/home/z/my-project/src/components/app-layout.tsx`
- Added imports for all 4 new page components
- Replaced placeholder functions with actual component renders
- No breaking changes to existing navigation or layout

## Technical Notes
- All components are 'use client' components
- Use shadcn/ui components from @/components/ui/
- Use lucide-react for icons
- Import store from @/store/app-store
- Import API from @/lib/api-client
- Toast notifications via sonner
- Lint passes cleanly with no errors
- Dev server compiles successfully
