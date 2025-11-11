require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Firebase Admin SDK (server-side only)
let admin = null;
try {
    admin = require('firebase-admin');
} catch (error) {
    console.log('📝 Firebase Admin SDK not available, will use memory storage');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies with increased limit for base64 image fallback
app.use(express.json({ limit: '10mb' }));

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

// Firebase Admin SDK configuration (server-side)
let db = null;
let bucket = null;
let useFirebase = false;
let firebaseFailureDetected = false;
let firebaseInitialized = false;

// Capture initialization logs for debugging
let initLogs = [];

function captureLog(message, level = 'info') {
    const logEntry = { level, message, timestamp: new Date().toISOString() };
    initLogs.push(logEntry);
    console.log(message);
    return logEntry;
}

// Firebase Admin config (uses service account or environment-based auth)
const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    // For production: use service account key or Application Default Credentials
    // For development: can use service account key file
};

const hasFirebaseConfig = !!(process.env.FIREBASE_PROJECT_ID);

// Debug Firebase configuration
if (!hasFirebaseConfig) {
    console.log('🔍 Firebase configuration debug:');
    console.log(`  ❌ FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? 'SET' : 'MISSING'}`);
} else {
    console.log('✅ Firebase Admin configuration detected');
}

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
        captureLog('⚠️  Firebase configuration incomplete or missing', 'warn');
        captureLog('📝 Using memory storage for entire app', 'info');
        return false;
    }
    
    if (!admin) {
        captureLog('❌ Firebase Admin SDK not available', 'error');
        return false;
    }
    
    try {
        captureLog('✅ Firebase Admin configuration detected', 'info');
        captureLog('🔄 Attempting to initialize Firebase Admin...', 'info');
        captureLog('🔍 Environment check:', 'info');
        captureLog(`  - NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`, 'info');
        captureLog(`  - VERCEL: ${process.env.VERCEL || 'undefined'}`, 'info');
        captureLog(`  - GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'SET' : 'undefined'}`, 'info');
        captureLog(`  - FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || 'undefined'}`, 'info');
        captureLog(`  - FIREBASE_SERVICE_ACCOUNT_KEY: ${process.env.FIREBASE_SERVICE_ACCOUNT_KEY ? 'SET (length: ' + process.env.FIREBASE_SERVICE_ACCOUNT_KEY.length + ')' : 'undefined'}`, 'info');
        
        // Initialize Firebase Admin
        if (admin.apps.length === 0) {
            const initConfig = {
                projectId: process.env.FIREBASE_PROJECT_ID
            };
            
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                // Local development with service account file
                captureLog('🔧 Using service account credentials from file', 'info');
                initConfig.credential = admin.credential.applicationDefault();
            } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                // Production with service account key as environment variable
                captureLog('🔧 Using service account credentials from environment variable', 'info');
                try {
                    const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                    captureLog(`🔍 Parsed service account - project: ${serviceAccountKey.project_id}, client_email: ${serviceAccountKey.client_email}`, 'info');
                    initConfig.credential = admin.credential.cert(serviceAccountKey);
                } catch (parseError) {
                    captureLog('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ' + parseError.message, 'error');
                    captureLog('🔍 First 100 chars of service account key: ' + (process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.substring(0, 100) || 'N/A'), 'error');
                    throw new Error('Invalid service account key format');
                }
            } else if (process.env.VERCEL) {
                // Vercel environment - may need explicit credential handling
                captureLog('🔧 Vercel environment detected, but no service account key provided', 'warn');
                captureLog('⚠️  Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable with JSON service account', 'warn');
                throw new Error('No credentials provided for Vercel deployment');
            } else {
                // Production - try Application Default Credentials
                captureLog('🔧 Using Application Default Credentials (production)', 'info');
                // On GCP/other cloud providers, this should work automatically
            }
            
            captureLog('🔄 Initializing Firebase Admin...', 'info');
            admin.initializeApp(initConfig);
        }
        
        db = admin.firestore();
        captureLog('✅ Firestore client created', 'info');
        
        // Initialize Storage - try multiple bucket patterns
        try {
            // Try default bucket first
            bucket = admin.storage().bucket();
            await bucket.getFiles({ maxResults: 1 }); // Test access
            captureLog('✅ Firebase Storage bucket initialized (default)', 'info');
        } catch (bucketError) {
            try {
                // Try new Firebase Storage format
                const bucketName = `${firebaseConfig.projectId}.firebasestorage.app`;
                captureLog(`🔄 Trying new format bucket: ${bucketName}`, 'info');
                bucket = admin.storage().bucket(bucketName);
                await bucket.getFiles({ maxResults: 1 }); // Test access
                captureLog('✅ Firebase Storage bucket initialized (new format)', 'info');
            } catch (newFormatError) {
                try {
                    // Try old appspot format as fallback
                    const oldBucketName = `${firebaseConfig.projectId}.appspot.com`;
                    captureLog(`🔄 Trying old format bucket: ${oldBucketName}`, 'info');
                    bucket = admin.storage().bucket(oldBucketName);
                    await bucket.getFiles({ maxResults: 1 }); // Test access
                    captureLog('✅ Firebase Storage bucket initialized (old format)', 'info');
                } catch (oldFormatError) {
                    captureLog('⚠️ Storage bucket not available: ' + oldFormatError.message, 'warn');
                    captureLog('📝 Storage features disabled - uploads will use base64 fallback', 'warn');
                    bucket = null;
                }
            }
        }
        
        // Test connection with both collections and recipes
        captureLog('🔄 Testing Firebase Admin connection for recipes...', 'info');
        const recipesRef = db.collection('recipes');
        await recipesRef.limit(1).get();
        
        captureLog('🔄 Testing Firebase Admin connection for collections...', 'info');
        const collectionsRef = db.collection('collections');
        await collectionsRef.limit(1).get();
        
        useFirebase = true;
        firebaseFailureDetected = false;
        captureLog('✅ Firebase Admin fully connected - both recipes and collections accessible', 'info');
        return true;
        
    } catch (error) {
        captureLog('❌ Firebase Admin connection failed: ' + (error.code || error.message), 'error');
        captureLog('🔍 Error stack: ' + (error.stack || 'N/A'), 'error');
        
        if (error.code === 'permission-denied') {
            captureLog('🔒 Permission denied - check Firestore security rules or service account permissions', 'error');
        } else if (error.code === 'unavailable') {
            captureLog('🌐 Network unavailable - check internet connection', 'error');
        } else if (error.message.includes('firebase')) {
            captureLog('📦 Firebase package issue - run: npm install firebase-admin', 'error');
        } else if (error.message.includes('credentials')) {
            captureLog('🔑 Credentials issue - check service account configuration', 'error');
        }
        
        disableFirebaseMode('Initialization failed: ' + error.message);
        return false;
    }
}

