# Task 4-5: Project and Request API Modules

## Agent: API Developer
## Task: Build all API routes for the Enterprise AI Workflow Platform

### Work Summary

Created all backend API routes for the platform, covering Projects, Requests, Work Items, Bugs, UAT, Meetings, Dashboard, Notifications, and Users modules. Also created the `ai-service.ts` helper for AI prompt execution.

### Files Created

#### Core Library
1. `/home/z/my-project/src/lib/ai-service.ts` - AI service helper using z-ai-web-dev-sdk

#### Project API (3 files)
2. `/home/z/my-project/src/app/api/projects/route.ts` - GET (list with status filter, member/request counts), POST (create with auto createdById)
3. `/home/z/my-project/src/app/api/projects/[id]/route.ts` - GET (detail with members, counts), PATCH (update)
4. `/home/z/my-project/src/app/api/projects/[id]/members/route.ts` - POST (add member), DELETE (remove member)

#### Request API (11 files)
5. `/home/z/my-project/src/app/api/requests/route.ts` - GET (list with filters & pagination), POST (create with auto code generation REQ-YYYY-NNNN and initial status history)
6. `/home/z/my-project/src/app/api/requests/[id]/route.ts` - GET (detail with comments, attachments, status history, work items), PATCH (update, DRAFT-only or ADMIN)
7. `/home/z/my-project/src/app/api/requests/[id]/submit/route.ts` - POST (DRAFT → SUBMITTED)
8. `/home/z/my-project/src/app/api/requests/[id]/approve/route.ts` - POST (SUBMITTED → APPROVED)
9. `/home/z/my-project/src/app/api/requests/[id]/reject/route.ts` - POST (SUBMITTED → REJECTED, comment required)
10. `/home/z/my-project/src/app/api/requests/[id]/assign-ba/route.ts` - POST (assign BA, APPROVED → ASSIGNED)
11. `/home/z/my-project/src/app/api/requests/[id]/assign-dev/route.ts` - POST (assign Dev, ASSIGNED → IN_DEVELOPMENT)
12. `/home/z/my-project/src/app/api/requests/[id]/assign-qa/route.ts` - POST (assign QA, IN_DEVELOPMENT → QA)
13. `/home/z/my-project/src/app/api/requests/[id]/comments/route.ts` - GET (list), POST (add)
14. `/home/z/my-project/src/app/api/requests/[id]/history/route.ts` - GET (status history)
15. `/home/z/my-project/src/app/api/requests/[id]/workflow/next-action/route.ts` - POST (AI recommendation via workflow.next_action prompt)
16. `/home/z/my-project/src/app/api/requests/[id]/workflow/transition/route.ts` - POST (transition with validation against workflow rules and role permissions)

#### Work Items API (5 files)
17. `/home/z/my-project/src/app/api/work-items/route.ts` - GET (list with filters), POST (create with initial status history)
18. `/home/z/my-project/src/app/api/work-items/[id]/assign/route.ts` - POST (assign user with role)
19. `/home/z/my-project/src/app/api/work-items/[id]/accept/route.ts` - POST (accept assignment)
20. `/home/z/my-project/src/app/api/work-items/[id]/submit/route.ts` - POST (submit for review)
21. `/home/z/my-project/src/app/api/work-items/[id]/generate-handoff-note/route.ts` - POST (AI handoff via handoff.generate_note prompt, creates WorkItemHandoff record)

#### Bug API (2 files)
22. `/home/z/my-project/src/app/api/bugs/route.ts` - GET (list with filters), POST (create bug report)
23. `/home/z/my-project/src/app/api/ai/bugs/root-cause-analysis/route.ts` - POST (AI RCA via bug.root_cause_analysis prompt)

#### UAT API (3 files)
24. `/home/z/my-project/src/app/api/uat/cycles/route.ts` - GET (list), POST (create UAT cycle)
25. `/home/z/my-project/src/app/api/uat/test-cases/route.ts` - GET (list with filters), POST (create test case)
26. `/home/z/my-project/src/app/api/ai/uat/generate-test-cases/route.ts` - POST (AI test case generation via uat.generate_test_cases prompt)

#### Meeting API (5 files)
27. `/home/z/my-project/src/app/api/meetings/route.ts` - GET (list), POST (create meeting)
28. `/home/z/my-project/src/app/api/meetings/[id]/route.ts` - GET (detail with participants, transcripts, summaries, action items)
29. `/home/z/my-project/src/app/api/meetings/[id]/summarize/route.ts` - POST (AI summary via meeting.summary.ba_requirement + action items via meeting.action_items.extract)
30. `/home/z/my-project/src/app/api/meetings/[id]/summary/route.ts` - GET (latest summary)
31. `/home/z/my-project/src/app/api/meetings/[id]/action-items/route.ts` - GET (action items)

#### Dashboard API (3 files)
32. `/home/z/my-project/src/app/api/dashboard/workload/route.ts` - GET (workload by user, by project, overall stats)
33. `/home/z/my-project/src/app/api/dashboard/overdue/route.ts` - GET (overdue requests and work items)
34. `/home/z/my-project/src/app/api/ai/dashboard/workload-insight/route.ts` - POST (AI insight via dashboard.workload_insight prompt)

#### Notification & User API (3 files)
35. `/home/z/my-project/src/app/api/notifications/route.ts` - GET (user notifications with unread count)
36. `/home/z/my-project/src/app/api/notifications/[id]/read/route.ts` - POST (mark as read)
37. `/home/z/my-project/src/app/api/users/route.ts` - GET (list users for dropdowns, with role/department/search filters)

### Implementation Notes

- All routes use `getAuthUser` for authentication
- Dynamic route params use `await params` (Next.js 16 App Router pattern)
- Request code auto-generation: `REQ-YYYY-NNNN` format with incrementing counter
- Status history entries are created on all status transitions
- Workflow transitions validate against allowed paths and role permissions
- AI routes use `executePrompt` from `ai-service.ts` which handles prompt lookup, variable substitution, API calls, and result logging
- Meeting summarize endpoint saves transcript, summary (with structured fields), and extracted action items
- Work item assignments deactivate previous assignments for the same role before creating new ones
- All list endpoints support filtering; request list supports pagination
- Lint passes cleanly with no errors
