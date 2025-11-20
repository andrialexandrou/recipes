# Sous - Recipe Manager

A personal recipe management application with a focus on simplicity, elegance, and user experience. Create, organize, and share recipes using Markdown, with support for collections, menus, and social features.

## ✨ Features

- 📝 **Markdown Recipes** - Write and edit recipes with a WYSIWYG editor
- 🖼️ **Paste-to-Upload Images** - Just paste images directly into recipes
- 📚 **Collections & Menus** - Organize recipes into collections and create curated menus
- 👥 **Social Features** - Follow other users, activity feed, user search
- 🎨 **Beautiful UI** - Minimalist design with elegant typography and warm neutrals
- 🔒 **Multi-User** - Each user has their own isolated data namespace
- 📱 **Mobile-First** - Responsive design that works on all devices
- ☁️ **Cloud Sync** - Firebase backend with graceful fallback to memory storage

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Firebase credentials to .env

# Start development server
npm run dev
```

Visit `http://localhost:3000` (or 3001 if 3000 is occupied)

### Environment Variables

Required in `.env`:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

## 📖 Documentation

- **[FEATURES.md](FEATURES.md)** - Detailed feature documentation
- **[TESTING.md](TESTING.md)** - Manual testing scenarios and smoke tests
- **[changelog.md](changelog.md)** - Version history and changes
- **[backlog.md](backlog.md)** - Planned features and improvements
- **[agents.md](agents.md)** - Architecture and development guidelines

## 🏗️ Tech Stack

**Frontend:**
- Vanilla JavaScript (no framework)
- marked.js for Markdown rendering
- EasyMDE for WYSIWYG editing
- Font Awesome icons

**Backend:**
- Node.js + Express
- Firebase (Firestore + Storage)
- Memory fallback for local development

**Deployment:**
- Vercel for hosting
- Firebase for backend services

## 🔐 Security

- Firebase credentials stored as environment variables
- `.gitignore` prevents secrets from being committed
- Firebase Auth with email/password + Google OAuth
- Server-side validation and authorization
- Per-user data isolation with userId-based queries

## 🎨 Design Philosophy

- **Minimalist & Clean** - No clutter, focus on content
- **Elegant Typography** - Georgia/Garamond serif fonts
- **Warm Neutral Palette** - Earthy browns, off-white backgrounds
- **Progressive Enhancement** - Works without JavaScript where possible
- **Mobile-First** - Responsive design from the ground up

## 🤝 Contributing

This is a personal project, but feedback and suggestions are welcome!

## 📝 License

All rights reserved.