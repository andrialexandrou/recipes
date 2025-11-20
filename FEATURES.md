# Feature Documentation

Detailed documentation for all features in Sous.

## Core Features

### 1. Recipe Management

**Status: ✅ Complete**

- Create/edit/delete recipes using Markdown
- WYSIWYG toolbar with EasyMDE for markdown editing
- Auto-save on edit
- Full preview with marked.js rendering
- Metadata tracking (created, updated dates)
- Slug-based URLs: `/{username}/recipe/alabama-white-sauce-ABC123`
- Edit/view mode toggle
- Share dropdown with copy link and copy content options
- Toolbar buttons: bold, italic, strikethrough, headings, lists, links, images, preview, fullscreen

**Key Files:**

- `public/app.js` - Recipe CRUD operations, EasyMDE initialization, share functionality
- `server.js` - `/api/:username/recipes` endpoints

### 2. Collections System

**Status: ✅ Complete**

- Group recipes into collections
- Add/remove recipes from collections
- Pre-populated collections (Freezer Friendly, Healthy Treats, etc.)
- Collection detail view with recipe cards
- Copy link functionality for collections (list view and detail view)
- Metadata shows which collections contain each recipe (as clickable anchor tags)
- Edit collection name/description without affecting recipe list (server uses partial updates)

**Key Files:**

- `public/app.js` - Collection rendering and management
- `server.js` - `/api/:username/collections` endpoints with partial update support

### 3. Menus Feature

**Status: ✅ Complete**

- Create curated menus with Markdown content
- WYSIWYG toolbar with EasyMDE for markdown editing
- Optional description field
- Reference recipes within menus
- Edit/view mode toggle
- Share dropdown with copy link and copy content options
- Metadata tracking

**Key Files:**

- `public/app.js` - Menu CRUD operations, EasyMDE initialization, share functionality
- `server.js` - `/api/:username/menus` endpoints

### 4. Image Upload (Paste-to-Upload)

**Status: ✅ Complete**

**Philosophy:** No upload buttons or modals - just paste images directly into the Markdown editor.

- Detect paste events with images
- Client-side compression (max 1200px width, 80% quality, JPEG)
- Upload to Firebase Storage at `photos/{username}/{photoId}.jpg`
- Fallback to base64 if Storage unavailable
- Automatic markdown insertion: `![image.png](https://storage.googleapis.com/...)`
- Delete photos when no longer referenced

**Technical Details:**

- Uses `ClipboardEvent.clipboardData.items`
- Canvas API for compression
- Multer for server-side handling (5MB limit)
- Express JSON limit: 10MB for base64 fallback

**Key Files:**

- `public/app.js` - `handleImagePaste()`, `compressImage()`
- `server.js` - `/api/:username/photos` endpoints

### 5. Share Functionality

**Status: ✅ Complete**

**Philosophy:** Unified sharing experience with options for both linking and content copying.

**Features:**

- Share dropdown replaces single copy link button
- Available on recipe and menu detail views
- Owner mode: Share button alongside Edit, Add to Collection, Delete buttons
- Non-owner mode: Share button only (read-only access)
- Outside-click detection auto-closes dropdown

**Share Options:**

1. **Copy Link** - Copies URL to clipboard for easy sharing
2. **Copy Content As:**
   - **Original** - Raw markdown source with title (for editing elsewhere)
   - **Plain Text** - Rendered text without formatting (strips HTML)
   - **Rich Text** - Rendered HTML with title as h1 (for rich paste destinations)

**Technical Details:**

- `copyRecipeContent(format)` - Handles recipe copying (closes dropdown after copy)
- `copyMenuContent(format)` - Handles menu copying (closes dropdown after copy)
- Markdown→HTML conversion using marked.js
- HTML→plaintext using temp div with textContent extraction

**Key Files:**

- `public/app.js` - Share functions, toggle functions
- `public/styles.css` - Share dropdown styles
- `public/index.html` - Menu actions container

## Authentication & Users

### 6. Authentication System

**Status: ✅ Complete**

**Firebase Authentication with Email/Password + Google Sign-In**

**Features:**

