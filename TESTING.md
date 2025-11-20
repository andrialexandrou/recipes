# Testing Guide

Manual testing scenarios for Sous. These should be tested when making changes to ensure core functionality remains intact.

## Quick Smoke Test

For rapid verification after deployments:

1. ✅ Load app at `/{username}`
2. ✅ Create new recipe
3. ✅ Paste an image into recipe
4. ✅ Save recipe
5. ✅ View recipe in preview mode
6. ✅ Add recipe to a collection
7. ✅ Navigate to collections view
8. ✅ Open navbar menu dropdown
9. ✅ Check Debug Info shows Firebase connected
10. ✅ Test on mobile viewport

## Detailed Test Scenarios

### First-Time User Experience

- [ ] **Onboarding Banner** - Sign up as new user, verify Welcome banner displays with CTA buttons
- [ ] **Skeleton Loading** - On page load, verify skeleton UI displays before content loads
- [ ] **Skeleton Transition** - Verify smooth transition from skeleton to actual content
- [ ] **Add First Recipe** - Click "Add your first recipe" button, verify creates new recipe
- [ ] **Create Menu from Banner** - Click "Create a menu" button, verify menu creation flow

### Recipe Management

- [ ] **Create Recipe** - Use navbar menu → New Recipe, enter title and content, save
- [ ] **Edit Recipe** - Open recipe, click Edit button, modify content, save
- [ ] **Delete Recipe** - Open recipe in edit mode, click Delete, confirm deletion
- [ ] **Markdown Rendering** - Add headings, lists, bold, italic, links - verify preview renders correctly
- [ ] **Copy Link** - Click copy link button, verify URL copied to clipboard and shows confirmation
- [ ] **Recipe Metadata** - Check collections indicator shows correct count and list

### Collections System

- [ ] **View Collections** - Navigate to Collections list, verify all collections display
- [ ] **Collection Detail** - Click into a collection, verify recipes display as cards with images
- [ ] **Add to Collection** - From recipe metadata, click +Add to Collection, select collection, verify added
- [ ] **Remove from Collection** - Click ×Remove on collection badge, verify removed
- [ ] **Empty Collection** - View collection with no recipes, verify empty state message

### Menus

- [ ] **Create Menu** - Navigate to Menus, create new menu with name/description/content
- [ ] **Edit Menu** - Open menu, click Edit, modify content, save
- [ ] **Delete Menu** - Delete menu, confirm deletion works
- [ ] **Menu Preview** - Toggle between edit and preview modes, verify Markdown renders

### Image Upload

- [ ] **Paste Image** - Copy image to clipboard, paste into recipe editor (Cmd/Ctrl+V)
- [ ] **Image Compression** - Paste large image, verify it compresses (check network tab for file size)
- [ ] **Image Display** - Save recipe with image, verify image displays in preview
- [ ] **Multiple Images** - Paste multiple images into one recipe
- [ ] **Firebase Storage** - Check Debug modal to verify images uploaded to Firebase Storage
- [ ] **Fallback Mode** - Disable Firebase (rename .env), paste image, verify base64 fallback works

### Authentication System

- [ ] **Email/Password Signup** - Go to `/signup`, create account with username/email/password
- [ ] **Email/Password Login** - Go to `/login`, sign in with credentials
- [ ] **Google Sign-In (New User)** - Click "Continue with Google", enter username when prompted
- [ ] **Google Sign-In (Returning User)** - Sign in with Google, verify auto-login without username prompt
- [ ] **Auth Persistence** - Refresh page while logged in, verify stays logged in
- [ ] **Logout** - Click logout from navbar menu, verify redirects to `/login`
- [ ] **Protected Routes** - Try accessing `/` while logged out, verify redirects to `/login`

### Multi-User Architecture & Data Isolation

