# Task 6: Refactor Sidebar to Load Menus Dynamically from Database

## Changes Made

### 1. `/home/z/my-project/src/store/app-store.ts`
- Added `menuVersion: number` (initial: 0) and `incrementMenuVersion: () => void` to AppState interface and store implementation
- This counter is used to trigger sidebar re-fetches when menus change in the admin panel

### 2. `/home/z/my-project/src/components/app-layout.tsx`
- **Removed** hardcoded `NAV_ITEMS` and `ADMIN_NAV_ITEMS` arrays
- **Added** `MenuParent` and `MenuChild` types matching the API response
- **Added** `ICON_MAP` and `getIcon()` function to map string icon names from DB to Lucide icon components
- **Added** menu fetching logic:
  - `fetchMenus()` callback fetches from `/api/menus/user` on mount and when `menuVersion` changes
  - Local state: `menus`, `menusLoading`, `menusError`, `expandedMenuKeys`
  - Uses `hasMenusRef` to avoid `useCallback` dependency on `menus.length`
  - Fallback to Dashboard-only menu if API fails
  - Retry button shown when fetch errors occur
- **Dynamic sidebar rendering**:
  - Lv1 items without children: simple nav buttons (same as before)
  - Lv1 items WITH children: expandable toggle with ChevronDown animation
  - Lv2 items shown indented with border-l when parent is expanded
  - Badge support from database
  - Active state matching: currentView matches menu.view or is a child of parent menu
- **Expanded state tracking**: `expandedMenuKeys` Set, initialized from `isExpanded` field in DB, preserved on re-fetch
- **Breadcrumb**: Updated `getBreadcrumbItems` to accept dynamic menus parameter for admin sub-item parent lookup
- **All existing functionality preserved**: sidebar collapse/expand, mobile sidebar, tooltips, search, notifications, theme toggle, user dropdown, footer

### 3. `/home/z/my-project/src/components/pages/admin-menus-page.tsx`
- Added import of `useAppStore` from `@/store/app-store`
- Added `useAppStore.getState().incrementMenuVersion()` after every successful CRUD operation:
  - After `handleSave` success
  - After `handleDelete` success
  - After `handleToggleVisibility` success
  - After `handleResetOrder` success
  - After `handleDrop` (drag-and-drop reorder) success

## Flow
1. App loads → sidebar fetches menus from `/api/menus/user`
2. Admin changes menus in Menu Management → `incrementMenuVersion()` called
3. `menuVersion` change triggers sidebar re-fetch → menus update dynamically
4. If API fails → fallback to Dashboard-only menu with retry button
