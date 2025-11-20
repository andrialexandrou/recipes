# Changelog

All notable changes to the Sous recipe manager.

## 2025-11-20

### GA Launch - Following/Followers & Modal System

**Following/Followers List View:**
- Tabbed modal dialog showing Following and Followers lists in one view
- Opens when clicking follower/following counts on any profile
- Each tab shows user avatars, usernames, bios
- Follow/unfollow buttons directly in modal (except for own account)
- Click username to navigate to that user's profile
- Single optimized endpoint `/api/users/:username/connections` returns both lists in one request
- Efficient batch fetching: combines unique user IDs, removes duplicates, fetches all in parallel

**Reusable Modal System (ModalUtils):**
- Created `ModalUtils` utility for consistent modal behavior across entire app
- Automatic focus trapping (Tab cycles within modal)
- Escape key closes modal
- Click overlay to close modal
- Auto-focus first focusable element
- Refactored all existing modals to use ModalUtils:
  - Debug modal (index.html)
  - Follow modal (index.html)
  - Password change modal (settings.html)
  - Delete account modal (settings.html)
- Removed ~200 lines of duplicate modal handling code
- Consolidated CSS: removed old `.modal` and `.settings-modal-*` classes
- All modals now use shared `.modal-overlay`, `.modal-content`, `.modal-header`, `.modal-body` styles

**Public Changelog Page:**
- Created user-facing "What's New" page at `/changelog.html`
- Accessible from navbar menu (renamed from "Changelog" to "What's New" with sparkles icon)
- User-friendly language focused on benefits, not technical details
- Visual indicators for new features, improvements, and fixes
- Organized by date with "Coming Soon" section
- Responsive design, mobile-optimized
- Easy to update by editing HTML file

**Files Modified:**
- `public/index.html` - Follow modal HTML with tabs, changelog menu link
- `public/changelog.html` - New public changelog page
- `public/settings.html` - Refactored to use ModalUtils, added ModalUtils code
- `public/styles.css` - Consolidated modal styles, removed duplicates (~130 lines removed)
- `public/app.js` - ModalUtils utility, follow modal functions, updated all modal usage
- `server.js` - Single optimized `/api/users/:username/connections` endpoint
- `agents.md` - Documented Modal System pattern
- `backlog.md` - Marked all GA blockers as complete

## 2025-11-19

### Quick Wins & UI Polish

**Empty Feed State:**
- Added clean empty state for activity feed with emoji, heading, and description
- "Explore Users" CTA button navigates to search page
- Mobile-responsive padding (reduced on narrow screens)
- Removed sample activity cards for cleaner experience

**Page Load Optimization:**
- Fixed visual jitter on page load
- All views now start hidden instead of showing profile by default
- Single render pass eliminates profile skeleton → sidebar → feed flash
- `loadFromURL()` determines correct view based on URL

**Profile Follow Button:**
- Implemented follow/unfollow toggle on user profiles
- Button state managed via CSS class (`.following`) matching search results pattern
- Server endpoint updated to return `uid` field needed for follow functionality
- Follower count updates immediately after toggle
- Button hidden on own profile or when logged out

**Profile UI Cleanup:**
- Removed + icon buttons from all three profile tabs (Recipes, Collections, Menus)
- Cleaner layout with more vertical space for content
- Users can still create content from navbar menu

**Files Modified:**
- `public/index.html` - homeView starts hidden, removed + buttons, empty feed state
- `public/styles.css` - Mobile padding for feed empty, profile adjustments
- `public/app.js` - loadAllData() cleanup, follow button logic with extensive logging
- `server.js` - GET /api/:username/user now returns uid and isStaff fields

**Documentation:**
- `agents.md` - Added sections 21-24 for quick wins
- `FEATURES.md` - New file with all feature documentation
- `TESTING.md` - New file with test scenarios
- `README.md` - Updated with better project overview

### User Account Settings Page

**Comprehensive settings interface for account management and privacy control:**

**Features Implemented:**
- New `/settings` page accessible from navbar dropdown menu
- Account information section displaying username (read-only) and email
- Email address updates with Firebase Auth integration
- Password change functionality with modal workflow and current password verification
- Privacy controls: Search visibility toggle (isSearchable field)
- Account deletion with confirmation modal and password verification
- Responsive design for mobile and desktop
- Back button to return to main app