- [ ] **User Isolation** - Create recipe as user A, sign in as user B, verify can't see user A's recipes
- [ ] **Current User Display** - Open navbar menu dropdown, verify Gravatar and @username shown
- [ ] **Viewing User Display** - Check sidebar, verify correct user's Gravatar and @username shown
- [ ] **UserId Queries** - Check console for `✅ Resolved username → userId: ...` messages
- [ ] **URL Updates** - Navigate between views, verify URLs update with correct username prefix
- [ ] **Browser Navigation** - Use back/forward buttons, verify views load correctly from URL
- [ ] **Create Recipe** - Verify new recipe has `userId` field in Firestore
- [ ] **Data Ownership** - Try editing another user's recipe via direct URL, verify fails

### Permission-Based UI (Read-Only Mode)

- [ ] **Own Content** - Navigate to your own content, verify all edit/delete/create buttons visible
- [ ] **Other User's Content** - Navigate to `/{otherUser}/recipe/...`, verify edit/delete buttons hidden
- [ ] **New Recipe Hidden** - When viewing another user's catalog, verify "New Recipe" menu item hidden
- [ ] **Add to Collection Hidden** - On another user's recipe, verify "Add to Collection" button hidden
- [ ] **Create Buttons Hidden** - On another user's home/collections/menus views, verify buttons hidden
- [ ] **Collections List** - View another user's collections list, verify no edit/delete buttons on cards
- [ ] **Collection Detail** - View another user's collection detail, verify no edit/delete buttons
- [ ] **Menus List** - View another user's menus list, verify no edit/delete buttons on cards
- [ ] **Switch Back** - Navigate back to your own content, verify edit controls reappear
- [ ] **Sidebar Username Link** - Click username/avatar in sidebar, verify navigates to user's home page
- [ ] **Console Logging** - Check for `🔒 Edit controls shown/hidden` messages in console

### Staff Features

- [ ] **Debug Menu (Staff)** - As staff user (`isStaff: true`), verify Debug Info menu item visible
- [ ] **Debug Menu (Non-Staff)** - As regular user, verify Debug Info menu item hidden
- [ ] **Staff Console Log** - Check for 🛠️ Staff indicator in console when staff user logs in

### Profile Page & Bio

- [ ] **Profile Layout** - Navigate to user profile, verify horizontal layout with circular avatar (150px)
- [ ] **Profile Stats** - Verify inline follower/following counts display correctly ("354 followers" format)
- [ ] **Bio Display** - If user has bio, verify it displays below stats with line breaks preserved
- [ ] **Empty Bio** - View profile without bio, verify bio section is hidden
- [ ] **Follow Button** - Verify follow button is subtle and small (100px max-width, 6px border radius)
- [ ] **Own Profile** - Navigate to your own profile, verify follow button is hidden
- [ ] **Skeleton Loading** - Refresh profile page, verify skeleton shimmer displays during avatar load
- [ ] **Avatar Load** - Verify skeleton disappears only after avatar image fully loads
- [ ] **Bio Settings** - Go to `/settings`, verify bio textarea with character counter (160 max)
- [ ] **Bio Save** - Edit bio, click save, verify success message and bio updates
- [ ] **Bio Character Count** - Type in bio field, verify real-time character counter updates

### Navigation & Scrolling

- [ ] **Scroll to Top** - Click recipe from profile, verify page scrolls to top of recipe
- [ ] **History Navigation** - Use browser back button, verify scroll position resets appropriately
- [ ] **No Flash** - Navigate between pages, verify smooth scroll without fighting browser behavior
- [ ] **Focus Behavior** - Check that recipe title receives focus briefly (for accessibility)

### Sidebar & Toggle Visibility

- [ ] **Logged Out** - While logged out, verify sidebar and toggle button are completely hidden
- [ ] **No Flash** - Refresh page while logged out, verify no flash of sidebar before hiding
- [ ] **Login Transition** - Log in, verify sidebar and toggle appear smoothly
- [ ] **Logout Transition** - Log out, verify sidebar and toggle hide immediately

