# Sous - Development Guidelines

**⚠️ This file should be updated when architecture or development patterns change**

## Project Overview

Sous is a personal recipe management application with a focus on simplicity, elegance, and user experience. The app allows users to create, organize, and share recipes using Markdown, with support for collections, menus, and social features.

## Documentation Structure

- **[FEATURES.md](FEATURES.md)** - Detailed documentation of all features
- **[TESTING.md](TESTING.md)** - Manual testing scenarios and smoke tests
- **[changelog.md](changelog.md)** - Version history and implementation details
- **[backlog.md](backlog.md)** - Planned features and improvements
- **[README.md](README.md)** - Project overview and setup instructions
- **This file** - Architecture patterns and guidelines for AI agents

## Design Philosophy

### Visual Design

- **Minimalist & Clean** - No clutter, focus on content
- **Elegant Typography** - Georgia/Garamond serif fonts, careful spacing
- **Warm Neutral Palette** - Earthy browns (#6b5d52), off-white backgrounds (#f9f7f4)
- **Subtle Interactions** - Gentle hover states, smooth transitions
- **Mobile-First** - Responsive design that works beautifully on all devices

### UX Principles

- **No Unnecessary Buttons** - Hide chrome when not needed
- **Smart Defaults** - Infer intent rather than asking
- **Progressive Enhancement** - Features appear when needed
- **Graceful Degradation** - Work without Firebase if needed
- **All URLs Must Be Links** - Every URL in the app must be a proper `<a>` tag for copy/paste and accessibility

### Code Philosophy

- **Vanilla JavaScript** - No framework overhead
- **Server-Side Rendering** - Express serves HTML, client enhances
- **Firebase Backend** - Firestore for data, Storage for images
- **Memory Fallback** - Works locally if Firebase unavailable

## Technical Architecture

### Tech Stack

**Frontend:**
- Vanilla JavaScript (no framework)
- marked.js for Markdown rendering
- EasyMDE for WYSIWYG editing
- SparkMD5 for Gravatar hashing
- Font Awesome icons

**Backend:**
- Node.js + Express web server
- Firebase Admin SDK (Firestore + Storage)
- Multer for file upload handling
- dotenv for environment configuration

**Deployment:**
- Vercel for hosting (frontend + API)
- Firebase for backend services

### File Structure

```
├── server.js              # Express server, API endpoints
├── package.json           # Dependencies
├── .env                   # Environment variables (gitignored)
├── vercel.json           # Vercel deployment config
├── agents.md             # This file
├── FEATURES.md           # Feature documentation
├── TESTING.md            # Test scenarios
├── changelog.md          # Version history
├── backlog.md            # Future features
└── public/
    ├── index.html        # SPA shell
    ├── login.html        # Login page
    ├── signup.html       # Signup page
    ├── settings.html     # Settings page
    ├── app.js            # Client-side application logic
    ├── styles.css        # All styling
    ├── favicon.png       # Production favicon
    └── favicon-dev.png   # Development favicon
```

### Data Model

**Firestore Collections:**

- `users` - User profiles with auth data, follow relationships, settings
- `recipes` - Recipe documents with markdown content
- `collections` - Collection documents with recipe references
- `menus` - Menu documents with markdown content
- `photos` - Photo metadata for uploaded images
- `activities` - Master activity records
- `feeds/{userId}/activities` - Personal feed subcollections (fan-out architecture)

**Key Principles:**

- All documents include both `username` (display) and `userId` (Firebase Auth UID for ownership)
- Server queries by `userId` for security
- URLs use human-readable usernames
- Data isolation enforced at query level

### State Management

**State Module** - Centralized state in `State` object:

```javascript
const State = {
  recipes: [],
  collections: [],
  menus: [],
  currentRecipeId: null,
  currentCollectionId: null,
  currentMenuId: null,
  currentView: 'home',
  isEditMode: false,
  isMenuEditMode: false,
  users: {},
  authenticatedUserRecipes: [],  // Sidebar always shows YOUR recipes
  viewingUserRecipes: []          // Main content shows profile owner's recipes
};
```

**API State:**

```javascript
const API = {
  currentUser: null,      // Logged-in user (from Firebase Auth)
  viewingUser: null,      // Whose catalog we're viewing (from URL)
  authInitialized: false  // Auth setup complete
};
```

**DOM Module** - All DOM elements organized in `DOM` object to reduce global scope pollution

### Authentication & Authorization

**Firebase Auth:**
- Email/password + Google OAuth
- UID-based data ownership
- Public content viewing for logged-out users
- Staff user flag (`isStaff: true`) for special features

**Admin Badge System:**

Visual indicators for staff users across all username displays:
- `getAdminBadge(user)` function generates consistent staff markers
- Applied to usernames in profile pages, recipe metadata, follow modals, search results, and activity feeds
- Centralizes staff status display logic for maintainability

**Permission Pattern:**

```javascript
function updateEditControls() {
  const isOwner = API.viewingUser === API.currentUser?.username;
  // Show/hide edit controls based on ownership
}
```

### Multi-User Architecture

**Key Concepts:**

- **Sidebar Always Shows Authenticated User's Content** - regardless of whose profile you're viewing
- **Separate Data Contexts**:
  - `State.authenticatedUserRecipes` - For sidebar
  - `State.viewingUserRecipes` - For main content
- **Permission-Based UI** - Edit controls only shown for owner
- **Server Middleware** - `validateUsername` resolves username → userId

### URL Strategy & Navigation

**SPA Routing:**

- URLs are source of truth for navigation
- `history.pushState()` updates URL without reload
- `popstate` listener handles back/forward
- `loadFromURL()` on page load reads current URL
- Every navigation sets `document.title` for meaningful browser history

**URL Patterns:**

- `/{username}` - User profile
- `/{username}/recipe/{slug}-{id}` - Recipe detail
- `/{username}/collection/{slug}-{id}` - Collection detail
- `/{username}/menu/{slug}-{id}` - Menu detail
- `/search` - User search and discovery

**Scroll Behavior:**

- `history.scrollRestoration = 'manual'` prevents browser auto-restore
- Focus-based scrolling for recipes (browser-native behavior)
- No manual `window.scrollTo()` calls

### Modal System

**ModalUtils** - Reusable modal utility for consistent behavior across all modals:

```javascript
ModalUtils.open(modalElement, closeCallback)  // Opens modal with focus trap
ModalUtils.close()                             // Closes active modal
```

**Features:**
- Automatic focus trapping (Tab cycles within modal)
- Escape key to close
- Click overlay to close
- Auto-focus first focusable element
- Consistent behavior across all dialogs

**Usage:**
```javascript
// Open a modal
ModalUtils.open(DOM.followModal, () => {
  console.log('Modal closed');
});

// Close button
closeButton.addEventListener('click', () => ModalUtils.close());
```

**All modals should use ModalUtils** instead of manual event handlers.

### Activity Feed Architecture

**Fan-Out on Write Pattern:**

When a user creates content:
1. Activity record created in `activities` collection
2. Activity copied to each follower's personal feed: `feeds/{userId}/activities`
3. Fast reads: O(1) query per feed, no joins
4. Trade-off: More writes, but optimal read performance

**Smart Publishing:**

- Recipes only published when title is meaningful (not "Untitled")
- Activities auto-removed when content deleted or user unfollowed

### Image Upload System

**Paste-to-Upload Philosophy:**

No upload buttons or modals - just paste images directly into the editor.

**Flow:**

1. Detect paste events with images
2. Client-side compression (max 1200px, 80% quality, JPEG)
3. Upload to Firebase Storage: `photos/{username}/{photoId}.jpg`
4. Fallback to base64 if Storage unavailable
5. Automatic markdown insertion

### Avatar System

**Centralized Avatar Management:**

All user avatars are handled through a unified system with server-side optimization.

**Key Components:**
- `addGravatarHash` middleware - Server-side function that automatically computes Gravatar hashes from email addresses
- `getAvatarHtml` client function - Generates consistent avatar HTML with fallbacks
- Automatic email privacy protection - Server removes email fields after hash computation

**Flow:**
1. Server endpoints use `addGravatarHash(user/users)` to process user data
2. Gravatar hash computed from email using MD5
3. Email field removed for privacy before sending to client
4. Client uses `getAvatarHtml()` for consistent rendering with initials fallback

**Benefits:**
- Centralized hash computation (no client-side crypto needed)
- Email privacy protection
- Consistent avatar rendering across all UI locations
- Graceful fallbacks to initials when Gravatar unavailable

### Mobile Touch Optimization

**TouchUtils Module:**

Smart touch handling system that distinguishes between taps and scrolls to prevent accidental card activation during mobile scrolling.

```javascript
TouchUtils.addTouchHandler(element, handler)
```

**Features:**
- **Touch Duration Tracking** - Only triggers on short touches (< 300ms)
- **Movement Detection** - Tracks finger movement; >10px movement = scrolling
- **Passive Event Handling** - Uses `passive: true` for smooth scrolling performance
- **Desktop Compatibility** - Maintains normal click behavior for mouse users

**Implementation:**
- Replaces problematic `addEventListener('touchstart', handler, {passive: false})` patterns
- Applied to all card interactions (recipes, collections, menus)
- Prevents cards from opening when user intends to scroll
- Maintains keyboard accessibility

### Design Patterns

**Data Flow:**

1. Client calls `API.*` methods
2. API methods fetch from `/api/:username/*`
3. Server validates username, queries Firestore by userId
4. Returns filtered data to client
5. Client renders in DOM

**Error Handling:**

- Try Firebase first, fall back to memory if failed
- Once Firebase fails, disable for entire session
- Show user-friendly errors, log details to console
- Graceful degradation - always functional

**Progressive Enhancement:**

- Start elements hidden in HTML (`.hidden` class)
- Show with JavaScript after auth/data load
- Prevents FOUC (flash of unstyled content)
- Works even if JavaScript fails

### Testing Strategy

Manual testing only (no automated tests yet). See [TESTING.md](TESTING.md) for scenarios.

**Quick Smoke Test:**

1. Load app, create recipe, paste image, save
2. Add to collection, navigate views
3. Test mobile viewport
4. Verify Firebase connected

## Development Workflow

### Local Development

```bash
npm run dev  # Starts server on port 3000 (or 3001 if occupied)
```

### Environment Setup

1. Create `.env` file with Firebase credentials
2. Install dependencies: `npm install`
3. Run migration if existing data: `POST /api/migrate-to-users`

### Important HTML Header Sync

The standalone HTML pages (`index.html`, `login.html`, `signup.html`, `settings.html`) share common `<head>` elements that should be kept in sync:

- PWA Manifest tags
- Apple mobile web app tags
- Favicon logic (dev/prod switching)
- Font preconnects
- CSS/JS library versions

When updating meta tags or PWA configuration, update all HTML pages.

## Guidelines for AI Agents

When working on this codebase:

1. **Maintain the minimalist aesthetic** - Don't add visual clutter
2. **Keep memory fallback working** - Not everyone has Firebase
3. **Update documentation** when adding features or changing architecture
4. **Test multi-user isolation** when touching data layer
5. **Use em-dashes (—) not hyphens** in UI copy
6. **Avoid modals** - prefer inline actions when possible
7. **Log everything to console** - helps debugging in production
8. **Keep URLs semantic and clean** - they're shareable
9. **Mobile-first** - test responsive behavior
10. **No keyboard shortcuts** - they interfere with browser behavior; use UI controls instead
11. **Set document.title on navigation** - browser history should show page names
12. **All URLs must be `<a>` tags** - every URL must be a proper anchor tag
13. **Start hidden, show with JS** - UI elements requiring auth start with `hidden` class
14. **Skeleton loading with CSS** - Use `::after` pseudo-elements for shimmer effects
15. **Focus for scroll** - Use `element.focus()` instead of `window.scrollTo()`
16. **Avatar load detection** - Always use `onload` handlers when removing skeleton from images
17. **Comprehensive feature coverage** - When adding UI elements for one context, audit all similar contexts to ensure consistency (e.g., username displays, staff badges, avatar rendering)
18. **Touch-aware interactions** - Use `TouchUtils.addTouchHandler()` for card interactions to distinguish taps from scrolls on mobile devices

## Feature Status

See [FEATURES.md](FEATURES.md) for detailed status of all features. Quick summary:

**✅ Complete:**
- Recipe management with Markdown
- Collections and menus
- Image upload (paste-to-upload)
- Share functionality
- Authentication (email/password + Google)
- Multi-user architecture
- User profiles with bio
- User search and discovery
- Activity feed and follows
- Account settings
- Skeleton loading states

**❌ Removed:**
- Keyboard shortcuts (interfered with browser behavior)

## Technical Debt

- No automated tests yet
- No TypeScript (pure JavaScript)
- No build process (ships raw files)
- Memory storage fallback loses data on restart
- No offline support for Firebase mode

---

*Keep this document updated when architecture patterns or development guidelines change.*