// Middleware to ensure Firebase is initialized (for serverless environments)
async function ensureFirebaseInitialized(req, res, next) {
    if (!firebaseInitialized) {
        captureLog('🔄 First request - initializing Firebase...', 'info');
        await initializeFirebase();
        firebaseInitialized = true;
    }
    next();
}

// Apply middleware to all API routes
app.use('/api', ensureFirebaseInitialized);

// In-memory storage fallback
let recipes = [];
let collections = [
    { id: '1', name: 'Freezer Friendly', description: 'Meals that freeze well for busy weeknights', recipeIds: [] },
    { id: '2', name: 'Healthy Treats', description: 'Guilt-free desserts and snacks', recipeIds: [] },
    { id: '3', name: 'Quick Dinners', description: '30 minutes or less from start to finish', recipeIds: [] },
    { id: '4', name: 'Potluck Friendly', description: 'Crowd-pleasers that travel well', recipeIds: [] }
];
let menus = [];
let photos = [];

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        firebase: useFirebase,
        firebaseFailure: firebaseFailureDetected,
        timestamp: new Date().toISOString(),
        environment: {
            nodeEnv: process.env.NODE_ENV || 'undefined',
            isVercel: !!process.env.VERCEL,
            hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
            hasServiceAccountKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
            hasGoogleAppCreds: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
        },
        initLogs: initLogs
    });
});

