# Feature Backlog

Future features and improvements for Sous.

## Quick Wins (Small Effort)

- **Improve Print Styling** - Make recipes and menus look professional and well-formatted when using browser print function (styling, page breaks, typography)
- **Reset Password** - Allow users to reset their password via email

## Medium Effort

- **Open Graph Cards for Social Sharing** - Generate Open Graph meta tags for recipes, collections, and menus to create rich preview cards when sharing links. Use page content and user-provided images to auto-generate cards. Optional: As a pro feature, use AI to generate enhanced cards with title, estimated duration from recipe notes, basic instructions, etc.
- **Vertical Menu Cards with Header Images** - Make menu cards vertical (Pinterest-style) with optional header images for better visual appeal and social sharing
- **Public Content Viewing (Logged Out)** - Allow viewing user content via direct links when logged out, only redirect to login for app navigation
- **Export User Content** - Export all recipes, collections, and menus as JSON or Markdown
- **Turn a Collection into a PDF Cookbook** - Generate a formatted PDF from a collection's recipes
- **Import/Migration Tool** - Allow users to bulk import recipes from various file formats (PDF, Markdown, HTML, text files) to populate their catalog after account creation. Implementation: Use Vercel AI SDK with user-provided API keys stored securely in their Firestore user document. Let users attach their own OpenAI/Anthropic key for AI-powered parsing, or start with simple markdown/text imports without AI. Trade-off: User provides key (no cost to app) vs. built-in credits (simpler UX but ongoing costs).

## Large Features

- **Follow Users** - Allow users to follow other users to see their content
- **Activity Feed/Wall** - Show a feed of recent recipes, collections, and menus created by followed users

## Potential Features (Brainstorming)

- Recipe sharing/permissions (public/private recipes)
- Recipe tags/categories beyond collections
- Search across all fields (not just title)
- Recipe import from URLs
- Meal planning calendar
- Shopping list generation
- Recipe ratings/favorites
- Comments on recipes

## Technical Debt

- No automated tests yet (need tests that load each view across multiple users to verify data isolation and permissions)
- No TypeScript (pure JavaScript)
- No build process (ships raw files)
- Memory storage fallback loses data on restart
