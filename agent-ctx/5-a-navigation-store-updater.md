# Task 5-a: Navigation & Store Updater

## Summary
Updated the Zustand store ViewName types and app-layout navigation to support admin sub-pages, profile, action inbox, and change requests.

## Changes Made

### 1. /src/store/app-store.ts
- Added 19 new ViewName types: admin, admin-users, admin-roles, admin-departments, admin-approval-workflows, admin-notification-rules, admin-smtp, admin-email-templates, admin-email-logs, admin-github, admin-ai-settings, admin-prompt-studio, admin-document-numbers, admin-system-settings, admin-audit-logs, admin-jobs, admin-github-logs, profile, action-inbox, change-requests
- Total ViewName types: 18 → 37

### 2. /src/components/app-layout.tsx
- Updated NAV_ITEMS: 10 → 12 items (added Action Inbox, Changes, Admin; removed AI Intake from main nav)
- Added ADMIN_NAV_ITEMS: 15 admin sub-navigation items with proper icons
- Updated icon imports: added Inbox, GitPullRequest, Settings, Users, Building, CheckSquare, Mail, FileCode, ScrollText, Github, Bot, Hash, FileSearch, Clock, ChevronDown
- Sidebar: shows ADMIN_NAV_ITEMS collapsible section when in admin views, collapsed mode shows Settings shortcut
- activeNavKey: handles 'change-requests' and 'admin*' prefix views
- Breadcrumbs: added all new view labels with admin hierarchy (Admin > sub-page)
- renderView: added 19 new cases (admin sub-pages use PlaceholderView, admin-prompt-studio redirects to PromptsPage)
- Profile dropdown: Profile → 'profile', Action Inbox → 'action-inbox', separator, Log out

## Lint
PASSED with zero errors