**Security:**
- Firebase ID token verification for all settings endpoints
- Re-authentication required for password changes
- Password confirmation required for account deletion
- Server-side validation and error handling
- Comprehensive data deletion on account deletion:
  - All recipes, collections, menus deleted
  - All photos removed from Firebase Storage
  - All activities and feeds cleaned up
  - User removed from all followers/following relationships
  - User document and Firebase Auth account deleted

**Files Modified:**
- `public/settings.html` - New settings page with modals and forms
- `public/styles.css` - Settings page styling (`.settings-*` classes)
- `public/index.html` - Settings link in navbar dropdown
- `server.js` - Three new endpoints: GET/PUT `/api/user/settings`, DELETE `/api/user/delete`

**Documentation:**
- `agents.md` - Added section 14: User Account Settings
- `backlog.md` - Moved feature from GA Blockers to Recently Completed

## 2025-11-17

### Fixed Sidebar Recipe Navigation on Cross-User Profiles

**Bug fix for broken sidebar recipe links when viewing other users' profiles:**

- Fixed sidebar recipe click handlers to properly navigate when viewing another user's profile
- Now correctly switches context by setting `API.viewingUser`, reloading data via `loadAllData()`, then calling `loadFromURL()`
- Fixed variable references: using `State.authenticatedUserRecipes` and `State.currentCollectionId` instead of undefined variables
- Sidebar recipe links now work consistently whether viewing your own profile or someone else's
- URL bar updates correctly and recipe content loads as expected

**Files Modified:**
- `public/app.js` - Fixed click and keydown event handlers in `renderRecipeList()`

## 2025-11-16

### Sidebar Always Shows Authenticated User Content

**Major architectural change to improve UX and eliminate confusion:**

- **Sidebar recipe list now always displays YOUR recipes**, regardless of whose profile you're viewing in the main content area
- Added separate data contexts:
  - `State.authenticatedUserRecipes` - Always contains logged-in user's recipes (for sidebar)
  - `State.viewingUserRecipes` - Contains profile owner's recipes (for main content)
