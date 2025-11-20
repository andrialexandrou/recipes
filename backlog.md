# Feature Backlog

Future features and improvements for Sous.

## 🚀 GA Blockers (Must-Have Before Launch)

- **Gravatar Avatar Indicator** - Add visual indicator to inform users that their avatar is pulled from Gravatar. Include a quick link with Font Awesome icon to gravatar.com for easy setup. This helps users understand where their profile picture comes from and how to customize it.
- **Configure PWA and Open Graph for my-sous.com** - Update all PWA manifest settings, Open Graph meta tags, and related configuration to use my-sous.com as the primary domain. Remove or deprioritize Vercel app URLs. Ensure PWA behavior works correctly on the custom domain (currently broken—see Bugs section).
- **Fix Image Upload in Markdown Editor** - Image paste-to-upload is not working in the markdown editor. Need to debug and fix the paste event handling, compression, and upload flow.

## Recently Completed ✅

- **Hide Sidebar Toggle for Logged Out Users** - ✅ The hamburger menu toggle button (left side of navbar) is now hidden when not logged in
- **Scroll to Top on Navigation** - ✅ Added automatic scroll to top on all navigation events for better UX
- **Profile Hero Skeleton UI** - ✅ Added skeleton loading states for profile hero section (avatar, username, stats, follow button)
- **Empty Feed State with Sample Content** - ✅ New users see sample content from staff account when feed is empty
- **Reset Password** - ✅ Users can now reset their password via email
- **User Profile Page (LTK-inspired)** - ✅ Dedicated profile page at `/{username}` with hero section (avatar, bio, stats), follow button, tabbed content navigation (Recipes/Collections/Menus), and visual grid layout
- **User Account Settings Page** - ✅ Created `/settings` page where users can adjust account settings (search visibility toggle), update bio/avatar, change password, and delete account
- **Following/Followers List View** - ✅ Tabbed modal showing following and followers lists with avatars, bios, and follow/unfollow actions. Single optimized endpoint fetches both lists in one request.
- **Public Changelog Page** - ✅ User-facing "What's New" page accessible from navbar menu. Highlights features in friendly language with visual indicators for new features, improvements, and fixes.
- **Reusable Modal System (ModalUtils)** - ✅ Created consistent modal utility with focus trapping, escape key handling, and overlay click handling. All modals (debug, follow, settings password/delete) now use this system.
- **Follow Users** - ✅ Implemented fan-out architecture for follows
- **Activity Feed/Wall** - ✅ Personal feed showing followed users' content
- **Copy Link for Collections** - ✅ Added copy link button to collections list view and detail view
- **Convert All URLs to Anchor Tags** - ✅ Every URL in the app is now a proper `<a>` tag for accessibility and expected browser behavior
- **User Search** - ✅ Search for users in the system by username or name to discover and follow them. Requires login. Users can opt-out via settings.
- **Breadcrumbs with Username Navigation** - ✅ All views now have breadcrumbs with username navigation (@username > Section > Item). Provides consistent wayfinding across recipes (sidebar and collection views), collections, and menus.
- **Double Click Bug on Cards** - ✅ Fixed event propagation issue requiring double-clicks on collection/menu cards
- **Admin Badge for Creator** - ✅ Displays sparkle (✦) badge next to staff usernames throughout the app (sidebar, activity feed, search results). Helps users identify who to reach out to for support.
- **Copy Recipe Content** - ✅ Added "Copy Content As" options to share dropdown with format choices: Markdown (source), Plain Text (stripped formatting), or HTML (rendered). Available on recipes and menus.
- **Share Button with Options** - ✅ Converted single copy link button to share dropdown menu with "Copy Link" and "Copy Content As" options (Original/Plain Text/Rich Text). Unified sharing experience across recipes and menus. Dropdown auto-closes on selection for clear feedback.
- **Collection Edit Bug** - ✅ Fixed bug where editing collection name/description would delete all recipes. Server now uses partial updates, only modifying fields explicitly provided in request.

## 🐛 Bugs

- **Custom Domain Does Not Trigger PWA Behavior** - When adding to home screen from my-sous.com (custom domain), iOS does not treat it as a native web app like it does with the Vercel URL. The custom domain opens in Safari instead of standalone mode. Works correctly on Vercel domain. Attempted fixes: dynamic manifest.json endpoint, proper MIME types, iOS-specific meta tags, cache headers. Needs deeper investigation into domain configuration, SSL certificates, or iOS-specific caching behavior.

## Quick Wins (Small Effort)

- **Improve Print Styling** - Make recipes and menus look professional and well-formatted when using browser print function (styling, page breaks, typography)

## Medium Effort