// Get all recipes
app.get('/api/recipes', async (req, res) => {
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const querySnapshot = await db.collection('recipes').get();
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
                const docRef = db.collection('recipes').doc(req.params.id);
                const docSnap = await docRef.get();
                if (!docSnap.exists) {
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
                const newRecipe = {
                    title: title || '',
                    content: content || '',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                const docRef = await db.collection('recipes').add(newRecipe);
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
                const docRef = db.collection('recipes').doc(req.params.id);
                const updates = {
                    title: title || '',
                    content: content || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                await docRef.update(updates);
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
                const docRef = db.collection('recipes').doc(req.params.id);
                await docRef.delete();
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
                const querySnapshot = await db.collection('collections').get();
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
                const newCollection = {
                    name: name || '',
                    description: description || '',
                    recipeIds: []
                };
                const docRef = await db.collection('collections').add(newCollection);
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
                const docRef = db.collection('collections').doc(req.params.id);
                const updates = { name, description, recipeIds: recipeIds || [] };
                await docRef.update(updates);
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
                const docRef = db.collection('collections').doc(req.params.id);
                const docSnap = await docRef.get();
                
                if (!docSnap.exists) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                
                await docRef.update({
                    recipeIds: admin.firestore.FieldValue.arrayUnion(recipeId)
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
                const docRef = db.collection('collections').doc(req.params.id);
                await docRef.delete();
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
                const docRef = db.collection('collections').doc(collectionId);
                const docSnap = await docRef.get();
                
                if (!docSnap.exists) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                
                await docRef.update({
                    recipeIds: admin.firestore.FieldValue.arrayRemove(recipeId)
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

// ==================== MENUS ROUTES ====================

// Get all menus
app.get('/api/menus', async (req, res) => {
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const querySnapshot = await db.collection('menus').get();
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                console.log(`🔥 Retrieved ${data.length} menus from Firebase`);
                res.json(data);
            } catch (firebaseError) {
                console.error('❌ Firebase menus fetch failed:', firebaseError.message);
                disableFirebaseMode('Menus fetch failed: ' + firebaseError.message);
                res.json(menus);
            }
        } else {
            console.log('📝 Retrieved menus from memory storage');
            res.json(menus);
        }
    } catch (error) {
        console.error('Error fetching menus:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create menu
app.post('/api/menus', async (req, res) => {
    try {
        const { name, description, content, recipeIds } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const newMenu = {
                    name: name || '',
                    description: description || '',
                    content: content || '',
                    recipeIds: recipeIds || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                const docRef = await db.collection('menus').add(newMenu);
                const result = { id: docRef.id, ...newMenu };
                console.log('🔥 Menu created in Firebase:', docRef.id);
                res.json(result);
            } catch (firebaseError) {
                console.error('❌ Firebase menu creation failed:', firebaseError.message);
                disableFirebaseMode('Menu creation failed: ' + firebaseError.message);
                const newMenu = {
                    id: Date.now().toString(),
                    name: name || '',
                    description: description || '',
                    content: content || '',
                    recipeIds: recipeIds || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                menus.push(newMenu);
                console.log('📝 Menu created in memory storage:', newMenu.id);
                res.json(newMenu);
            }
        } else {
            const newMenu = {
                id: Date.now().toString(),
                name: name || '',
                description: description || '',
                content: content || '',
                recipeIds: recipeIds || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            menus.push(newMenu);
            console.log('📝 Menu created in memory storage:', newMenu.id);
            res.json(newMenu);
        }
    } catch (error) {
        console.error('Error creating menu:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update menu
app.put('/api/menus/:id', async (req, res) => {
    try {
        const { name, description, content, recipeIds } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('menus').doc(req.params.id);
                const updates = { 
                    name, 
                    description, 
                    content,
                    recipeIds: recipeIds || [],
                    updatedAt: new Date().toISOString()
                };
                await docRef.update(updates);
                console.log('🔥 Menu updated in Firebase:', req.params.id);
                res.json({ id: req.params.id, ...updates });
            } catch (firebaseError) {
                console.error('❌ Firebase menu update failed:', firebaseError.message);
                disableFirebaseMode('Menu update failed: ' + firebaseError.message);
                const menu = menus.find(m => m.id === req.params.id);
                if (!menu) {
                    return res.status(404).json({ error: 'Menu not found' });
                }
                Object.assign(menu, { name, description, content, recipeIds, updatedAt: new Date().toISOString() });
                console.log('📝 Menu updated in memory storage:', req.params.id);
                res.json(menu);
            }
        } else {
            const menu = menus.find(m => m.id === req.params.id);
            if (!menu) {
                return res.status(404).json({ error: 'Menu not found' });
            }
            Object.assign(menu, { name, description, content, recipeIds, updatedAt: new Date().toISOString() });
            console.log('📝 Menu updated in memory storage:', req.params.id);
            res.json(menu);
        }
    } catch (error) {
        console.error('Error updating menu:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete menu
app.delete('/api/menus/:id', async (req, res) => {
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                await db.collection('menus').doc(req.params.id).delete();
                console.log('🔥 Menu deleted from Firebase:', req.params.id);
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase menu deletion failed:', firebaseError.message);
                disableFirebaseMode('Menu deletion failed: ' + firebaseError.message);
                const index = menus.findIndex(m => m.id === req.params.id);
                if (index === -1) {
                    return res.status(404).json({ error: 'Menu not found' });
                }
                menus.splice(index, 1);
                console.log('📝 Menu deleted from memory storage:', req.params.id);
                res.json({ success: true });
            }
        } else {
            const index = menus.findIndex(m => m.id === req.params.id);
            if (index === -1) {
                return res.status(404).json({ error: 'Menu not found' });
            }
            menus.splice(index, 1);
            console.log('📝 Menu deleted from memory storage:', req.params.id);
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Error deleting menu:', error);
        res.status(500).json({ error: error.message });
    }
});

// === PHOTO ENDPOINTS ===

// Upload photo
app.post('/api/photos', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.file;
        const photoId = Date.now().toString();
        const filename = `${photoId}.jpg`;
        
        if (useFirebase && bucket && !firebaseFailureDetected) {
            try {
                // Upload to Firebase Storage
                const fileUpload = bucket.file(`photos/${filename}`);
                await fileUpload.save(file.buffer, {
                    metadata: {
                        contentType: file.mimetype,
                    },
                    public: true,
                });
                
                // Get public URL
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/photos/${filename}`;
                
                // Save metadata to Firestore
                const photoData = {
                    filename: file.originalname,
                    url: publicUrl,
                    uploadedAt: new Date().toISOString(),
                    size: file.size,
                    mimetype: file.mimetype
                };
                
                await db.collection('photos').doc(photoId).set(photoData);
                
                console.log('🔥 Photo uploaded to Firebase Storage:', photoId);
                res.json({ id: photoId, ...photoData });
            } catch (firebaseError) {
                console.error('❌ Firebase photo upload failed:', firebaseError.message);
                disableFirebaseMode('Photo upload failed: ' + firebaseError.message);
                
                // Fallback to memory
                const photoData = {
                    id: photoId,
                    filename: file.originalname,
                    url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                    uploadedAt: new Date().toISOString(),
                    size: file.size,
                    mimetype: file.mimetype
                };
                photos.push(photoData);
                console.log('📝 Photo stored in memory as base64:', photoId);
                res.json(photoData);
            }
        } else {
            // Memory storage fallback - store as base64
            const photoData = {
                id: photoId,
                filename: file.originalname,
                url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                uploadedAt: new Date().toISOString(),
                size: file.size,
                mimetype: file.mimetype
            };
            photos.push(photoData);
            console.log('📝 Photo stored in memory as base64:', photoId);
            res.json(photoData);
        }
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete photo
app.delete('/api/photos/:id', async (req, res) => {
    try {
        const photoId = req.params.id;
        
        if (useFirebase && bucket && db && !firebaseFailureDetected) {
            try {
                // Get photo metadata
                const photoDoc = await db.collection('photos').doc(photoId).get();
                if (!photoDoc.exists) {
                    return res.status(404).json({ error: 'Photo not found' });
                }
                
                // Delete from Storage
                const filename = `${photoId}.jpg`;
                await bucket.file(`photos/${filename}`).delete();
                
                // Delete metadata from Firestore
                await db.collection('photos').doc(photoId).delete();
                
                console.log('🔥 Photo deleted from Firebase:', photoId);
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase photo deletion failed:', firebaseError.message);
                disableFirebaseMode('Photo deletion failed: ' + firebaseError.message);
                
                // Fallback to memory
                const index = photos.findIndex(p => p.id === photoId);
                if (index === -1) {
                    return res.status(404).json({ error: 'Photo not found' });
                }
                photos.splice(index, 1);
                console.log('📝 Photo deleted from memory storage:', photoId);
                res.json({ success: true });
            }
        } else {
            const index = photos.findIndex(p => p.id === photoId);
            if (index === -1) {
                return res.status(404).json({ error: 'Photo not found' });
            }
            photos.splice(index, 1);
            console.log('📝 Photo deleted from memory storage:', photoId);
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Error deleting photo:', error);
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
    console.log('🔧 Environment check:');
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`  - Firebase Config Present: ${hasFirebaseConfig}`);
    console.log(`  - FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? 'SET' : 'MISSING'}`);
    await initializeFirebase();
});