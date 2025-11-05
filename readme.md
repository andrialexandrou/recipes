# Recipe Manager

A personal recipe manager with markdown support and cloud sync via Firebase.

## Features

- Write recipes in markdown
- Edit/view mode toggle
- Real-time filtering
- Cloud storage with Firebase
- Clean, simple interface
- Keyboard shortcuts

## Keyboard Shortcuts

- `Ctrl/Cmd + N` - New recipe
- `Ctrl/Cmd + S` - Save recipe
- `Ctrl/Cmd + E` - Toggle edit/view mode

## Setup

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for Firebase configuration.

See [DEPLOYMENT.md](DEPLOYMENT.md) for deploying to Vercel.

## Local Development

1. Copy `.env.example` to `.env`
2. Add your Firebase credentials to `.env`
3. Install dependencies: `npm install`
4. Run: `npm run dev`
5. Visit `http://localhost:3000`

## Security

- Firebase credentials are stored as environment variables
- `.gitignore` prevents secrets from being committed
- Firestore rules control database access