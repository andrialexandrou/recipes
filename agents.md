# Sous - Recipe Manager

**⚠️ This file should be updated regularly as new functionality is developed**

## Project Overview

Sous is a personal recipe management application with a focus on simplicity, elegance, and user experience. The app allows users to create, organize, and share recipes using Markdown, with support for collections, menus, and image uploads.

## Style & Tone

### Design Philosophy

- **Minimalist & Clean** - No clutter, focus on content
- **Elegant Typography** - Georgia/Garamond serif fonts, careful spacing
- **Warm Neutral Palette** - Earthy browns (#6b5d52), off-white backgrounds (#f9f7f4)
- **Subtle Interactions** - Gentle hover states, smooth transitions
- **Mobile-First** - Responsive design that works beautifully on all devices

### UI/UX Principles

- **No Unnecessary Buttons** - Hide chrome when not needed
- **Keyboard-First** - Support shortcuts for power users
- **Smart Defaults** - Infer intent rather than asking
- **Progressive Enhancement** - Features appear when needed
- **Graceful Degradation** - Work without Firebase if needed

### Code Style

- **Vanilla JavaScript** - No framework overhead
- **Server-Side Rendering** - Express serves HTML, client enhances
- **Firebase Backend** - Firestore for data, Storage for images
- **Memory Fallback** - Works locally if Firebase unavailable

## Core Features

### 1. Recipe Management

**Status: ✅ Complete**

- Create/edit/delete recipes using Markdown
- Auto-save on edit
- Full preview with marked.js rendering
- Metadata tracking (created, updated dates)
- Slug-based URLs: `/{username}/recipe/alabama-white-sauce-ABC123`
- Edit/view mode toggle
- Copy link functionality

**Key Files:**

- `public/app.js` - Recipe CRUD operations
- `server.js` - `/api/:username/recipes` endpoints

### 2. Collections System

**Status: ✅ Complete**

- Group recipes into collections
- Add/remove recipes from collections
- Pre-populated collections (Freezer Friendly, Healthy Treats, etc.)
- Collection detail view with recipe cards
- Metadata shows which collections contain each recipe

**Key Files:**

- `public/app.js` - Collection rendering and management
- `server.js` - `/api/:username/collections` endpoints

### 3. Menus Feature

**Status: ✅ Complete**

- Create curated menus with Markdown content
- Optional description field
- Reference recipes within menus
- Edit/view mode toggle
- Metadata tracking

**Key Files:**

- `public/app.js` - Menu CRUD operations
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

### 5. Authentication System

**Status: ✅ Complete**

**Firebase Authentication with Email/Password + Google Sign-In**

**Features:**

- Email/password signup and login
- Google OAuth authentication
- Dedicated `/login` and `/signup` routes (no modals)
- Username collection during signup
- Automatic Firestore user document creation
- Firebase Auth UID-based data ownership

**Signup Flow:**

1. User provides username, email, password (or uses Google)
2. Firebase Auth account created
3. Username availability checked in Firestore
4. User document created in `users` collection with `{username, email, createdAt}`
5. Automatic sign-in and redirect to home

**Login Flow:**

1. User signs in with email/password or Google
2. App fetches user document from Firestore by UID
3. Sets `API.currentUser` with username, email, uid
4. Loads user's data via userId-based queries

**Staff Users:**

- User documents can have `isStaff: true` field
- Staff users see Debug Info menu item
- Set manually in Firestore Console: `users/{uid}` → add `isStaff` boolean field
- Console logs show 🛠️ Staff indicator for staff users

**Deployment Notes:**

- Production domain must be added to Firebase Console → Authentication → Settings → Authorized domains
- Required for Google OAuth to work on deployed app
- Add both preview and production Vercel URLs

**Key Files:**

- `public/login.html` - Login page with email/password and Google options
- `public/signup.html` - Signup page with username collection
- `public/app.js` - Auth state handling, `onAuthStateChanged`, `isStaff` check

### 6. Multi-User Architecture with UserId

**Status: ✅ Complete**

**Philosophy:** Each user has their own isolated data namespace. All data is owned by Firebase Auth UID (userId), not username. URLs use human-readable usernames, but queries use immutable userIds.

**Data Isolation:**

- All Firestore documents include both `username` (display) and `userId` (ownership)
- Server queries by `userId` for security
- Firebase Storage paths: `photos/{username}/{photoId}.jpg`
- URL structure: `/{username}/recipes`, `/{username}/collections`, `/{username}/menus`

**Server Architecture:**

- `validateUsername` middleware: Resolves username from URL → userId from Firestore
- `buildUserQuery` helper: Queries by userId if available, falls back to username
- All POST endpoints: Add `userId` to new documents
- All PUT/DELETE endpoints: Verify `userId` matches before allowing operations

**UI Indicators:**

- Sidebar shows viewing user (Gravatar + @username)
- Navbar dropdown shows current logged-in user
- URLs clearly show whose catalog is being viewed

**Permission-Based UI:**

- `updateEditControls()` function checks ownership: `API.viewingUser === API.currentUser?.username`
- Hides edit/delete buttons when viewing other users' content
- Hides "New Recipe", "New Collection", "New Menu" buttons when not viewing own content
- Hides "Add to Collection" button when viewing other users' recipes
- Hides Debug Info menu item for non-staff users
- Collection/menu grid cards: Edit/delete buttons only shown for owner
- Collection detail view: Edit/delete header buttons + remove recipe buttons only for owner
- Creates clear read-only vs. editable state distinction

**Key Files:**

- `server.js` - `validateUsername` middleware, `buildUserQuery` helper, user-scoped queries
- `public/app.js` - `API.currentUser`, `API.viewingUser`, `updateEditControls()`, dynamic username validation

### 7. Gravatar Integration

**Status: ✅ Complete**

- MD5 hashing with SparkMD5
- High-res images (128px) scaled down for sharp display
- User avatars in navbar dropdown and sidebar
- Default to mystery person if no Gravatar

**Key Files:**

- `public/app.js` - `getGravatarUrl()`, `md5()`
- `public/index.html` - SparkMD5 CDN

### 7. Navigation & UI

**Status: ✅ Complete**

**Navbar (34.5px height):**

- Hamburger toggle for sidebar (mobile)
- "Sous" brand/home button
- Menu dropdown (☰) on right with:
  - User profile (Gravatar + @username)
  - Collections
  - Menus
  - New Recipe
  - Keyboard Shortcuts
  - Debug Info

**Sidebar:**

- Viewing user indicator (Gravatar + @username) - clickable link to user's home page
- Search/filter recipes
- Recipe list with live filtering
- Collapsible on mobile

**Views:**

- Home (collections + menus grid)
- Collections list
- Collection detail
- Menus list
- Menu detail
- Recipe detail

**Key Files:**

- `public/index.html` - DOM structure
- `public/styles.css` - All styling
- `public/app.js` - View switching, navigation

### 8. Keyboard Shortcuts

**Status: ✅ Complete**

- `N` - New recipe
- `/` - Focus search
- `E` - Edit current recipe
- `Cmd/Ctrl + S` - Save recipe
- `Esc` - Cancel edit / Close dialogs
- `?` - Show shortcuts modal

**Key Files:**

- `public/app.js` - Keyboard event handlers

### 9. Firebase Integration

**Status: ✅ Complete**

**Firestore Collections:**

- `users` - {username, email, createdAt, isStaff (optional boolean)}
- `recipes` - {id, title, content, username, userId, createdAt, updatedAt}
- `collections` - {id, name, description, username, userId, recipeIds[]}
- `menus` - {id, name, description, content, username, userId, recipeIds[], createdAt, updatedAt}
- `photos` - {id, filename, url, username, uploadedAt, size, mimetype}

**Firebase Storage:**

- Bucket: `recipe-manager-4c340.firebasestorage.app`
- Path structure: `photos/{username}/{photoId}.jpg`
- Public access for all photos

**Admin SDK:**

- Server-side only (security)
- Service account key in environment variable
- Graceful fallback to memory storage if unavailable

**Environment Variables:**

```
FIREBASE_PROJECT_ID=recipe-manager-4c340
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

**Key Files:**

- `server.js` - Firebase Admin initialization
- `.env` - Environment configuration

### 10. URL Routing

**Status: ✅ Complete**

**Client-Side SPA Routing:**

- `/{username}` - Home view
- `/{username}/collections` - Collections list
- `/{username}/collection/{slug}-{id}` - Collection detail
- `/{username}/menus` - Menus list
- `/{username}/menu/{slug}-{id}` - Menu detail  
- `/{username}/recipe/{slug}-{id}` - Recipe detail

**Server-Side:**

- All routes return `index.html` for SPA
- API routes under `/api/:username/*`
- Static assets served from `/public`

**Key Files:**

- `server.js` - Catch-all route for SPA
- `public/app.js` - `loadFromURL()`, `updateURL()`

## Technical Stack

### Frontend

- **No Framework** - Vanilla JavaScript
- **marked.js** - Markdown rendering
- **SparkMD5** - MD5 hashing for Gravatars
- **Font Awesome** - Icons
- **Google Fonts** - Cinzel (headings)

### Backend

- **Node.js + Express** - Web server
- **Firebase Admin SDK** - Database & storage
- **Multer** - File upload handling
- **dotenv** - Environment configuration

### Deployment

- **Vercel** - Frontend & API hosting
- **Firebase** - Backend services (Firestore, Storage)

## File Structure

```mermaid
├── server.js              # Express server, API endpoints
├── package.json           # Dependencies
├── .env                   # Environment variables (gitignored)
├── vercel.json           # Vercel deployment config
├── agents.md             # This file - keep updated!
└── public/
    ├── index.html        # SPA shell
    ├── app.js            # Client-side application logic
    ├── styles.css        # All styling
    ├── favicon.png       # Production favicon
    └── favicon-dev.png   # Development favicon
```

## Development Workflow

### Local Development

```bash
npm run dev  # Starts server on port 3000 (or 3001 if 3000 occupied)
```

### Environment Setup

1. Create `.env` file with Firebase credentials
2. Install dependencies: `npm install`
3. Run migration if existing data: `POST /api/migrate-to-users`

### Manual Testing Scenarios

These scenarios should be tested when making changes to ensure core functionality remains intact:

#### First-Time User Experience

- [ ] **Onboarding Banner** - Sign up as new user, verify Welcome banner displays with CTA buttons
- [ ] **Skeleton Loading** - On page load, verify skeleton UI displays before content loads
- [ ] **Skeleton Transition** - Verify smooth transition from skeleton to actual content
- [ ] **Add First Recipe** - Click "Add your first recipe" button, verify creates new recipe
- [ ] **Create Menu from Banner** - Click "Create a menu" button, verify menu creation flow

#### Recipe Management

- [ ] **Create Recipe** - Press `N` or use navbar menu → New Recipe, enter title and content, save
- [ ] **Edit Recipe** - Open recipe, press `E` or click Edit button, modify content, save with `Cmd/Ctrl+S`
- [ ] **Delete Recipe** - Open recipe in edit mode, click Delete, confirm deletion
- [ ] **Markdown Rendering** - Add headings, lists, bold, italic, links - verify preview renders correctly
- [ ] **Copy Link** - Click copy link button, verify URL copied to clipboard and shows confirmation
- [ ] **Recipe Metadata** - Check collections indicator shows correct count and list

#### Collections System

- [ ] **View Collections** - Navigate to Collections list, verify all collections display
- [ ] **Collection Detail** - Click into a collection, verify recipes display as cards with images
- [ ] **Add to Collection** - From recipe metadata, click +Add to Collection, select collection, verify added
- [ ] **Remove from Collection** - Click ×Remove on collection badge, verify removed
- [ ] **Empty Collection** - View collection with no recipes, verify empty state message

#### Menus

- [ ] **Create Menu** - Navigate to Menus, create new menu with name/description/content
- [ ] **Edit Menu** - Open menu, click Edit, modify content, save
- [ ] **Delete Menu** - Delete menu, confirm deletion works
- [ ] **Menu Preview** - Toggle between edit and preview modes, verify Markdown renders

#### Image Upload

- [ ] **Paste Image** - Copy image to clipboard, paste into recipe editor (Cmd/Ctrl+V)
- [ ] **Image Compression** - Paste large image, verify it compresses (check network tab for file size)
- [ ] **Image Display** - Save recipe with image, verify image displays in preview
- [ ] **Multiple Images** - Paste multiple images into one recipe
- [ ] **Firebase Storage** - Check Debug modal to verify images uploaded to Firebase Storage
- [ ] **Fallback Mode** - Disable Firebase (rename .env), paste image, verify base64 fallback works

#### Authentication System

- [ ] **Email/Password Signup** - Go to `/signup`, create account with username/email/password
- [ ] **Email/Password Login** - Go to `/login`, sign in with credentials
- [ ] **Google Sign-In (New User)** - Click "Continue with Google", enter username when prompted
- [ ] **Google Sign-In (Returning User)** - Sign in with Google, verify auto-login without username prompt
- [ ] **Auth Persistence** - Refresh page while logged in, verify stays logged in
- [ ] **Logout** - Click logout from navbar menu, verify redirects to `/login`
- [ ] **Protected Routes** - Try accessing `/` while logged out, verify redirects to `/login`

#### Multi-User Architecture & Data Isolation

- [ ] **User Isolation** - Create recipe as user A, sign in as user B, verify can't see user A's recipes
- [ ] **Current User Display** - Open navbar menu dropdown, verify Gravatar and @username shown
- [ ] **Viewing User Display** - Check sidebar, verify correct user's Gravatar and @username shown
- [ ] **UserId Queries** - Check console for `✅ Resolved username → userId: ...` messages
- [ ] **URL Updates** - Navigate between views, verify URLs update with correct username prefix
- [ ] **Browser Navigation** - Use back/forward buttons, verify views load correctly from URL
- [ ] **Create Recipe** - Verify new recipe has `userId` field in Firestore
- [ ] **Data Ownership** - Try editing another user's recipe via direct URL, verify fails

#### Permission-Based UI (Read-Only Mode)

- [ ] **Own Content** - Navigate to your own content, verify all edit/delete/create buttons visible
- [ ] **Other User's Content** - Navigate to `/{otherUser}/recipe/...`, verify edit/delete buttons hidden
- [ ] **New Recipe Hidden** - When viewing another user's catalog, verify "New Recipe" menu item hidden
- [ ] **Add to Collection Hidden** - On another user's recipe, verify "Add to Collection" button hidden
- [ ] **Create Buttons Hidden** - On another user's home/collections/menus views, verify "New Collection" and "New Menu" buttons hidden
- [ ] **Collections List** - View another user's collections list, verify no edit/delete buttons on cards
- [ ] **Collection Detail** - View another user's collection detail, verify no edit/delete buttons in header or on recipes
- [ ] **Menus List** - View another user's menus list, verify no edit/delete buttons on cards
- [ ] **Switch Back** - Navigate back to your own content, verify edit controls reappear
- [ ] **Sidebar Username Link** - Click username/avatar in sidebar, verify navigates to user's home page
- [ ] **Console Logging** - Check for `🔒 Edit controls shown/hidden` messages in console

#### Staff Features

- [ ] **Debug Menu (Staff)** - As staff user (`isStaff: true`), verify Debug Info menu item visible
- [ ] **Debug Menu (Non-Staff)** - As regular user, verify Debug Info menu item hidden
- [ ] **Staff Console Log** - Check for 🛠️ Staff indicator in console when staff user logs in

#### Gravatar Integration

- [ ] **User Avatars** - Verify avatars appear in navbar dropdown and sidebar
- [ ] **Fallback Images** - Check that identicon default appears for users without Gravatar
- [ ] **High-Res Display** - Inspect avatars on high-DPI screens, verify they're sharp (128px source scaled down)

#### Navigation & UI

- [ ] **Sidebar Toggle** - On mobile/narrow viewport, verify hamburger menu toggles sidebar
- [ ] **Navbar Dropdown** - Click ☰ menu button, verify dropdown opens with all items
- [ ] **Home View** - Navigate to `/{username}`, verify collections and menus grid displays
- [ ] **Search/Filter** - Type in search box, verify recipe list filters in real-time
- [ ] **Empty States** - View user with no recipes/collections/menus, verify helpful empty messages
- [ ] **Mobile Responsive** - Test on mobile viewport, verify layout adapts properly

#### Keyboard Shortcuts

- [ ] **New Recipe** - Press `N`, verify new recipe form appears
- [ ] **Focus Search** - Press `/`, verify search input gets focus
- [ ] **Edit Recipe** - From recipe view, press `E`, verify edit mode activates
- [ ] **Save Recipe** - In edit mode, press `Cmd/Ctrl+S`, verify recipe saves
- [ ] **Cancel Edit** - In edit mode, press `Esc`, verify returns to view mode
- [ ] **Close Dialogs** - Open shortcuts modal, press `Esc`, verify modal closes
- [ ] **Show Shortcuts** - Press `?`, verify shortcuts modal displays

#### Firebase Integration

- [ ] **Online Mode** - With Firebase configured, verify all operations work
- [ ] **Offline Fallback** - Rename .env file, restart server, verify memory storage works
- [ ] **Debug Modal** - Open Debug Info from navbar menu, verify shows Firebase status, recipe/collection/menu counts
- [ ] **Data Persistence** - Create recipe with Firebase, refresh page, verify data persists
- [ ] **Memory Mode Limit** - In memory mode, refresh page, verify data is lost (expected behavior)

#### URL Routing & Deep Links

- [ ] **Direct Recipe Link** - Open `/{username}/recipe/{slug}-{id}` directly, verify loads correctly
- [ ] **Direct Collection Link** - Open `/{username}/collection/{slug}-{id}` directly
- [ ] **Direct Menu Link** - Open `/{username}/menu/{slug}-{id}` directly
- [ ] **404 Handling** - Try invalid recipe ID, verify graceful error
- [ ] **Shareable URLs** - Copy URL, open in incognito/different browser, verify works

#### Error Handling & Edge Cases

- [ ] **Empty Recipe Title** - Create recipe with no title, verify defaults to "Untitled"
- [ ] **Empty Menu Name** - Try to create menu with no name, verify validation error and focus
- [ ] **Very Long Content** - Create recipe with 10,000+ characters, verify saves and renders
- [ ] **Special Characters** - Use emoji, unicode, special chars in titles/content
- [ ] **Concurrent Edits** - Open same recipe in two tabs, edit in both, verify last-save wins
- [ ] **Network Failure** - Disconnect internet while saving, verify error message shows
- [ ] **Invalid Markdown** - Use malformed Markdown, verify it still renders (gracefully degrades)

#### Performance & UX

- [ ] **Initial Load** - Clear cache, reload app, verify loads in under 2 seconds
- [ ] **Navigation Speed** - Click through multiple views rapidly, verify smooth transitions
- [ ] **Large Recipe List** - With 50+ recipes, verify sidebar scrolls smoothly and search is fast
- [ ] **Image Loading** - Scroll through collection with many images, verify lazy loading/smooth experience

### Quick Smoke Test Checklist

For rapid verification after deployments:

1. ✅ Load app at `/{username}`
2. ✅ Create new recipe with `N`
3. ✅ Paste an image into recipe
4. ✅ Save recipe with `Cmd+S`
5. ✅ View recipe in preview mode
6. ✅ Add recipe to a collection
7. ✅ Navigate to collections view
8. ✅ Open navbar menu dropdown
9. ✅ Check Debug Info shows Firebase connected
10. ✅ Test on mobile viewport

## Design Patterns

### Data Flow

1. Client calls `API.*` methods
2. API methods fetch from `/api/:username/*` with current/viewing user
3. Server validates username, queries Firestore with `where('username', '==', username)`
4. Returns filtered data to client
5. Client renders in DOM

### Error Handling

- Try Firebase first, fall back to memory if failed
- Once Firebase fails, disable for entire session
- Show user-friendly errors, log details to console
- Graceful degradation - always functional

### State Management

The application uses a modular state management approach:

**State Module** - Centralized state in `State` object:

- `recipes`, `collections`, `menus` - Content arrays
- `currentRecipeId`, `currentCollectionId`, `currentMenuId` - Active item tracking
- `currentView` - Current view name
- `isEditMode`, `isMenuEditMode` - Edit state flags
- `users` - Cached user data

**DOM Module** - All DOM elements organized in `DOM` object:

- Sidebar, navbar, view sections
- Collections, menus, recipes elements
- Buttons, inputs, and controls
- Centralized element access reduces global scope pollution

**Helper Modules**:

- `SkeletonUI` - Reusable skeleton loading state functions
- `CONSTANTS` - Magic numbers and strings in one place
- JSDoc comments for type hints and documentation

**API State**:

- `API.currentUser` - Logged in user (from Firebase Auth)
- `API.viewingUser` - Whose catalog we're viewing (changes per URL)
- `API.authInitialized` - Auth setup completion flag

### URL Strategy

- URLs are source of truth for navigation
- `history.pushState()` updates URL without reload
- `popstate` listener handles back/forward
- `loadFromURL()` on page load reads current URL

## Future Considerations

### Feature Backlog

**Quick Wins (Small):**

- ✅ **Center Auth Pages** - DONE: Fixed body flexbox conflict with :has() selector
- **Improve Print Styling** - Make recipes and menus look professional and well-formatted when using browser print function (styling, page breaks, typography)
- **Reset Password** - Allow users to reset their password via email
- ✅ **Menus Above Collections** - DONE: Reordered home view rendering and HTML sections
- **Firebase Connection Error UI** - Show user-friendly 500 error message when ECONNREFUSED or Firestore connection fails, so users don't think their data is lost. Currently falls back silently to memory storage which can be confusing.
- ✅ **Clear Metadata on New Recipe** - DONE: Metadata now properly resets when creating new recipe
- ✅ **Recipe Author Display** - DONE: Shows @username at top of recipe metadata
- ✅ **Remove Recipe Count from Menu Cards** - DONE: Removed from both home and full menus view
- **Fix User Menu Alignment** - Fix alignment bugs in the navbar user dropdown menu

**Medium Effort:**

- **Open Graph Cards for Social Sharing** - Generate Open Graph meta tags for recipes, collections, and menus to create rich preview cards when sharing links. Use page content and user-provided images to auto-generate cards. Optional: As a pro feature, use AI to generate enhanced cards with title, estimated duration from recipe notes, basic instructions, etc.
- **Vertical Menu Cards with Header Images** - Make menu cards vertical (Pinterest-style) with optional header images for better visual appeal and social sharing
- **Public Content Viewing (Logged Out)** - Allow viewing user content via direct links when logged out, only redirect to login for app navigation
- **Export User Content** - Export all recipes, collections, and menus as JSON or Markdown
- **Turn a Collection into a PDF Cookbook** - Generate a formatted PDF from a collection's recipes
- **Import/Migration Tool** - Allow users to bulk import recipes from various file formats (PDF, Markdown, HTML, text files) to populate their catalog after account creation. Implementation: Use Vercel AI SDK with user-provided API keys stored securely in their Firestore user document. Let users attach their own OpenAI/Anthropic key for AI-powered parsing, or start with simple markdown/text imports without AI. Trade-off: User provides key (no cost to app) vs. built-in credits (simpler UX but ongoing costs).

**Large Features:**

- **Follow Users** - Allow users to follow other users to see their content
- **Activity Feed/Wall** - Show a feed of recent recipes, collections, and menus created by followed users
- **Progressive Web App (PWA)** - Add manifest.json and service worker for offline support, home screen installation that opens as standalone app without browser chrome

### Potential Features (Not Yet Implemented)

- Recipe sharing/permissions (public/private recipes)
- Recipe tags/categories beyond collections
- Search across all fields (not just title)
- Recipe import from URLs
- Print-friendly recipe view
- Meal planning calendar
- Shopping list generation
- Recipe ratings/favorites
- Comments on recipes
- Activity feed
- Follow users feature
- Password reset via email

### Technical Debt

- No automated tests yet (need tests that load each view across multiple users to verify data isolation and permissions)
- No TypeScript (pure JavaScript)
- No build process (ships raw files)
- Memory storage fallback loses data on restart
- No offline support (PWA)

## Notes for AI Agents

When working on this codebase:

1. **Maintain the minimalist aesthetic** - Don't add visual clutter
2. **Preserve keyboard shortcuts** - They're core to the UX
3. **Keep memory fallback working** - Not everyone has Firebase
4. **Update this file** when adding new features
5. **Test multi-user isolation** when touching data layer
6. **Use em-dashes (—) not hyphens** in UI copy
7. **Avoid modals** - prefer inline actions when possible
8. **Log everything to console** - helps debugging in production
9. **Keep URLs semantic and clean** - they're shareable
10. **Mobile-first** - test responsive behavior

## Changelog

- **2025-11-12** - Implemented Quick Wins: Reordered home view (menus before collections), added author display to recipe metadata (at top), removed recipe count from menu cards, fixed auth page centering with :has() selector, cleared metadata on new recipe creation
- **2025-11-11** - Removed floating action buttons completely, replaced with inline icon-only metadata buttons, built Spotify-style collections dropdown with search and creation, fixed multiple console errors (function references), removed menus from recipe metadata
- **2025-11-11** - Code refactoring: Organized code into modules (State, DOM, SkeletonUI, CONSTANTS), extracted helper functions, added JSDoc comments, removed duplicate code
- **2025-11-11** - Added skeleton loading for sidebar user avatar and recipe list
- **2025-11-11** - Added first-time user onboarding banner with CTA buttons, skeleton loading UI with shimmer effect
- **2025-11-11** - Added sidebar collapse state persistence with localStorage
- **2025-11-11** - Added print styles for complete PDF output of recipes and menus
- **2025-11-11** - Added empty state messages for collections/menus, avatar loading placeholders
- **2025-11-11** - Navigate to home after entity deletion, update URLs after saving entities
- **2025-11-11** - Removed "No description" placeholder text for cleaner cards
- **2025-11-11** - Added `isStaff` user field, Debug menu only visible to staff users
- **2025-11-11** - Extended permission-based UI to collections/menus list and detail views
- **2025-11-11** - Made sidebar username/avatar clickable link to user's home page
- **2025-11-11** - Hidden "Add to Collection" button when viewing other users' recipes
- **2025-11-11** - Added permission-based UI (read-only mode when viewing other users' content)
- **2025-11-11** - Fixed URL persistence and navigation bugs in multi-user architecture
- **2025-11-11** - Fixed Gravatar lookup to fetch viewing user's email from Firestore
- **2025-11-11** - Added Firebase Authentication (email/password + Google Sign-In), userId-based data architecture, multi-user support
- **2025-11-11** - Added multi-user architecture, Gravatar integration, navbar redesign, photo migration
- **2025-11-11** - Added menus feature with full CRUD
- **2025-11-11** - Added paste-to-upload image functionality with Firebase Storage
- **2025-11-11** - Initial collections implementation
- **Earlier** - Core recipe management, Firebase integration

---

*Keep this document updated as the project evolves. It's your roadmap and context for future development.*
