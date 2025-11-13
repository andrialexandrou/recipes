# Changelog

All notable changes to the Sous recipe manager.

## 2025-11-12

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
