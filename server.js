require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Add CORS headers for local development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Firebase client configuration (server-side only)
let db = null;
let useFirebase = false;

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(value => value && value !== 'your_api_key_here');

async function initializeFirebase() {
    if (!hasFirebaseConfig) {
        console.log('⚠️  Firebase configuration incomplete or missing');
        console.log('📝 Using memory storage');
        return false;
    }
    
    try {
        console.log('✅ Firebase configuration detected');
        console.log('🔄 Attempting to initialize Firebase...');
        
        // Try to load Firebase modules
        const { initializeApp } = require('firebase/app');
        const { getFirestore, connectFirestoreEmulator, enableNetwork } = require('firebase/firestore');
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        // Test connection with a simple operation
        const { collection, getDocs, limit, query } = require('firebase/firestore');
        
        // Try to read a small amount of data to test connection
        console.log('🔄 Testing Firebase connection...');
        const testQuery = query(collection(db, 'recipes'), limit(1));
        await getDocs(testQuery);
        
        useFirebase = true;
        console.log('✅ Firebase connected successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Firebase connection failed:', error.code || error.message);
        
        if (error.code === 'permission-denied') {
            console.log('🔒 Permission denied - check Firestore security rules');
        } else if (error.code === 'unavailable') {
            console.log('🌐 Network unavailable - check internet connection');
        } else if (error.message.includes('firebase')) {
            console.log('📦 Firebase package issue - run: npm install firebase');
        }
        
        console.log('📝 Falling back to memory storage');
        useFirebase = false;
        db = null;
        return false;
    }
}

// In-memory storage fallback
let recipes = [];
let collections = [
    { id: '1', name: 'Freezer Friendly', description: 'Meals that freeze well for busy weeknights', recipeIds: [] },
    { id: '2', name: 'Healthy Treats', description: 'Guilt-free desserts and snacks', recipeIds: [] },
    { id: '3', name: 'Quick Dinners', description: '30 minutes or less from start to finish', recipeIds: [] },
    { id: '4', name: 'Potluck Friendly', description: 'Crowd-pleasers that travel well', recipeIds: [] }
];

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        firebase: useFirebase,
        timestamp: new Date().toISOString()
    });
});

// Get all recipes
app.get('/api/recipes', async (req, res) => {
    try {
        if (useFirebase && db) {
            try {
                const { collection, getDocs } = require('firebase/firestore');
                const querySnapshot = await getDocs(collection(db, 'recipes'));
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
                    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
                }));
                console.log(`🔥 Retrieved ${data.length} recipes from Firebase`);
                res.json(data);
            } catch (firebaseError) {
                console.error('❌ Firebase recipes fetch failed:', firebaseError.message);
                console.log('📝 Falling back to memory storage for this request');
                res.json(recipes);
            }
        } else {
            console.log('📝 Retrieved recipes from memory storage');
            res.json(recipes);
        }
    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single recipe