- Email/password signup and login
- Google OAuth authentication
- Dedicated `/login` and `/signup` routes (no modals)
- Username collection during signup
- Automatic Firestore user document creation
- Firebase Auth UID-based data ownership
- **Public content viewing** - Logged-out users can view any user's content via username URLs

**Staff Users:**

- User documents can have `isStaff: true` field
- Staff users see Debug Info menu item
- Set manually in Firestore Console
- Console logs show 🛠️ Staff indicator

**Key Files:**

- `public/login.html` - Login page
- `public/signup.html` - Signup page
- `public/app.js` - Auth state handling

### 7. Multi-User Architecture

**Status: ✅ Complete**

**Philosophy:** Each user has their own isolated data namespace. All data is owned by Firebase Auth UID (userId), not username.

**Data Isolation:**

- All Firestore documents include both `username` (display) and `userId` (ownership)
- Server queries by `userId` for security
- Firebase Storage paths: `photos/{username}/{photoId}.jpg`
- URL structure: `/{username}/recipes`, `/{username}/collections`, `/{username}/menus`

**Permission-Based UI:**

- `updateEditControls()` function checks ownership
- Hides edit/delete buttons when viewing other users' content
- Creates clear read-only vs. editable state distinction

**Key Files:**

- `server.js` - `validateUsername` middleware, `buildUserQuery` helper
- `public/app.js` - `API.currentUser`, `API.viewingUser`, `updateEditControls()`

### 8. User Profile Page

**Status: ✅ Complete**

**Philosophy:** Modern social media profile layout inspired by Instagram and LTK.

**Features:**

- Hero section with circular avatar (150px), username, and stats
- Inline stats: "354 followers" format
- Bio display with line breaks preserved
- Follow/Unfollow button (hidden for own profile)
- Tabbed content navigation: Recipes, Collections, Menus
- Skeleton loading with shimmer animation

**Key Files:**

- `public/app.js` - `renderProfilePage()`, `switchProfileTab()`
- `public/index.html` - Profile hero, tabs
- `public/styles.css` - Profile styles

### 9. User Account Settings

**Status: ✅ Complete**

**Features:**

- Account information display (username, email)
- Email address updates
- Password change with verification
- Search visibility toggle
- Account deletion with password confirmation
- Bio editor with 160 character limit

**Security:**

- Firebase ID token verification
- Re-authentication required for password changes
- Comprehensive data deletion on account deletion

**Key Files:**

- `public/settings.html` - Settings page
- `server.js` - Settings endpoints with authentication

### 10. User Search & Discovery

**Status: ✅ Complete**

**Features:**

- Dedicated search page at `/search` route
- Shows all searchable users by default (sorted by follower count)
- Real-time search filtering (300ms debounce)
- Privacy control via `isSearchable` flag
- Follow/unfollow directly from search results
- Mobile-responsive design

**Key Files:**

- `public/app.js` - Search view and rendering
- `public/index.html` - Search page view
- `server.js` - `/api/users/search` endpoint

## Social Features

### 11. Activity Feed & Follow System

**Status: ✅ Complete**

**Philosophy:** Enable social discovery through follows and activity feed.

**Features:**

- Follow/unfollow users with atomic updates
- Activity feed using fan-out architecture
- Activity types: recipe_created, collection_created, menu_created
- Smart activity publishing (recipes only with meaningful titles)
- Automatic cleanup when content deleted or user unfollowed

**Architecture:**

- **Fan-Out on Write**: Activity written to all followers' personal feeds
- **Fast Reads**: O(1) query per feed, no joins needed
- Personal feed subcollections: `feeds/{userId}/activities`

**Key Files:**

- `server.js` - Follow/unfollow endpoints, fan-out helper
- `public/app.js` - Feed rendering, follow UI
- Helper scripts in `scripts/` directory

**Documentation:**

- 📚 [Activity Feed & Follow System Architecture](docs/architecture/activity-feed-and-follows.md)

### 12. Empty Feed State

**Status: ✅ Complete**

**Features:**

- Clean empty state with emoji, heading, description
- "Explore Users" CTA button navigates to search
- Mobile-responsive padding

**Key Files:**

- `public/index.html` - Empty feed HTML
- `public/styles.css` - Feed empty state styling
- `public/app.js` - Feed rendering logic

