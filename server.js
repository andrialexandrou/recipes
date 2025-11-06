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
let firebaseFailureDetected = false;

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(value => value && value !== 'your_api_key_here');

// Function to disable Firebase and switch to memory storage
function disableFirebaseMode(reason) {
    if (useFirebase) {
        console.log(`🚫 Disabling Firebase mode: ${reason}`);
        console.log('📝 Switching entire app to memory storage mode');
    }
    useFirebase = false;
    firebaseFailureDetected = true;
    db = null;
}

async function initializeFirebase() {
    if (!hasFirebaseConfig) {
        console.log('⚠️  Firebase configuration incomplete or missing');
        console.log('📝 Using memory storage for entire app');
        return false;
    }
    
    try {
        console.log('✅ Firebase configuration detected');
        console.log('🔄 Attempting to initialize Firebase...');
        
        // Try to load Firebase modules
        const { initializeApp } = require('firebase/app');
        const { getFirestore } = require('firebase/firestore');
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        // Test connection with both collections and recipes
        const { collection, getDocs, limit, query } = require('firebase/firestore');
        
        console.log('🔄 Testing Firebase connection for recipes...');
        const recipesQuery = query(collection(db, 'recipes'), limit(1));
        await getDocs(recipesQuery);
        
        console.log('🔄 Testing Firebase connection for collections...');
        const collectionsQuery = query(collection(db, 'collections'), limit(1));
        await getDocs(collectionsQuery);
        
        useFirebase = true;
        firebaseFailureDetected = false;
        console.log('✅ Firebase fully connected - both recipes and collections accessible');
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
        
        disableFirebaseMode(error.code || error.message);
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
        firebaseFailure: firebaseFailureDetected,
        timestamp: new Date().toISOString()
    });
});