app.get('/api/recipes/:id', async (req, res) => {
    try {
        if (useFirebase) {
            const { doc, getDoc } = require('firebase/firestore');
            const docRef = doc(db, 'recipes', req.params.id);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                return res.status(404).json({ error: 'Recipe not found' });
            }
            res.json({
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || docSnap.data().createdAt,
                updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() || docSnap.data().updatedAt
            });
        } else {
            const recipe = recipes.find(r => r.id === req.params.id);
            if (!recipe) {
                return res.status(404).json({ error: 'Recipe not found' });
            }
            res.json(recipe);
        }
    } catch (error) {
        console.error('Error fetching recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create recipe
app.post('/api/recipes', async (req, res) => {
    try {
        const { title, content } = req.body;
        
        if (useFirebase && db) {
            try {
                const { collection, addDoc, serverTimestamp } = require('firebase/firestore');
                const newRecipe = {
                    title: title || '',
                    content: content || '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                const docRef = await addDoc(collection(db, 'recipes'), newRecipe);
                const result = {
                    id: docRef.id,
                    title: title || '',
                    content: content || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                console.log('🔥 Recipe created in Firebase:', docRef.id);
                res.json(result);
            } catch (firebaseError) {
                console.error('❌ Firebase recipe creation failed:', firebaseError.message);
                throw firebaseError; // Re-throw to use memory fallback
            }
        } else {
            const newRecipe = {
                id: Date.now().toString(),
                title: title || '',
                content: content || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            recipes.push(newRecipe);
            console.log('📝 Recipe created in memory storage:', newRecipe.id);
            res.json(newRecipe);
        }
    } catch (error) {
        console.error('Error creating recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update recipe
app.put('/api/recipes/:id', async (req, res) => {
    try {
        const { title, content } = req.body;
        
        if (useFirebase) {
            const { doc, updateDoc, serverTimestamp } = require('firebase/firestore');
            const docRef = doc(db, 'recipes', req.params.id);
            const updates = {
                title,
                content,
                updatedAt: serverTimestamp()
            };
            await updateDoc(docRef, updates);
            res.json({
                id: req.params.id,
                ...updates,
                updatedAt: new Date().toISOString()
            });
        } else {
            const recipe = recipes.find(r => r.id === req.params.id);
            if (!recipe) {
                return res.status(404).json({ error: 'Recipe not found' });
            }
            const updates = {
                title,
                content,
                updatedAt: new Date().toISOString()
            };
            Object.assign(recipe, updates);
            res.json(recipe);
        }
    } catch (error) {
        console.error('Error updating recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete recipe
app.delete('/api/recipes/:id', async (req, res) => {
    try {
        if (useFirebase) {
            const { doc, deleteDoc } = require('firebase/firestore');
            await deleteDoc(doc(db, 'recipes', req.params.id));
            res.json({ success: true });
        } else {
            recipes = recipes.filter(r => r.id !== req.params.id);
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Error deleting recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all collections
app.get('/api/collections', async (req, res) => {
    try {
        if (useFirebase && db) {
            try {
                const { collection, getDocs, doc, setDoc } = require('firebase/firestore');
                const querySnapshot = await getDocs(collection(db, 'collections'));
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                console.log(`🔥 Retrieved ${data.length} collections from Firebase`);
                
                // If no collections exist in Firebase, try to create default ones
                if (data.length === 0) {
                    console.log('📝 No collections found in Firebase, attempting to create defaults...');
                    try {
                        // Try to create default collections in Firebase
                        for (const defaultCollection of collections) {
                            const docRef = doc(db, 'collections', defaultCollection.id);
                            await setDoc(docRef, {
                                name: defaultCollection.name,
                                description: defaultCollection.description,
                                recipeIds: defaultCollection.recipeIds || []
                            });
                        }
                        console.log('✅ Default collections created in Firebase');
                        return res.json(collections);
                    } catch (createError) {
                        console.log('⚠️  Could not create default collections in Firebase:', createError.message);
                        return res.json(collections);
                    }
                }
                
                res.json(data);
            } catch (firebaseError) {
                console.error('❌ Firebase collections fetch failed:', firebaseError.message);
                
                if (firebaseError.code === 'permission-denied') {
                    console.log('🔒 Permission denied for collections - check Firestore security rules');
                    console.log('💡 Add this rule to allow collections access:');
                    console.log('   allow read, write: if true; // or your custom rules');
                }
                
                console.log('📝 Falling back to memory storage for this request');
                res.json(collections);
            }
        } else {
            console.log('📝 Retrieved collections from memory storage');
            res.json(collections);
        }
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create collection
app.post('/api/collections', async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (useFirebase && db) {
            try {
                const { collection, addDoc } = require('firebase/firestore');
                const newCollection = {
                    name,
                    description: description || '',
                    recipeIds: []
                };
                const docRef = await addDoc(collection(db, 'collections'), newCollection);
                const result = {
                    id: docRef.id,
                    ...newCollection
                };
                console.log('🔥 Collection created in Firebase:', docRef.id);
                res.json(result);
            } catch (firebaseError) {
                console.error('❌ Firebase collection creation failed:', firebaseError.message);
                if (firebaseError.code === 'permission-denied') {
                    console.log('🔒 Permission denied for creating collections');
                }
                // Fall back to memory storage
                const newCollection = {
                    id: Date.now().toString(),
                    name,
                    description: description || '',
                    recipeIds: []
                };
                collections.push(newCollection);
                console.log('📝 Collection created in memory storage:', newCollection.id);
                res.json(newCollection);
            }
        } else {
            const newCollection = {
                id: Date.now().toString(),
                name,
                description: description || '',
                recipeIds: []
            };
            collections.push(newCollection);
            console.log('📝 Collection created in memory storage:', newCollection.id);
            res.json(newCollection);
        }
    } catch (error) {
        console.error('Error creating collection:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update collection
app.put('/api/collections/:id', async (req, res) => {
    try {
        const { name, description, recipeIds } = req.body;
        
        if (useFirebase) {
            const { doc, updateDoc } = require('firebase/firestore');
            const docRef = doc(db, 'collections', req.params.id);
            const updates = { name, description, recipeIds: recipeIds || [] };
            await updateDoc(docRef, updates);
            res.json({ id: req.params.id, ...updates });
        } else {
            const collection = collections.find(c => c.id === req.params.id);
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            const updates = { name, description, recipeIds };
            Object.assign(collection, updates);
            res.json(collection);
        }
    } catch (error) {
        console.error('Error updating collection:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve static files (CSS, JS, etc) with proper headers
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path, stat) => {
        // Set proper content types for different file types
        if (path.endsWith('.css')) {
            res.set('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        } else if (path.endsWith('.html')) {
            res.set('Content-Type', 'text/html');
        }
    }
}));

// Serve index.html for all SPA routes (but not for static assets)
app.get('*', (req, res) => {
    // Don't serve index.html for API routes or static assets
    if (req.path.startsWith('/api/') || 
        req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return res.status(404).send('File not found');
    }
    
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await initializeFirebase();
});