- **Pull-to-Refresh for iOS Home Screen App** - Enable native iOS pull-to-refresh gesture when app is installed on iPhone home screen. Current fixed layout with `overflow: hidden` on body prevents native gesture. Options: (1) Restructure layout to make body scrollable instead of internal containers, or (2) Implement custom pull-to-refresh that works with current scrollable containers. Trade-off: Layout restructure (enables native iOS feature) vs. custom implementation (keeps current design intact).
- **Collection Activity Feed** - Add new activity type `recipe_added_to_collection` to show when users add recipes to their collections. This gives more visibility to curation activity and helps followers discover recipes through collections.
- **Dynamic Open Graph Tags for Shared Links** - Make Open Graph metadata contextual based on what's being shared. When someone shares a link to a recipe, collection, menu, or user profile, the social media preview card should reflect that specific content—recipe title/description, collection name, menu details, or user profile info—instead of generic "Sous, recipes worth sharing" text. Server-side rendering or meta tag injection needed to ensure crawlers see the right data.
- **Open Graph Cards for Social Sharing** - Generate Open Graph meta tags for recipes, collections, and menus to create rich preview cards when sharing links. Use page content and user-provided images to auto-generate cards. Optional: As a pro feature, use AI to generate enhanced cards with title, estimated duration from recipe notes, basic instructions, etc.
- **Rich Recipe Cards** - Generate beautiful, structured recipe cards with parsed metadata (temp, time, prep time, ingredients, steps, key points). See `public/example-recipe-card.png` for reference design. This may be separate from Open Graph images—more comprehensive than what fits in a social media preview.
- **Recipe Scrapbooks** - Add a scrapbook/memory section to each recipe to preserve personal history: original handwritten cards from grandma, photos from each time you made it, notes about what occasion it was for, who you made it with, etc. A timeline of memories attached to each recipe.
- **Vertical Menu Cards with Header Images** - Make menu cards vertical (Pinterest-style) with optional header images for better visual appeal and social sharing
- **Export User Content** - Export all recipes, collections, and menus as JSON or Markdown
- **Turn a Collection into a PDF Cookbook** - Generate a formatted PDF from a collection's recipes
- **Import/Migration Tool** - Allow users to bulk import recipes from various file formats (PDF, Markdown, HTML, text files) to populate their catalog after account creation. Implementation: Use Vercel AI SDK with user-provided API keys stored securely in their Firestore user document. Let users attach their own OpenAI/Anthropic key for AI-powered parsing, or start with simple markdown/text imports without AI. Trade-off: User provides key (no cost to app) vs. built-in credits (simpler UX but ongoing costs).

## Large Features

- **Redesign Mobile Experience** - The current responsive web experience feels odd on mobile. Need to fully redesign the mobile experience to be truly mobile-first with native-feeling interactions, gestures, and navigation patterns. May require building a separate mobile-optimized app/view rather than just responsive CSS adjustments. Consider: touch-first interactions, bottom navigation, card-based UI, swipe gestures, mobile-specific editing UX. **Important: Increase font sizes significantly for mobile - current text is too small for comfortable phone use. Ideally detect mobile context and apply larger typography scale.**
- **Pinned Content & User Overview Page Redesign** - Restructure the user overview page (`/{username}`) to show content in this order: Recipes, Menus, Collections. Add a "Pinned" section at the top where users can pin their favorite/featured items. On mobile, show grouped sections that display up to 6-8 items of each type with a "View All" link to see the full list. Implementation details:
  - Add `isPinned` boolean field to recipes, menus, and collections
  - Add pin/unpin action button to each item (star icon or pin icon)
  - Set max pinned items limit (6 or 8 total across all types)
  - When limit exceeded, show dialog: "You need to unpin another item before you can pin this one"
  - Pinned section shows mixed content types in order of pinning (or by type grouping - TBD)
  - Mobile view: Cap sections at 6-8 items each with "See all [count] recipes" link
  - Desktop view: Show more items or full scrollable sections (UX TBD)

## Potential Features (Brainstorming)

- **Shared Authorship / Collaborative Recipes** - Allow multiple users to co-author a recipe, collection, or menu. One person owns it, but they can add other users as editors who can make changes. This enables families to maintain shared recipe collections, cooking groups to collaborate on menus, etc. Implementation: Add `editors: [userId]` array field to recipes/collections/menus. Since nothing is currently private, focus on editor permissions (not viewer permissions). UI: Add "Share with Editor" button that searches for users and adds them. Show collaborator avatars on the document. Trade-off: Need to introduce basic permissions model (owner vs editor) but avoid complexity of full ACL system.
- **Export Recipes as PDF Book** - Generate a formatted PDF book from selected recipes or entire catalog with professional layout, table of contents, and typography
- **Recipe Notes/Modifications** - Add a notes field to track what you changed or tweaked in a recipe (e.g., "Used less salt", "Doubled the garlic", "Baked at 375° instead")
- **Potluck Planning Templates** - Templates or blank forms for potluck planning (who's bringing what, dietary restrictions, serving sizes, etc.)
- **Recipe Import from URLs** - Use AI to intelligently extract and parse recipe data from various website formats. Implementation: Use Vercel AI SDK with user-provided API keys (same model as Import/Migration Tool)
- **Shopping List Generation** - Use AI to extract ingredients from recipe markdown and intelligently consolidate across multiple recipes. Note: Uncertain how much shopping list functionality to offer—keep scope minimal for now
- Recipe sharing/permissions (public/private recipes)
- Recipe tags/categories beyond collections
- Search across all fields (not just title)
- Meal planning calendar
- Recipe ratings/favorites
- Comments on recipes

## Technical Debt

- No automated tests yet (need tests that load each view across multiple users to verify data isolation and permissions)
- No TypeScript (pure JavaScript)
- No build process (ships raw files)
- Memory storage fallback loses data on restart
