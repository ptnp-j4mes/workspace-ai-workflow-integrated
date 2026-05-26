# Task 2 - Activity Daily API Routes

## Task: Create Activity Daily API routes

## Work Log:
- Created `/src/app/api/activity-daily/route.ts` - Main CRUD endpoint:
  - **GET**: List activity daily records with filtering (userId, dateFrom, dateTo, status, page, limit)
  - Includes user info (name, email, avatarUrl, department) in response
  - Returns paginated results with summary stats (totalReports, totalWorkHours, totalAiHours, avgAiUsagePercentage, kpiMetCount, totalCommits)
  - Parses projectEntries JSON for each record
  - **POST**: Create or update activity daily record using upsert on (userId, date) unique constraint
  - Auto-calculates `aiUsagePercentage = (aiUsageHours / totalWorkHours) * 100`
  - Auto-calculates `kpiMet = aiUsagePercentage >= kpiTargetPercentage`
  - Default `kpiTargetPercentage = 25`
  - Stringifies projectEntries when writing, counts commits from entries

- Created `/src/app/api/activity-daily/[id]/route.ts` - Single record operations:
  - **GET**: Get single activity daily record by ID, include user info and approver info
  - **PATCH**: Update activity daily record with status changes (SUBMITTED/APPROVED)
  - Approval logic: sets approvedById/approvedAt when status → APPROVED, clears when reverting
  - Recalculates derived fields (aiUsagePercentage, kpiMet) when work hours or AI hours change
  - **DELETE**: Delete activity daily record by ID

- Created `/src/app/api/activity-daily/git-summary/route.ts` - Git commit summary:
  - **GET**: Auto-generate activity summary from git commits for a user on a given date
  - Query params: userId, date
  - Looks up user's GitHub connections and project repos
  - Finds GithubCommit records matching user's email/name on the target date
  - Groups commits by project and returns structured data
  - Returns: `{ commitCount, commitSummary, projectEntries }` where:
    - `commitSummary` is formatted text like "5 commits across 2 projects: AIT2605-001 (3 commits: fix login, add feature X), AIT2605-002 (2 commits: update API)"
    - `projectEntries` is a JSON array with projectId, projectName, hours, aiHours, tasks, commitCount, commitMessages
  - Returns empty valid structure if no commits found

- Created `/src/app/api/activity-daily/cto-report/route.ts` - CTO Report aggregation:
  - **GET**: CTO daily/weekly activity report
  - Query params: dateFrom, dateTo, department (defaults to last 7 days)
  - Returns comprehensive aggregated data:
    - `summary`: totalReports, totalWorkHours, totalAiHours, avgAiUsagePercentage, kpiMetCount, kpiMetRate, totalCommits
    - `byUser`: Per-user aggregation with dailyEntries, avgAiUsagePercentage, kpiMetCount/NotMetCount
    - `byDepartment`: Department-level aggregation with userCount, avgAiUsagePercentage, kpiMetRate
    - `dailyTrend`: Day-by-day trend with avgAiUsagePercentage, kpiMetRate, commitCount
    - `aiUsageDistribution`: Count of reports in 10% buckets (0-10%, 11-20%, ..., 91-100%)
  - Uses department filter via user lookup when specified
  - All numeric values rounded to 2 decimal places

- Ran `bun run lint` — passed with no errors

## Stage Summary:
- 4 API route files created for Activity Daily feature
- Full CRUD with upsert on (userId, date) unique constraint
- Auto-calculation of aiUsagePercentage and kpiMet
- Git commit summary generation from GithubCommit records
- Comprehensive CTO report with multi-dimensional aggregation
- Key files created:
  - `src/app/api/activity-daily/route.ts` - Main CRUD (GET + POST)
  - `src/app/api/activity-daily/[id]/route.ts` - Single record (GET + PATCH + DELETE)
  - `src/app/api/activity-daily/git-summary/route.ts` - Git commit summary (GET)
  - `src/app/api/activity-daily/cto-report/route.ts` - CTO report aggregation (GET)