- Created new API method `getAuthenticatedUserRecipes()` to fetch logged-in user's recipes separately
- Modified `loadAllData()` to fetch both contexts in parallel for optimal performance
- Updated `renderRecipeList()` to always render from authenticated user's recipes
- Clicking a recipe in the sidebar now switches context back to your profile if viewing someone else's
- Updated sidebar header to show authenticated user (your avatar, username, and follow stats)
- Removed follow/unfollow button from sidebar (not needed since it's always your profile)
- Updated search placeholder: "Search your recipes..." (instead of "Search recipes...")
- Recipe CRUD operations properly update both recipe arrays when appropriate
- Sidebar user info is now a clickable link that navigates to your home page

**Files Modified:**
- `public/app.js` - State management, API methods, data loading, sidebar rendering
- `public/index.html` - Sidebar structure and element IDs
- `agents.md` - Updated architecture documentation

### Activity Feed Navigation & URL Fixes

- Fixed activity feed links to use full entity slugs with IDs (e.g., `bouillabaisse-x1ZTk7SGVo0O7RfIE3ve`)
- Removed inline onclick handlers in favor of proper event delegation for cleaner code
- Activities now use entity's original `createdAt` timestamp instead of activity creation time
- Feed shows proper relative dates ("2 days ago", "3 weeks ago") instead of all "just now"
- Added `createdAt` timestamp to collections on creation
- Server now passes entity creation dates when creating activities for accurate feed chronology

### UI Bug Fixes

- Fixed navbar user menu dropdown not opening (CSS specificity issue with `#navMenuBtn`)
- Fixed debug modal HTML structure (was malformed, missing close button and proper nesting)
- Moved inline styles from HTML to CSS for better maintainability
- Replaced navbar hamburger menu with user avatar button (Gravatar with initials fallback)

### Activity Cleanup & Data Management

- Activities automatically removed from all followers' feeds when content is deleted
- Activities removed from feeds when user unfollows content creator
- Server properly cleans up both master activities collection and user feed subcollections

### Migration Scripts (in `/scripts` directory)

- `reset-activity-published-flags.js` - Reset flags to allow activity regeneration
- `clear-feed.js` - Clear all activities from master collection and all user feeds
- `regenerate-all-activities.js` - Regenerate all activities with correct slugs and timestamps
- `add-collection-created-dates.js` - Add createdAt dates to existing collections (defaults to 7 days ago)
- `migrate-users-for-follows.js` - Migrate user data for follow system
- `reset-follows.js` - Reset all follow relationships and feeds
- `fix-activity-slugs.js` - Fix entitySlug format in existing activities
- Added npm scripts for all utilities (e.g., `npm run script:clear-feed`)

### Public Content Viewing (Logged-Out Experience)
- Enabled viewing any user's recipes, collections, and menus without requiring login
- Added `Sign In` button to navbar for logged-out users (replaces menu dropdown)
- Modified authentication flow to allow username-prefixed URLs (`/{username}/...`) without redirect
- Added server endpoint `/api/:username/user` to fetch user info for Gravatar rendering
- Fixed Gravatar rendering for logged-out users (uses server API instead of Firestore client SDK)
- Added 404 page for non-existent users with clean error messaging
- Hidden sidebar on 404 page for cleaner presentation
- Keyboard shortcuts (N for new recipe, E for edit) disabled when logged out or viewing other users' content
- Edit/delete/create buttons automatically hidden when viewing other users' content
- Improved avatar loading with skeleton color matching to prevent visual flash

## 2025-11-12

### WYSIWYG Markdown Editor
- Implemented EasyMDE for visual markdown editing with toolbar buttons
- Added toolbar with bold, italic, strikethrough, headings (H1-H3), lists, links, images, preview, fullscreen, and guide
- Styled editor to match website aesthetic with warm neutral palette and Georgia serif font
- Added prominent 2px border around editor for clear visual separation
- Configured markdown syntax highlighting in editor to match preview styles
- Hidden preview content below editor during edit mode for focused editing experience
- Integrated with both recipe and menu editing workflows

### Layout & UI Improvements
- Refactored recipe layout from absolute positioning to flexbox for cleaner, more maintainable code
- Fixed collections menu to scroll with content and position intelligently (viewport-aware)
- Fixed user menu alignment in navbar dropdown
- Added PWA support (manifest.json + meta tags) for standalone home screen app experience

### Firebase Connection Error UI
- Added dismissible banner that appears when server/Firebase connection fails
- Banner shows helpful message without blocking user interaction
- Automatically appears on API errors or connection failures

### Quick Wins Batch Implementation
- Reordered home view to show menus section before collections section
- Added author display (@username) at top of recipe metadata
- Removed recipe count from menu cards for cleaner appearance
- Fixed auth page centering with :has() selector to override body flexbox
- Fixed metadata clearing when creating new recipe

## 2025-11-11

### Major UI Refactoring
- Removed floating action buttons completely
- Replaced with inline icon-only metadata buttons for cleaner, more integrated design
- Built Spotify-style collections dropdown with search and "New collection" button
- Fixed multiple console errors (undefined function references)
- Removed menus from recipe metadata display

### Code Quality
- Organized code into modules (State, DOM, SkeletonUI, CONSTANTS)
- Extracted helper functions for better organization
- Added JSDoc comments for type hints and documentation
- Removed duplicate code

### Loading & Empty States
- Added skeleton loading for sidebar user avatar and recipe list
- Added first-time user onboarding banner with CTA buttons
- Added skeleton loading UI with shimmer effect
- Added empty state messages for collections/menus
- Added avatar loading placeholders

### UX Improvements
- Added sidebar collapse state persistence with localStorage
- Added print styles for complete PDF output of recipes and menus
- Navigate to home after entity deletion
- Update URLs after saving entities
- Removed "No description" placeholder text for cleaner cards

### Permissions & Access Control
- Added `isStaff` user field
- Debug menu only visible to staff users
- Extended permission-based UI to collections/menus list and detail views
- Made sidebar username/avatar clickable link to user's home page
- Hidden "Add to Collection" button when viewing other users' recipes
- Added permission-based UI (read-only mode when viewing other users' content)

### Bug Fixes
- Fixed URL persistence and navigation bugs in multi-user architecture
- Fixed Gravatar lookup to fetch viewing user's email from Firestore

### Authentication & Multi-User
- Added Firebase Authentication (email/password + Google Sign-In)
- Implemented userId-based data architecture
- Multi-user support with data isolation
- Gravatar integration
- Navbar redesign
- Photo migration to new structure

### Features
- Added menus feature with full CRUD operations
- Added paste-to-upload image functionality with Firebase Storage
- Initial collections implementation

## Earlier

- Core recipe management functionality
- Firebase integration
- Markdown support
- Basic CRUD operations
