# Task 2b: Update toast() calls to use contextual variants

## Summary
Updated all `toast()` calls across 11 page components + notification-toaster.tsx to use contextual variants (`success`, `warning`, `info`, `destructive`, `default`).

## Changes Made

### Variant Rules Applied
- **`variant: 'success'`** — create, update, delete, save, approve, generated, activated, rollback, exported, synced, transcribed
- **`variant: 'destructive'`** — kept as-is for all error/failure toasts
- **`variant: 'warning'`** — changed from 'destructive' for validation errors (required fields, invalid JSON)
- **`variant: 'info'`** — informational messages (refreshed, bot started/stopping, summarization started, Google connected/disconnected, git commits loaded, version deprecated)

### Files Updated (by count of changes)
| File | Changes | Details |
|------|---------|---------|
| activity-daily-page.tsx | 5 | Git Commits Loaded→info, No Commits Found→warning, Draft Saved/Submitted→success, Deleted→success, Approved→success |
| report-page.tsx | 1 | Refreshed→info |
| bugs-page.tsx | 4 | 2 validation errors→warning, Bug reported→success, RCA complete→success |
| uat-page.tsx | 4 | 2 validation errors→warning, UAT Cycle created→success, Test cases generated→success |
| meetings-page.tsx | 5 | validation→warning, Meeting created→success, Google Connected→info, Google Disconnected→info, Calendar Synced→success |
| maintenance-page.tsx | 2 | validation→warning, Agreement created→success |
| prompts-page.tsx | 2 | validation→warning, Prompt created→success |
| prompt-detail-page.tsx | 7 | Version saved→success, 2 Invalid JSON→warning, Version activated→success, Version deprecated→info, Rollback created→success, Test case created→success |
| work-items-page.tsx | 2 | validation→warning, Work item created→success |
| meeting-detail-page.tsx | 7 | Bot Started→info, Bot Stopping→info, Transcription Complete→success, Summarization started→info, Export Complete→success, Google Connected→info, Google Disconnected→info |
| notification-toaster.tsx | 1 | Added variant mapping to NOTIFICATION_STYLES (APPROVAL→success, BUG→destructive, SYSTEM→info, MENTION→info, ASSIGNMENT→info, DEFAULT→default) |

### Files Not Changed
- **calendar-page.tsx** — only has `variant: 'destructive'` error toasts, no changes needed
- **admin-menus-page.tsx** — already updated per task instructions

## Verification
- `bun run lint` passed with no errors
- All toast calls now have a variant property (either explicitly set or inherited from existing 'destructive')
