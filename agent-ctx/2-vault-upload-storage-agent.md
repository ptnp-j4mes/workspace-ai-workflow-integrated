# Task 2 - Vault File Upload & Storage Settings

## Summary
Added file upload capability to the Memory Vault feature and storage configuration settings to System Settings.

## Changes Made

### 1. Prisma Schema (`prisma/schema.prisma`)
- Added `VaultAttachment` model:
  - `nodeId` (nullable) - null = project-level attachment
  - `projectId` (required) - direct link to project
  - `fileName`, `originalName`, `fileUrl`, `fileSize`, `mimeType`, `storageType`
  - Relations to `VaultNode?`, `Project`, `User?`
- Added `attachments VaultAttachment[]` to `VaultNode` model
- Added `attachments VaultAttachment[]` to `Project` model
- Added `vaultAttachments VaultAttachment[]` to `User` model

### 2. Database Migration
- Ran `bun run db:push` - schema applied successfully

### 3. Storage Settings Seed (`prisma/seed-storage-settings.ts`)
- Seeded 6 STORAGE category settings:
  - UPLOAD_MODE, UPLOAD_LOCAL_PATH, UPLOAD_API_URL, UPLOAD_API_KEY, UPLOAD_MAX_SIZE_MB, UPLOAD_ALLOWED_TYPES

### 4. Settings Service (`src/lib/services/settings-service.ts`)
- Added `getRawSetting()` function for reading secret values without masking

### 5. Upload API Route (`src/app/api/projects/[id]/vault/upload/route.ts`)
- POST: File upload with LOCAL/API mode support, file size validation, VaultAttachment DB record, auto-embed in node content
- GET: List attachments filtered by project or node

### 6. Lint: Passed with no errors