## UI/UX Features

### 13. Navigation & UI

**Status: ✅ Complete**

**Navbar:**

- Hamburger toggle for sidebar (mobile)
- "Sous" brand/home button
- Menu dropdown with user profile, feed, collections, menus, new recipe

**Sidebar:**

- Hidden when not logged in
- Search/filter recipes
- Recipe list with live filtering
- Collapsible on mobile

**Breadcrumbs:**

- Pattern: `@username > Section > Item`
- All views have username navigation
- Clickable links with SPA navigation

**Key Files:**

- `public/index.html` - DOM structure
- `public/styles.css` - All styling
- `public/app.js` - View switching, navigation

### 14. Gravatar Integration

**Status: ✅ Complete**

- MD5 hashing with SparkMD5
- High-res images (128px) scaled down
- User avatars in navbar and sidebar
- Default to mystery person if no Gravatar

**Key Files:**

- `public/app.js` - `getGravatarUrl()`, `md5()`

### 15. Skeleton Loading States

**Status: ✅ Complete**

**Implementation:**

- CSS-only animations with pseudo-elements
- Shimmer animation using linear gradient
- Avatar skeleton uses `onload` handler
- No JavaScript required for shimmer effect

**Key Files:**

- `public/styles.css` - Skeleton styles and keyframes
- `public/index.html` - Elements with skeleton classes
- `public/app.js` - Skeleton removal logic

### 16. Browser History & Page Titles

**Status: ✅ Complete**

**Philosophy:** Browser history should be meaningful with actual page titles.

**Implementation:**

- Every navigation sets `document.title`
- Format: `{Page Name} - @{username} - Sous`
- All `history.pushState()` calls include title

**Key Files:**

- `public/app.js` - `updateURL()` function

### 17. Navigation & Scroll Behavior

**Status: ✅ Complete**

**Implementation:**

- `history.scrollRestoration = 'manual'` globally
- Focus-based scrolling for recipes
- Browser-native focus behavior

**Key Files:**

- `public/app.js` - Scroll configuration and focus implementation

### 18. Page Load Optimization

**Status: ✅ Complete**

**Philosophy:** Prevent visual jitter during page load.

**Implementation:**

- All views start with `class="view-section hidden"`
- `loadFromURL()` determines and shows correct view
- Single render pass instead of multiple view changes

**Key Files:**

- `public/index.html` - Views start hidden
- `public/app.js` - Load sequence

### 19. Authentication UX Improvements

**Status: ✅ Complete**

**Sidebar & Toggle Visibility:**

- Default hidden in HTML
- Show only after authentication confirmed
- No flash of content on page load

**Key Files:**

- `public/index.html` - Hidden by default
- `public/app.js` - Auth visibility logic

## Technical Infrastructure

### 20. Firebase Integration

**Status: ✅ Complete**

**Firestore Collections:**

- `users` - User profiles and follow data
- `recipes` - Recipe documents
- `collections` - Collection documents
- `menus` - Menu documents
- `photos` - Photo metadata
- `activities` - Master activity records
- `feeds/{userId}/activities` - Personal feed subcollections

**Firebase Storage:**

- Bucket: `recipe-manager-4c340.firebasestorage.app`
- Path: `photos/{username}/{photoId}.jpg`
- Public access for all photos

**Key Files:**

- `server.js` - Firebase Admin initialization
- `.env` - Environment configuration

### 21. URL Routing

**Status: ✅ Complete**

**Client-Side SPA Routes:**

- `/{username}` - User profile
- `/{username}/collections` - Collections list
- `/{username}/collection/{slug}-{id}` - Collection detail
- `/{username}/menus` - Menus list
- `/{username}/menu/{slug}-{id}` - Menu detail
- `/{username}/recipe/{slug}-{id}` - Recipe detail
- `/search` - User search

**Key Files:**

- `server.js` - Catch-all route
- `public/app.js` - `loadFromURL()`, `updateURL()`

## Removed Features

### Keyboard Shortcuts

**Status: ❌ Removed**

**Reason:** Interfered with normal browser behavior (particularly Cmd+S). All functionality remains accessible through UI buttons and menus.
