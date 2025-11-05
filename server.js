require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the main HTML file with injected config
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Inject Firebase config from environment variables
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  };
  
  // Replace the placeholder config with actual config
  html = html.replace(
    /const firebaseConfig = \{[\s\S]*?\};/,
    `const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 12)};`
  );
  
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});