### Skeleton Loading States

- [ ] **Avatar Skeleton** - Load profile page, verify circular skeleton with shimmer animation
- [ ] **Text Skeleton** - Verify username and stats show skeleton shimmer before data loads
- [ ] **Smooth Transition** - Watch skeleton transition to actual content, verify no layout shift
- [ ] **Image Failure** - Block image loading (DevTools), verify skeleton remains until timeout

### Gravatar Integration

- [ ] **User Avatars** - Verify avatars appear in navbar dropdown and sidebar
- [ ] **Fallback Images** - Check that identicon default appears for users without Gravatar
- [ ] **High-Res Display** - Inspect avatars on high-DPI screens, verify they're sharp (128px source scaled down)

### Navigation & UI

- [ ] **Sidebar Toggle** - On mobile/narrow viewport, verify hamburger menu toggles sidebar
- [ ] **Navbar Dropdown** - Click ☰ menu button, verify dropdown opens with all items
- [ ] **Home View** - Navigate to `/{username}`, verify collections and menus grid displays
- [ ] **Search/Filter** - Type in search box, verify recipe list filters in real-time
- [ ] **Empty States** - View user with no recipes/collections/menus, verify helpful empty messages
- [ ] **Mobile Responsive** - Test on mobile viewport, verify layout adapts properly

### Firebase Integration

- [ ] **Online Mode** - With Firebase configured, verify all operations work
- [ ] **Offline Fallback** - Rename .env file, restart server, verify memory storage works
- [ ] **Debug Modal** - Open Debug Info from navbar menu, verify shows Firebase status, counts
- [ ] **Data Persistence** - Create recipe with Firebase, refresh page, verify data persists
- [ ] **Memory Mode Limit** - In memory mode, refresh page, verify data is lost (expected behavior)

### URL Routing & Deep Links

- [ ] **Direct Recipe Link** - Open `/{username}/recipe/{slug}-{id}` directly, verify loads correctly
- [ ] **Direct Collection Link** - Open `/{username}/collection/{slug}-{id}` directly
- [ ] **Direct Menu Link** - Open `/{username}/menu/{slug}-{id}` directly
- [ ] **404 Handling** - Try invalid recipe ID, verify graceful error
- [ ] **Shareable URLs** - Copy URL, open in incognito/different browser, verify works

### Error Handling & Edge Cases

- [ ] **Empty Recipe Title** - Create recipe with no title, verify defaults to "Untitled"
- [ ] **Empty Menu Name** - Try to create menu with no name, verify validation error and focus
- [ ] **Very Long Content** - Create recipe with 10,000+ characters, verify saves and renders
- [ ] **Special Characters** - Use emoji, unicode, special chars in titles/content
- [ ] **Concurrent Edits** - Open same recipe in two tabs, edit in both, verify last-save wins
- [ ] **Network Failure** - Disconnect internet while saving, verify error message shows
- [ ] **Invalid Markdown** - Use malformed Markdown, verify it still renders (gracefully degrades)

### Performance & UX

- [ ] **Initial Load** - Clear cache, reload app, verify loads in under 2 seconds
- [ ] **Navigation Speed** - Click through multiple views rapidly, verify smooth transitions
- [ ] **Large Recipe List** - With 50+ recipes, verify sidebar scrolls smoothly and search is fast
- [ ] **Image Loading** - Scroll through collection with many images, verify lazy loading/smooth experience

## Test Coverage Notes

### Currently Not Tested

- Automated tests (no test suite yet)
- TypeScript type checking (pure JavaScript)
- Browser compatibility (mainly tested on Chrome/Safari)
- Accessibility (WCAG compliance not verified)
- Performance benchmarks (no automated metrics)

### Known Limitations

- Memory storage fallback loses data on restart (expected)
- No offline support for Firebase mode
- Image uploads limited to 5MB
- No rate limiting on API endpoints