// Get all recipes
app.get('/api/recipes', async (req, res) => {
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
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
                disableFirebaseMode('Recipe fetch failed: ' + firebaseError.message);
                console.log('📝 Using memory storage for this and all future requests');
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
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const { doc, getDoc } = require('firebase/firestore');
                const docRef = doc(db, 'recipes', req.params.id);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) {
                    return res.status(404).json({ error: 'Recipe not found' });
                }
                const data = {
                    id: docSnap.id,
                    ...docSnap.data(),
                    createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || docSnap.data().createdAt,
                    updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() || docSnap.data().updatedAt
                };
                console.log('🔥 Retrieved recipe from Firebase:', req.params.id);
                res.json(data);
            } catch (firebaseError) {
                console.error('❌ Firebase get recipe failed:', firebaseError.message);
                disableFirebaseMode('Get recipe failed: ' + firebaseError.message);
                // Fall back to memory storage
                const recipe = recipes.find(r => r.id === req.params.id);
                if (!recipe) {
                    return res.status(404).json({ error: 'Recipe not found' });
                }
                console.log('📝 Retrieved recipe from memory storage:', req.params.id);
                res.json(recipe);
            }
        } else {
            const recipe = recipes.find(r => r.id === req.params.id);
            if (!recipe) {
                return res.status(404).json({ error: 'Recipe not found' });
            }
            console.log('📝 Retrieved recipe from memory storage:', req.params.id);
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
        
        if (useFirebase && db && !firebaseFailureDetected) {
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
                disableFirebaseMode('Recipe creation failed: ' + firebaseError.message);
                // Fall back to memory storage for this request
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
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const { doc, updateDoc, serverTimestamp } = require('firebase/firestore');
                const docRef = doc(db, 'recipes', req.params.id);
                const updates = {
                    title: title || '',
                    content: content || '',
                    updatedAt: serverTimestamp()
                };
                await updateDoc(docRef, updates);
                const result = {
                    id: req.params.id,
                    title: title || '',
                    content: content || '',
                    updatedAt: new Date().toISOString()
                };
                console.log('🔥 Recipe updated in Firebase:', req.params.id);
                res.json(result);
            } catch (firebaseError) {
                console.error('❌ Firebase recipe update failed:', firebaseError.message);
                disableFirebaseMode('Recipe update failed: ' + firebaseError.message);
                // Fall back to memory storage
                const recipe = recipes.find(r => r.id === req.params.id);
                if (!recipe) {
                    return res.status(404).json({ error: 'Recipe not found' });
                }
                const updates = { title: title || '', content: content || '', updatedAt: new Date().toISOString() };
                Object.assign(recipe, updates);
                console.log('📝 Recipe updated in memory storage:', req.params.id);
                res.json(recipe);
            }
        } else {
            const recipe = recipes.find(r => r.id === req.params.id);
            if (!recipe) {
                return res.status(404).json({ error: 'Recipe not found' });
            }
            const updates = { title: title || '', content: content || '', updatedAt: new Date().toISOString() };
            Object.assign(recipe, updates);
            console.log('📝 Recipe updated in memory storage:', req.params.id);
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
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const { doc, deleteDoc } = require('firebase/firestore');
                const docRef = doc(db, 'recipes', req.params.id);
                await deleteDoc(docRef);
                console.log('🔥 Recipe deleted from Firebase:', req.params.id);
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase recipe deletion failed:', firebaseError.message);
                disableFirebaseMode('Recipe deletion failed: ' + firebaseError.message);
                // Fall back to memory storage
                const index = recipes.findIndex(r => r.id === req.params.id);
                if (index === -1) {
                    return res.status(404).json({ error: 'Recipe not found' });
                }
                recipes.splice(index, 1);
                console.log('📝 Recipe deleted from memory storage:', req.params.id);
                res.json({ success: true });
            }
        } else {
            const index = recipes.findIndex(r => r.id === req.params.id);
            if (index === -1) {
                return res.status(404).json({ error: 'Recipe not found' });
            }
            recipes.splice(index, 1);
            console.log('📝 Recipe deleted from memory storage:', req.params.id);
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
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const { collection, getDocs, doc, setDoc } = require('firebase/firestore');
                const querySnapshot = await getDocs(collection(db, 'collections'));
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                console.log(`🔥 Retrieved ${data.length} collections from Firebase`);
                
                // If no collections exist in Firebase, return empty array (user can create collections via the UI)
                if (data.length === 0) {
                    console.log('📝 No collections found in Firebase, returning empty array');
                }
                
                res.json(data);
            } catch (firebaseError) {
                console.error('❌ Firebase collections fetch failed:', firebaseError.message);
                disableFirebaseMode('Collections fetch failed: ' + firebaseError.message);
                console.log('📝 Using memory storage for this and all future requests');
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
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const { collection, addDoc } = require('firebase/firestore');
                const newCollection = {
                    name: name || '',
                    description: description || '',
                    recipeIds: []
                };
                const docRef = await addDoc(collection(db, 'collections'), newCollection);
                const result = {
                    id: docRef.id,
                    name: name || '',
                    description: description || '',
                    recipeIds: []
                };
                console.log('🔥 Collection created in Firebase:', docRef.id);
                res.json(result);
            } catch (firebaseError) {
                console.error('❌ Firebase collection creation failed:', firebaseError.message);
                disableFirebaseMode('Collection creation failed: ' + firebaseError.message);
                // Fall back to memory storage
                const newCollection = {
                    id: Date.now().toString(),
                    name: name || '',
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
                name: name || '',
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
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const { doc, updateDoc } = require('firebase/firestore');
                const docRef = doc(db, 'collections', req.params.id);
                const updates = { name, description, recipeIds: recipeIds || [] };
                await updateDoc(docRef, updates);
                console.log('🔥 Collection updated in Firebase:', req.params.id);
                res.json({ id: req.params.id, ...updates });
            } catch (firebaseError) {
                console.error('❌ Firebase collection update failed:', firebaseError.message);
                disableFirebaseMode('Collection update failed: ' + firebaseError.message);
                // Fall back to memory storage
                const collection = collections.find(c => c.id === req.params.id);
                if (!collection) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                const updates = { name, description, recipeIds };
                Object.assign(collection, updates);
                console.log('📝 Collection updated in memory storage:', req.params.id);
                res.json(collection);
            }
        } else {
            const collection = collections.find(c => c.id === req.params.id);
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            const updates = { name, description, recipeIds };
            Object.assign(collection, updates);
            console.log('📝 Collection updated in memory storage:', req.params.id);
            res.json(collection);
        }
    } catch (error) {
        console.error('Error updating collection:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add recipe to collection
app.post('/api/collections/:id/recipes', async (req, res) => {
    try {
        const { recipeId } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const { doc, getDoc, updateDoc, arrayUnion } = require('firebase/firestore');
                const docRef = doc(db, 'collections', req.params.id);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                
                await updateDoc(docRef, {
                    recipeIds: arrayUnion(recipeId)
                });
                
                console.log(`🔥 Recipe ${recipeId} added to collection ${req.params.id} in Firebase`);
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase add recipe to collection failed:', firebaseError.message);
                disableFirebaseMode('Add recipe to collection failed: ' + firebaseError.message);
                
                // Fall back to memory storage
                const collection = collections.find(c => c.id === req.params.id);
                if (!collection) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                
                if (!collection.recipeIds) {
                    collection.recipeIds = [];
                }
                
                if (!collection.recipeIds.includes(recipeId)) {
                    collection.recipeIds.push(recipeId);
                }
                
                console.log(`📝 Recipe ${recipeId} added to collection ${req.params.id} in memory`);
                res.json({ success: true });
            }
        } else {
            const collection = collections.find(c => c.id === req.params.id);
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            
            if (!collection.recipeIds) {
                collection.recipeIds = [];
            }
            
            if (!collection.recipeIds.includes(recipeId)) {
                collection.recipeIds.push(recipeId);
            }
            
            console.log(`📝 Recipe ${recipeId} added to collection ${req.params.id} in memory`);
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Error adding recipe to collection:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete collection
app.delete('/api/collections/:id', async (req, res) => {
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const { doc, deleteDoc } = require('firebase/firestore');
                const docRef = doc(db, 'collections', req.params.id);
                await deleteDoc(docRef);
                console.log('🔥 Collection deleted from Firebase:', req.params.id);
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase collection deletion failed:', firebaseError.message);
                disableFirebaseMode('Collection deletion failed: ' + firebaseError.message);
                // Fall back to memory storage
                const index = collections.findIndex(c => c.id === req.params.id);
                if (index === -1) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                collections.splice(index, 1);
                console.log('📝 Collection deleted from memory storage:', req.params.id);
                res.json({ success: true });
            }
        } else {
            const index = collections.findIndex(c => c.id === req.params.id);
            if (index === -1) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            collections.splice(index, 1);
            console.log('📝 Collection deleted from memory storage:', req.params.id);
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Error deleting collection:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove recipe from collection
app.delete('/api/collections/:id/recipes/:recipeId', async (req, res) => {
    try {
        const { id: collectionId, recipeId } = req.params;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const { doc, getDoc, updateDoc, arrayRemove } = require('firebase/firestore');
                const docRef = doc(db, 'collections', collectionId);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                
                await updateDoc(docRef, {
                    recipeIds: arrayRemove(recipeId)
                });
                
                console.log(`🔥 Recipe ${recipeId} removed from collection ${collectionId} in Firebase`);
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase remove recipe from collection failed:', firebaseError.message);
                disableFirebaseMode('Remove recipe from collection failed: ' + firebaseError.message);
                
                // Fall back to memory storage
                const collection = collections.find(c => c.id === collectionId);
                if (!collection) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                
                if (collection.recipeIds) {
                    collection.recipeIds = collection.recipeIds.filter(id => id !== recipeId);
                }
                
                console.log(`📝 Recipe ${recipeId} removed from collection ${collectionId} in memory`);
                res.json({ success: true });
            }
        } else {
            const collection = collections.find(c => c.id === collectionId);
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            
            if (collection.recipeIds) {
                collection.recipeIds = collection.recipeIds.filter(id => id !== recipeId);
            }
            
            console.log(`📝 Recipe ${recipeId} removed from collection ${collectionId} in memory`);
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Error removing recipe from collection:', error);
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