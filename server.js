require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

// Users (fallback for development - production uses Firestore)
const users = [];

// In-memory storage fallback - now organized by user
let recipes = [];
let collections = [];
let menus = [];
let photos = [];

// Middleware to validate username and resolve to userId
async function validateUsername(req, res, next) {
    const username = req.params.username;
    
    console.log(`🔍 Validating username: ${username}`);
    
    // Try to resolve username to userId from Firestore first (primary source of truth)
    if (useFirebase && db) {
        try {
            console.log(`🔥 Querying Firestore for user: ${username}`);
            const usersSnapshot = await db.collection('users').where('username', '==', username).limit(1).get();
            console.log(`📊 Query returned ${usersSnapshot.size} results`);
            
            if (!usersSnapshot.empty) {
                const userDoc = usersSnapshot.docs[0];
                req.userId = userDoc.id; // Store Firebase Auth UID
                req.username = username;
                console.log(`✅ Resolved ${username} → userId: ${req.userId}`);
                return next();
            } else {
                console.log(`⚠️ User ${username} not found in Firestore, checking hardcoded list...`);
                // Not in Firestore, check hardcoded list as fallback
                const user = users.find(u => u.username === username);
                if (user) {
                    console.log(`⚠️ User ${username} found in hardcoded list but not in Firestore`);
                    req.userId = null;
                    req.username = username;
                    return next();
                } else {
                    console.log(`❌ User ${username} not found anywhere`);
                    return res.status(404).json({ error: 'User not found' });
                }
            }
        } catch (error) {
            console.error('❌ Error resolving userId:', error.message);
            console.error('Error details:', error);
            // Fall through to hardcoded list check
        }
    }
    
    // Fallback: Check hardcoded users list (for development/offline mode)
    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    req.userId = null;
    req.username = username;
    next();
}

// Helper function to build query for user's data
function buildUserQuery(collection, req) {
    // If we have a userId, query by userId (preferred)
    if (req.userId) {
        return collection.where('userId', '==', req.userId);
    }
    // Fallback to username for legacy data
    return collection.where('username', '==', req.username);
}

// Helper function to extract preview text from markdown content
function extractPreview(content, maxLength = 150) {
    if (!content) return '';
    
    // Remove markdown formatting
    let text = content
        .replace(/^#+\s+/gm, '')           // Remove headers
        .replace(/\*\*(.+?)\*\*/g, '$1')   // Remove bold
        .replace(/\*(.+?)\*/g, '$1')       // Remove italic
        .replace(/!\[.*?\]\(.*?\)/g, '')   // Remove images
        .replace(/\[(.+?)\]\(.*?\)/g, '$1') // Remove links, keep text
        .replace(/`(.+?)`/g, '$1')         // Remove inline code
        .replace(/^[-*+]\s+/gm, '')        // Remove list markers
        .replace(/^\d+\.\s+/gm, '')        // Remove numbered lists
        .replace(/\n+/g, ' ')              // Replace newlines with spaces
        .trim();
    
    // Truncate to maxLength
    if (text.length > maxLength) {
        text = text.substring(0, maxLength).trim() + '...';
    }
    
    return text;
}

// Helper function to fan-out activity to all followers' feeds
async function fanOutActivity(authorUserId, activityData) {
    if (!useFirebase || !db || firebaseFailureDetected) {
        console.log('⚠️ Skipping fan-out: Firebase not available');
        return;
    }
    
    try {
        // Get author's user document to access followers array
        const authorDoc = await db.collection('users').doc(authorUserId).get();
        if (!authorDoc.exists) {
            console.log('⚠️ Author user not found for fan-out');
            return;
        }
        
        const followers = authorDoc.data().followers || [];
        if (followers.length === 0) {
            console.log('📭 No followers to fan-out to');
            return;
        }
        
        console.log(`📤 Fanning out activity to ${followers.length} followers`);
        
        // Create activity in main activities collection
        const activityRef = await db.collection('activities').add({
            ...activityData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Fan-out to each follower's feed using batched writes
        // Firestore batches support max 500 operations
        const batchSize = 500;
        for (let i = 0; i < followers.length; i += batchSize) {
            const batch = db.batch();
            const followerChunk = followers.slice(i, i + batchSize);
            
            followerChunk.forEach(followerId => {
                const feedRef = db.collection('feeds')
                    .doc(followerId)
                    .collection('activities')
                    .doc(activityRef.id); // Use same ID as main activity
                
                batch.set(feedRef, {
                    ...activityData,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            
            await batch.commit();
        }
        
        console.log(`✅ Activity fanned out to ${followers.length} followers`);
    } catch (error) {
        console.error('❌ Error fanning out activity:', error);
        // Don't throw - fan-out failure shouldn't break the main operation
    }
}

// Helper function to remove an activity from all followers' feeds when content is deleted
async function removeActivityFromFollowers(authorUserId, activityType, entityId) {
    if (!useFirebase || !db || firebaseFailureDetected) {
        console.log('⚠️ Skipping activity removal: Firebase not available');
        return;
    }
    
    try {
        console.log(`🗑️ Removing ${activityType} activity for entity ${entityId} from followers' feeds`);
        
        // First, find the activity document in the main activities collection
        const activitiesQuery = await db.collection('activities')
            .where('userId', '==', authorUserId)
            .where('type', '==', activityType)
            .where('entityId', '==', entityId)
            .limit(1)
            .get();
        
        if (activitiesQuery.empty) {
            console.log('⚠️ No matching activity found in activities collection');
            return;
        }
        
        const activityId = activitiesQuery.docs[0].id;
        console.log(`📋 Found activity ID: ${activityId}`);
        
        // Get author's followers
        const authorDoc = await db.collection('users').doc(authorUserId).get();
        if (!authorDoc.exists) {
            console.log('⚠️ Author user not found for activity removal');
            return;
        }
        
        const followers = authorDoc.data().followers || [];
        if (followers.length === 0) {
            console.log('📭 No followers to remove activity from');
            // Still delete from main activities collection
            await activitiesQuery.docs[0].ref.delete();
            console.log('✅ Deleted activity from main activities collection');
            return;
        }
        
        console.log(`🗑️ Removing activity from ${followers.length} followers' feeds`);
        
        // Delete from each follower's feed using batched writes
        const batchSize = 500;
        for (let i = 0; i < followers.length; i += batchSize) {
            const batch = db.batch();
            const followerChunk = followers.slice(i, i + batchSize);
            
            followerChunk.forEach(followerId => {
                const feedRef = db.collection('feeds')
                    .doc(followerId)
                    .collection('activities')
                    .doc(activityId); // Use the actual activity ID from main collection
                
                batch.delete(feedRef);
            });
            
            await batch.commit();
        }
        
        // Delete from main activities collection
        await activitiesQuery.docs[0].ref.delete();
        
        console.log(`✅ Activity removed from ${followers.length} followers' feeds + main collection`);
    } catch (error) {
        console.error('❌ Activity removal failed:', error);
        // Don't throw - removal failure shouldn't break the delete operation
    }
}

// Helper function to remove all activities from a specific user when unfollowing
async function removeUserActivitiesFromFeed(followerId, unfollowedUserId) {
    if (!useFirebase || !db || firebaseFailureDetected) {
        console.log('⚠️ Skipping feed cleanup: Firebase not available');
        return;
    }
    
    try {
        console.log(`🧹 Cleaning up activities from user ${unfollowedUserId} in follower ${followerId}'s feed`);
        
        // Query all activities from the unfollowed user
        const activitiesSnapshot = await db.collection('feeds')
            .doc(followerId)
            .collection('activities')
            .where('userId', '==', unfollowedUserId)
            .get();
        
        if (activitiesSnapshot.empty) {
            console.log('📭 No activities to remove');
            return;
        }
        
        console.log(`🗑️ Removing ${activitiesSnapshot.size} activities`);
        
        // Delete activities using batched writes
        const batchSize = 500;
        const docs = activitiesSnapshot.docs;
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = db.batch();
            const docChunk = docs.slice(i, i + batchSize);
            
            docChunk.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
        }
        
        console.log(`✅ Removed ${activitiesSnapshot.size} activities from feed`);
    } catch (error) {
        console.error('❌ Feed cleanup failed:', error);
        // Don't throw - cleanup failure shouldn't break the unfollow operation
    }
}

// Helper function to backfill a user's feed with existing content from a followed user
async function backfillFeedForNewFollow(followerId, followedUserId) {
    if (!useFirebase || !db || firebaseFailureDetected) {
        console.log('⚠️ Skipping backfill: Firebase not available');
        return;
    }
    
    try {
        console.log(`📥 Backfilling feed for follower ${followerId} with content from ${followedUserId}`);
        
        // Get followed user's username for the activities
        const followedUserDoc = await db.collection('users').doc(followedUserId).get();
        if (!followedUserDoc.exists) {
            console.log('⚠️ Followed user not found for backfill');
            return;
        }
        const followedUsername = followedUserDoc.data().username;
        
        // Fetch all existing content from followed user
        const [recipesSnap, collectionsSnap, menusSnap] = await Promise.all([
            db.collection('recipes').where('userId', '==', followedUserId).get(),
            db.collection('collections').where('userId', '==', followedUserId).get(),
            db.collection('menus').where('userId', '==', followedUserId).get()
        ]);
        
        const activities = [];
        
        // Create activities for recipes
        recipesSnap.forEach(doc => {
            const recipe = doc.data();
            if (!recipe.createdAt) {
                console.log(`⚠️ Skipping recipe "${recipe.title}" (${doc.id}) - no createdAt timestamp`);
                return;
            }
            activities.push({
                userId: followedUserId,
                username: followedUsername,
                type: 'recipe_created',
                entityId: doc.id,
                entityTitle: recipe.title,
                entitySlug: recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                preview: extractPreview(recipe.content),
                createdAt: recipe.createdAt
            });
        });
        
        // Create activities for collections
        collectionsSnap.forEach(doc => {
            const collection = doc.data();
            if (!collection.createdAt) {
                console.log(`⚠️ Skipping collection "${collection.name}" (${doc.id}) - no createdAt timestamp`);
                return;
            }
            activities.push({
                userId: followedUserId,
                username: followedUsername,
                type: 'collection_created',
                entityId: doc.id,
                entityTitle: collection.name,
                entitySlug: collection.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                preview: collection.description || '',
                createdAt: collection.createdAt
            });
        });
        
        // Create activities for menus
        menusSnap.forEach(doc => {
            const menu = doc.data();
            if (!menu.createdAt) {
                console.log(`⚠️ Skipping menu "${menu.name}" (${doc.id}) - no createdAt timestamp`);
                return;
            }
            activities.push({
                userId: followedUserId,
                username: followedUsername,
                type: 'menu_created',
                entityId: doc.id,
                entityTitle: menu.name,
                entitySlug: menu.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                preview: extractPreview(menu.content || menu.description),
                createdAt: menu.createdAt
            });
        });
        
        if (activities.length === 0) {
            console.log('📭 No existing content to backfill');
            return;
        }
        
        console.log(`📝 Backfilling ${activities.length} activities`);
        
        // Write activities to follower's feed using batched writes
        const batchSize = 500;
        for (let i = 0; i < activities.length; i += batchSize) {
            const batch = db.batch();
            const activityChunk = activities.slice(i, i + batchSize);
            
            activityChunk.forEach(activity => {
                // Create unique ID for each activity (combo of type and entity)
                const activityId = `${activity.type}_${activity.entityId}`;
                const feedRef = db.collection('feeds')
                    .doc(followerId)
                    .collection('activities')
                    .doc(activityId);
                
                // Ensure createdAt is a Firestore Timestamp for proper sorting
                const activityData = {
                    ...activity,
                    createdAt: activity.createdAt instanceof admin.firestore.Timestamp 
                        ? activity.createdAt 
                        : admin.firestore.Timestamp.fromDate(new Date(activity.createdAt))
                };
                
                batch.set(feedRef, activityData);
            });
            
            await batch.commit();
        }
        
        console.log(`📥 Backfill complete: ${activities.length} activities added to feed`);
    } catch (error) {
        console.error('❌ Backfill failed:', error);
        // Don't throw - follow should succeed even if backfill fails
    }
}

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

// Get users list
app.get('/api/users', (req, res) => {
    res.json(users);
});

// Search users (only returns searchable users)
app.get('/api/users/search', async (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase().trim() : '';
    
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                // Query users collection
                const usersSnapshot = await db.collection('users')
                    .where('isSearchable', '!=', false) // Only searchable users (default true)
                    .limit(100) // Limit for performance
                    .get();
                
                const matchedUsers = [];
                usersSnapshot.forEach(doc => {
                    const userData = doc.data();
                    const username = userData.username.toLowerCase();
                    
                    // If no query, include all users; otherwise filter by substring match
                    if (!query || username.includes(query)) {
                        // Compute Gravatar hash server-side
                        const gravatarHash = userData.email 
                            ? crypto.createHash('md5').update(userData.email.toLowerCase().trim()).digest('hex')
                            : null;
                        
                        matchedUsers.push({
                            uid: doc.id, // Add UID for follow functionality
                            username: userData.username,
                            gravatarHash: gravatarHash,
                            followersCount: userData.followersCount || 0,
                            followingCount: userData.followingCount || 0
                        });
                    }
                });
                
                // Sort by follower count descending
                matchedUsers.sort((a, b) => b.followersCount - a.followersCount);
                
                res.json(matchedUsers.slice(0, 50)); // Return top 50
            } catch (firebaseError) {
                console.error('❌ Firebase user search failed:', firebaseError.message);
                res.status(500).json({ error: 'Search failed' });
            }
        } else {
            // Memory storage fallback
            const matchedUsers = users
                .filter(u => !query || u.username.toLowerCase().includes(query))
                .slice(0, 50);
            res.json(matchedUsers);
        }
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current user (deprecated - auth handled by Firebase)
app.get('/api/me', (req, res) => {
    res.status(410).json({ error: 'Endpoint deprecated. Use Firebase Auth instead.' });
});

// Get user info by username (for displaying avatars when logged out)
app.get('/api/:username/user', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const usersSnapshot = await db.collection('users').where('username', '==', username).limit(1).get();
                if (!usersSnapshot.empty) {
                    const userDoc = usersSnapshot.docs[0];
                    const userData = userDoc.data();
                    
                    // Compute Gravatar hash server-side (don't expose email)
                    const gravatarHash = userData.email 
                        ? crypto.createHash('md5').update(userData.email.toLowerCase().trim()).digest('hex')
                        : null;
                    
                    // Return public information including uid (needed for follow functionality)
                    res.json({
                        uid: userDoc.id, // Include uid from document ID
                        username: userData.username,
                        bio: userData.bio || '',
                        gravatarHash: gravatarHash,
                        createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.createdAt,
                        following: userData.following || [],
                        followers: userData.followers || [],
                        followingCount: userData.followingCount || 0,
                        followersCount: userData.followersCount || 0,
                        isStaff: userData.isStaff || false
                    });
                } else {
                    res.status(404).json({ error: 'User not found' });
                }
            } catch (firebaseError) {
                console.error('❌ Firebase user fetch failed:', firebaseError.message);
                res.status(500).json({ error: 'Failed to fetch user' });
            }
        } else {
            // Fallback to hardcoded users
            const user = users.find(u => u.username === username);
            if (user) {
                res.json({ username: user.username, email: user.email });
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Get all recipes for a user
app.get('/api/:username/recipes', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const query = buildUserQuery(db.collection('recipes'), req)
                    .orderBy('updatedAt', 'desc');
                const querySnapshot = await query.get();
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
                    updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
                }));
                console.log(`🔥 Retrieved ${data.length} recipes for ${username} from Firebase`);
                res.json(data);
            } catch (firebaseError) {
                console.error('❌ Firebase recipes fetch failed:', firebaseError.message);
                disableFirebaseMode('Recipe fetch failed: ' + firebaseError.message);
                console.log('📝 Using memory storage for this and all future requests');
                const userRecipes = recipes.filter(r => r.username === username);
                res.json(userRecipes);
            }
        } else {
            console.log('📝 Retrieved recipes from memory storage');
            const userRecipes = recipes.filter(r => r.username === username);
            res.json(userRecipes);
        }
    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single recipe
app.get('/api/:username/recipes/:id', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('recipes').doc(req.params.id);
                const docSnap = await docRef.get();
                
                // Check if recipe belongs to user (by userId or username fallback)
                const recipeData = docSnap.data();
                const belongsToUser = req.userId 
                    ? recipeData.userId === req.userId 
                    : recipeData.username === username;
                
                if (!docSnap.exists || !belongsToUser) {
                    return res.status(404).json({ error: 'Recipe not found' });
                }
                const data = {
                    id: docSnap.id,
                    ...recipeData,
                    createdAt: recipeData.createdAt?.toDate?.()?.toISOString() || recipeData.createdAt,
                    updatedAt: recipeData.updatedAt?.toDate?.()?.toISOString() || recipeData.updatedAt
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
app.post('/api/:username/recipes', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        const { title, content } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const newRecipe = {
                    title: title || '',
                    content: content || '',
                    username: username,
                    userId: req.userId || null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                const docRef = await db.collection('recipes').add(newRecipe);
                const result = {
                    id: docRef.id,
                    title: title || '',
                    content: content || '',
                    username: username,
                    userId: req.userId || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                console.log('🔥 Recipe created in Firebase:', docRef.id);
                
                // Note: Activity fan-out happens on first meaningful save (in PUT endpoint)
                // to avoid "Untitled" recipes appearing in followers' feeds
                
                res.json(result);
            } catch (firebaseError) {
                console.error('❌ Firebase recipe creation failed:', firebaseError.message);
                disableFirebaseMode('Recipe creation failed: ' + firebaseError.message);
                // Fall back to memory storage for this request
                const newRecipe = {
                    id: Date.now().toString(),
                    title: title || '',
                    content: content || '',
                    username: username,
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
                username: username,
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
app.put('/api/:username/recipes/:id', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        const { title, content } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('recipes').doc(req.params.id);
                const docSnap = await docRef.get();
                const recipeData = docSnap.data();
                const belongsToUser = req.userId 
                    ? recipeData.userId === req.userId 
                    : recipeData.username === username;
                
                if (!docSnap.exists || !belongsToUser) {
                    return res.status(404).json({ error: 'Recipe not found' });
                }
                const updates = {
                    title: title || '',
                    content: content || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                await docRef.update(updates);
                
                // Fan-out activity to followers' feeds on first meaningful save
                // Only if: has userId, has a real title (not empty/Untitled), and hasn't been published yet
                const hasRealTitle = title && title.trim() && 
                    !title.toLowerCase().includes('untitled') && 
                    title.trim().length > 0;
                const notYetPublished = !recipeData.activityPublished;
                
                if (req.userId && hasRealTitle && notYetPublished) {
                    console.log('📢 Publishing recipe activity to followers:', title);
                    
                    const slug = title.toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '');
                    
                    // Mark as published to prevent duplicate activities
                    await docRef.update({ activityPublished: true });
                    
                    // Fan out to followers (non-blocking)
                    fanOutActivity(req.userId, {
                        userId: req.userId,
                        username: username,
                        type: 'recipe_created',
                        entityId: req.params.id,
                        entityTitle: title,
                        entitySlug: `${slug}-${req.params.id}`,
                        preview: extractPreview(content),
                        createdAt: recipeData.createdAt || admin.firestore.FieldValue.serverTimestamp()
                    }).catch(err => {
                        console.error('❌ Failed to fan out recipe activity:', err);
                    });
                }
                
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
                const recipe = recipes.find(r => r.id === req.params.id && r.username === username);
                if (!recipe) {
                    return res.status(404).json({ error: 'Recipe not found' });
                }
                const updates = { title: title || '', content: content || '', updatedAt: new Date().toISOString() };
                Object.assign(recipe, updates);
                console.log('📝 Recipe updated in memory storage:', req.params.id);
                res.json(recipe);
            }
        } else {
            const recipe = recipes.find(r => r.id === req.params.id && r.username === username);
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
app.delete('/api/:username/recipes/:id', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('recipes').doc(req.params.id);
                const docSnap = await docRef.get();
                const recipeData = docSnap.data();
                const belongsToUser = req.userId 
                    ? recipeData.userId === req.userId 
                    : recipeData.username === username;
                
                if (!docSnap.exists || !belongsToUser) {
                    return res.status(404).json({ error: 'Recipe not found' });
                }
                await docRef.delete();
                console.log('🔥 Recipe deleted from Firebase:', req.params.id);
                
                // Remove activity from all followers' feeds (non-blocking)
                removeActivityFromFollowers(req.userId, 'recipe_created', req.params.id).catch(err => {
                    console.error('⚠️ Failed to remove recipe activity from followers:', err);
                });
                
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase recipe deletion failed:', firebaseError.message);
                disableFirebaseMode('Recipe deletion failed: ' + firebaseError.message);
                // Fall back to memory storage
                const index = recipes.findIndex(r => r.id === req.params.id && r.username === username);
                if (index === -1) {
                    return res.status(404).json({ error: 'Recipe not found' });
                }
                recipes.splice(index, 1);
                console.log('📝 Recipe deleted from memory storage:', req.params.id);
                res.json({ success: true });
            }
        } else {
            const index = recipes.findIndex(r => r.id === req.params.id && r.username === username);
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
app.get('/api/:username/collections', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const collectionsRef = buildUserQuery(db.collection('collections'), req)
                    .orderBy('createdAt', 'desc');
                const querySnapshot = await collectionsRef.get();
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
                const userCollections = collections.filter(c => c.username === username);
                res.json(userCollections);
            }
        } else {
            console.log('📝 Retrieved collections from memory storage');
            const userCollections = collections.filter(c => c.username === username);
            res.json(userCollections);
        }
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create collection
app.post('/api/:username/collections', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        const { name, description } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const newCollection = {
                    name: name || '',
                    description: description || '',
                    username: username,
                    userId: req.userId || null,
                    recipeIds: [],
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                };
                const docRef = await db.collection('collections').add(newCollection);
                const result = {
                    id: docRef.id,
                    name: name || '',
                    description: description || '',
                    username: username,
                    userId: req.userId || null,
                    recipeIds: []
                };
                console.log('🔥 Collection created in Firebase:', docRef.id);
                
                // Fan-out activity to followers' feeds
                if (req.userId) {
                    const slug = (name || 'untitled').toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '');
                    
                    await fanOutActivity(req.userId, {
                        userId: req.userId,
                        username: username,
                        type: 'collection_created',
                        entityId: docRef.id,
                        entityTitle: name || 'Untitled Collection',
                        entitySlug: `${slug}-${docRef.id}`,
                        preview: description || '',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                
                res.json(result);
            } catch (firebaseError) {
                console.error('❌ Firebase collection creation failed:', firebaseError.message);
                disableFirebaseMode('Collection creation failed: ' + firebaseError.message);
                // Fall back to memory storage
                const newCollection = {
                    id: Date.now().toString(),
                    name: name || '',
                    description: description || '',
                    username: username,
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
                username: username,
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
app.put('/api/:username/collections/:id', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        const { name, description, recipeIds } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('collections').doc(req.params.id);
                const docSnap = await docRef.get();
                const collectionData = docSnap.data();
                const belongsToUser = req.userId 
                    ? collectionData.userId === req.userId 
                    : collectionData.username === username;
                
                if (!docSnap.exists || !belongsToUser) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                
                // Only update fields that are provided
                const updates = {};
                if (name !== undefined) updates.name = name;
                if (description !== undefined) updates.description = description;
                if (recipeIds !== undefined) updates.recipeIds = recipeIds;
                
                await docRef.update(updates);
                console.log('🔥 Collection updated in Firebase:', req.params.id);
                res.json({ id: req.params.id, ...collectionData, ...updates });
            } catch (firebaseError) {
                console.error('❌ Firebase collection update failed:', firebaseError.message);
                disableFirebaseMode('Collection update failed: ' + firebaseError.message);
                // Fall back to memory storage
                const collection = collections.find(c => c.id === req.params.id);
                if (!collection) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                
                // Only update fields that are provided
                if (name !== undefined) collection.name = name;
                if (description !== undefined) collection.description = description;
                if (recipeIds !== undefined) collection.recipeIds = recipeIds;
                
                console.log('📝 Collection updated in memory storage:', req.params.id);
                res.json(collection);
            }
        } else {
            const collection = collections.find(c => c.id === req.params.id && c.username === username);
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            
            // Only update fields that are provided
            if (name !== undefined) collection.name = name;
            if (description !== undefined) collection.description = description;
            if (recipeIds !== undefined) collection.recipeIds = recipeIds;
            
            console.log('📝 Collection updated in memory storage:', req.params.id);
            res.json(collection);
        }
    } catch (error) {
        console.error('Error updating collection:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add recipe to collection
app.post('/api/:username/collections/:id/recipes', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        const { recipeId } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('collections').doc(req.params.id);
                const docSnap = await docRef.get();
                const collectionData = docSnap.data();
                const belongsToUser = req.userId 
                    ? collectionData.userId === req.userId 
                    : collectionData.username === username;
                
                if (!docSnap.exists || !belongsToUser) {
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
            const collection = collections.find(c => c.id === req.params.id && c.username === username);
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
app.delete('/api/:username/collections/:id', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('collections').doc(req.params.id);
                const docSnap = await docRef.get();
                const collectionData = docSnap.data();
                const belongsToUser = req.userId 
                    ? collectionData.userId === req.userId 
                    : collectionData.username === username;
                
                if (!docSnap.exists || !belongsToUser) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                await docRef.delete();
                console.log('🔥 Collection deleted from Firebase:', req.params.id);
                
                // Remove activity from all followers' feeds (non-blocking)
                removeActivityFromFollowers(req.userId, 'collection_created', req.params.id).catch(err => {
                    console.error('⚠️ Failed to remove collection activity from followers:', err);
                });
                
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase collection deletion failed:', firebaseError.message);
                disableFirebaseMode('Collection deletion failed: ' + firebaseError.message);
                // Fall back to memory storage
                const index = collections.findIndex(c => c.id === req.params.id && c.username === username);
                if (index === -1) {
                    return res.status(404).json({ error: 'Collection not found' });
                }
                collections.splice(index, 1);
                console.log('📝 Collection deleted from memory storage:', req.params.id);
                res.json({ success: true });
            }
        } else {
            const index = collections.findIndex(c => c.id === req.params.id && c.username === username);
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
app.delete('/api/:username/collections/:id/recipes/:recipeId', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        const { id: collectionId, recipeId } = req.params;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('collections').doc(collectionId);
                const docSnap = await docRef.get();
                const collectionData = docSnap.data();
                const belongsToUser = req.userId 
                    ? collectionData.userId === req.userId 
                    : collectionData.username === username;
                
                if (!docSnap.exists || !belongsToUser) {
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
app.get('/api/:username/menus', validateUsername, async (req, res) => {
    const username = req.params.username;
    try{
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const menusRef = buildUserQuery(db.collection('menus'), req)
                    .orderBy('updatedAt', 'desc');
                const querySnapshot = await menusRef.get();
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                console.log(`🔥 Retrieved ${data.length} menus from Firebase`);
                res.json(data);
            } catch (firebaseError) {
                console.error('❌ Firebase menus fetch failed:', firebaseError.message);
                disableFirebaseMode('Menus fetch failed: ' + firebaseError.message);
                const userMenus = menus.filter(m => m.username === username);
                res.json(userMenus);
            }
        } else {
            console.log('📝 Retrieved menus from memory storage');
            const userMenus = menus.filter(m => m.username === username);
            res.json(userMenus);
        }
    } catch (error) {
        console.error('Error fetching menus:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create menu
app.post('/api/:username/menus', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        const { name, description, content, recipeIds } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const newMenu = {
                    name: name || '',
                    description: description || '',
                    content: content || '',
                    recipeIds: recipeIds || [],
                    username: username,
                    userId: req.userId || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                const docRef = await db.collection('menus').add(newMenu);
                const result = { id: docRef.id, ...newMenu };
                console.log('🔥 Menu created in Firebase:', docRef.id);
                
                // Fan-out activity to followers' feeds
                if (req.userId) {
                    const slug = (name || 'untitled').toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '');
                    
                    await fanOutActivity(req.userId, {
                        userId: req.userId,
                        username: username,
                        type: 'menu_created',
                        entityId: docRef.id,
                        entityTitle: name || 'Untitled Menu',
                        entitySlug: `${slug}-${docRef.id}`,
                        preview: extractPreview(content || description),
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
                
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
                    username: username,
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
                username: username,
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
app.put('/api/:username/menus/:id', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        const { name, description, content, recipeIds } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('menus').doc(req.params.id);
                const docSnap = await docRef.get();
                const menuData = docSnap.data();
                const belongsToUser = req.userId 
                    ? menuData.userId === req.userId 
                    : menuData.username === username;
                
                if (!docSnap.exists || !belongsToUser) {
                    return res.status(404).json({ error: 'Menu not found' });
                }
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
                const menu = menus.find(m => m.id === req.params.id && m.username === username);
                if (!menu) {
                    return res.status(404).json({ error: 'Menu not found' });
                }
                Object.assign(menu, { name, description, content, recipeIds, updatedAt: new Date().toISOString() });
                console.log('📝 Menu updated in memory storage:', req.params.id);
                res.json(menu);
            }
        } else {
            const menu = menus.find(m => m.id === req.params.id && m.username === username);
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
app.delete('/api/:username/menus/:id', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            try {
                const docRef = db.collection('menus').doc(req.params.id);
                const docSnap = await docRef.get();
                const menuData = docSnap.data();
                const belongsToUser = req.userId 
                    ? menuData.userId === req.userId 
                    : menuData.username === username;
                
                if (!docSnap.exists || !belongsToUser) {
                    return res.status(404).json({ error: 'Menu not found' });
                }
                await docRef.delete();
                console.log('🔥 Menu deleted from Firebase:', req.params.id);
                
                // Remove activity from all followers' feeds (non-blocking)
                removeActivityFromFollowers(req.userId, 'menu_created', req.params.id).catch(err => {
                    console.error('⚠️ Failed to remove menu activity from followers:', err);
                });
                
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase menu deletion failed:', firebaseError.message);
                disableFirebaseMode('Menu deletion failed: ' + firebaseError.message);
                const index = menus.findIndex(m => m.id === req.params.id && m.username === username);
                if (index === -1) {
                    return res.status(404).json({ error: 'Menu not found' });
                }
                menus.splice(index, 1);
                console.log('📝 Menu deleted from memory storage:', req.params.id);
                res.json({ success: true });
            }
        } else {
            const index = menus.findIndex(m => m.id === req.params.id && m.username === username);
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
app.post('/api/:username/photos', validateUsername, upload.single('photo'), async (req, res) => {
    const username = req.params.username;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.file;
        const photoId = Date.now().toString();
        const filename = `${photoId}.jpg`;
        
        if (useFirebase && bucket && !firebaseFailureDetected) {
            try {
                // Upload to Firebase Storage with user-scoped path
                const fileUpload = bucket.file(`photos/${username}/${filename}`);
                await fileUpload.save(file.buffer, {
                    metadata: {
                        contentType: file.mimetype,
                    },
                    public: true,
                });
                
                // Get public URL
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/photos/${username}/${filename}`;
                
                // Save metadata to Firestore
                const photoData = {
                    filename: file.originalname,
                    url: publicUrl,
                    username: username,
                    userId: req.userId || null,
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
                    username: username,
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
                username: username,
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
app.delete('/api/:username/photos/:id', validateUsername, async (req, res) => {
    const username = req.params.username;
    try {
        const photoId = req.params.id;
        
        if (useFirebase && bucket && db && !firebaseFailureDetected) {
            try {
                // Get photo metadata
                const photoDoc = await db.collection('photos').doc(photoId).get();
                const photoData = photoDoc.data();
                const belongsToUser = req.userId 
                    ? photoData.userId === req.userId 
                    : photoData.username === username;
                
                if (!photoDoc.exists || !belongsToUser) {
                    return res.status(404).json({ error: 'Photo not found' });
                }
                
                // Delete from Storage with user-scoped path
                const filename = `${photoId}.jpg`;
                await bucket.file(`photos/${username}/${filename}`).delete();
                
                // Delete metadata from Firestore
                await db.collection('photos').doc(photoId).delete();
                
                console.log('🔥 Photo deleted from Firebase:', photoId);
                res.json({ success: true });
            } catch (firebaseError) {
                console.error('❌ Firebase photo deletion failed:', firebaseError.message);
                disableFirebaseMode('Photo deletion failed: ' + firebaseError.message);
                
                // Fallback to memory
                const index = photos.findIndex(p => p.id === photoId && p.username === username);
                if (index === -1) {
                    return res.status(404).json({ error: 'Photo not found' });
                }
                photos.splice(index, 1);
                console.log('📝 Photo deleted from memory storage:', photoId);
                res.json({ success: true });
            }
        } else {
            const index = photos.findIndex(p => p.id === photoId && p.username === username);
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

// ==================== USER SETTINGS ENDPOINTS ====================

// Get user settings (requires authentication)
app.get('/api/user/settings', async (req, res) => {
    try {
        // Extract Firebase ID token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const idToken = authHeader.split('Bearer ')[1];
        
        // Verify the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            const userDoc = await db.collection('users').doc(userId).get();
            
            if (!userDoc.exists) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const userData = userDoc.data();
            
            res.json({
                username: userData.username,
                email: userData.email,
                isSearchable: userData.isSearchable !== false,
                bio: userData.bio || '',
                createdAt: userData.createdAt?.toDate?.()?.toISOString() || userData.createdAt
            });
        } else {
            res.status(503).json({ error: 'Firebase not available' });
        }
    } catch (error) {
        console.error('Error fetching user settings:', error);
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Update user settings (requires authentication)
app.put('/api/user/settings', async (req, res) => {
    try {
        // Extract Firebase ID token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const idToken = authHeader.split('Bearer ')[1];
        
        // Verify the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;
        
        const { email, isSearchable, bio } = req.body;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            const userRef = db.collection('users').doc(userId);
            const updateData = {};
            
            // Only update fields that are provided
            if (email !== undefined) {
                updateData.email = email;
            }
            
            if (isSearchable !== undefined) {
                updateData.isSearchable = isSearchable;
            }
            
            if (bio !== undefined) {
                updateData.bio = bio;
            }
            
            await userRef.update(updateData);
            console.log(`✅ Updated settings for user ${userId}`);
            
            res.json({ success: true });
        } else {
            res.status(503).json({ error: 'Firebase not available' });
        }
    } catch (error) {
        console.error('Error updating user settings:', error);
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Delete user account (requires authentication)
app.delete('/api/user/delete', async (req, res) => {
    try {
        // Extract Firebase ID token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const idToken = authHeader.split('Bearer ')[1];
        
        // Verify the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;
        
        if (useFirebase && db && !firebaseFailureDetected) {
            const userDoc = await db.collection('users').doc(userId).get();
            
            if (!userDoc.exists) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const userData = userDoc.data();
            const username = userData.username;
            
            console.log(`⚠️ Deleting all data for user ${username} (${userId})...`);
            
            // Delete all user's recipes
            const recipesSnapshot = await db.collection('recipes')
                .where('userId', '==', userId)
                .get();
            
            const deletePromises = [];
            
            recipesSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });
            
            // Delete all user's collections
            const collectionsSnapshot = await db.collection('collections')
                .where('userId', '==', userId)
                .get();
            
            collectionsSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });
            
            // Delete all user's menus
            const menusSnapshot = await db.collection('menus')
                .where('userId', '==', userId)
                .get();
            
            menusSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });
            
            // Delete all user's photos from Storage
            try {
                const bucket = admin.storage().bucket();
                const [files] = await bucket.getFiles({
                    prefix: `photos/${username}/`
                });
                
                for (const file of files) {
                    deletePromises.push(file.delete());
                }
            } catch (storageError) {
                console.error('⚠️ Error deleting photos from Storage:', storageError.message);
            }
            
            // Delete photo metadata from Firestore
            const photosSnapshot = await db.collection('photos')
                .where('username', '==', username)
                .get();
            
            photosSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });
            
            // Delete all activities created by this user
            const activitiesSnapshot = await db.collection('activities')
                .where('userId', '==', userId)
                .get();
            
            activitiesSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });
            
            // Delete user's personal feed
            const feedSnapshot = await db.collection('feeds').doc(userId)
                .collection('activities')
                .get();
            
            feedSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.delete());
            });
            
            // Remove user from all followers' following arrays
            const followersSnapshot = await db.collection('users')
                .where('following', 'array-contains', userId)
                .get();
            
            followersSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.update({
                    following: admin.firestore.FieldValue.arrayRemove(userId),
                    followingCount: admin.firestore.FieldValue.increment(-1)
                }));
            });
            
            // Remove user from all followed users' followers arrays
            const followingSnapshot = await db.collection('users')
                .where('followers', 'array-contains', userId)
                .get();
            
            followingSnapshot.forEach(doc => {
                deletePromises.push(doc.ref.update({
                    followers: admin.firestore.FieldValue.arrayRemove(userId),
                    followersCount: admin.firestore.FieldValue.increment(-1)
                }));
            });
            
            // Wait for all deletions
            await Promise.all(deletePromises);
            
            // Finally, delete the user document
            await db.collection('users').doc(userId).delete();
            
            console.log(`✅ Successfully deleted all data for user ${username} (${userId})`);
            
            res.json({ success: true });
        } else {
            res.status(503).json({ error: 'Firebase not available' });
        }
    } catch (error) {
        console.error('Error deleting user account:', error);
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: error.message });
    }
});

// ==================== FOLLOW/UNFOLLOW ENDPOINTS ====================

// Follow a user
app.post('/api/users/:targetUserId/follow', async (req, res) => {
    const { currentUserId } = req.body;
    const targetUserId = req.params.targetUserId;
    
    if (!currentUserId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (currentUserId === targetUserId) {
        return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            // Check if already following (prevent duplicate clicks)
            const currentUserDoc = await db.collection('users').doc(currentUserId).get();
            const following = currentUserDoc.data()?.following || [];
            
            if (following.includes(targetUserId)) {
                console.log(`⚠️ User ${currentUserId} already follows ${targetUserId}`);
                return res.json({ success: true, alreadyFollowing: true });
            }
            
            const batch = db.batch();
            
            // Add to current user's following array
            const currentUserRef = db.collection('users').doc(currentUserId);
            batch.update(currentUserRef, {
                following: admin.firestore.FieldValue.arrayUnion(targetUserId),
                followingCount: admin.firestore.FieldValue.increment(1)
            });
            
            // Add to target user's followers array
            const targetUserRef = db.collection('users').doc(targetUserId);
            batch.update(targetUserRef, {
                followers: admin.firestore.FieldValue.arrayUnion(currentUserId),
                followersCount: admin.firestore.FieldValue.increment(1)
            });
            
            await batch.commit();
            console.log(`✅ User ${currentUserId} followed ${targetUserId}`);
            
            // Backfill the follower's feed with existing content from followed user
            // Don't await - let it happen in background so follow completes quickly
            backfillFeedForNewFollow(currentUserId, targetUserId).catch(err => {
                console.error('⚠️ Backfill failed (non-fatal):', err.message);
            });
            
            res.json({ success: true });
        } else {
            res.status(503).json({ error: 'Firebase not available' });
        }
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unfollow a user
app.delete('/api/users/:targetUserId/follow', async (req, res) => {
    const { currentUserId } = req.body;
    const targetUserId = req.params.targetUserId;
    
    if (!currentUserId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            // Check if actually following (prevent duplicate clicks)
            const currentUserDoc = await db.collection('users').doc(currentUserId).get();
            const following = currentUserDoc.data()?.following || [];
            
            if (!following.includes(targetUserId)) {
                console.log(`⚠️ User ${currentUserId} doesn't follow ${targetUserId}`);
                return res.json({ success: true, notFollowing: true });
            }
            
            const batch = db.batch();
            
            // Remove from current user's following array
            const currentUserRef = db.collection('users').doc(currentUserId);
            batch.update(currentUserRef, {
                following: admin.firestore.FieldValue.arrayRemove(targetUserId),
                followingCount: admin.firestore.FieldValue.increment(-1)
            });
            
            // Remove from target user's followers array
            const targetUserRef = db.collection('users').doc(targetUserId);
            batch.update(targetUserRef, {
                followers: admin.firestore.FieldValue.arrayRemove(currentUserId),
                followersCount: admin.firestore.FieldValue.increment(-1)
            });
            
            await batch.commit();
            console.log(`✅ User ${currentUserId} unfollowed ${targetUserId}`);
            
            // Remove all activities from unfollowed user's feed
            removeUserActivitiesFromFeed(currentUserId, targetUserId).catch(err => {
                console.error('⚠️ Feed cleanup failed (non-fatal):', err.message);
            });
            
            res.json({ success: true });
        } else {
            res.status(503).json({ error: 'Firebase not available' });
        }
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get both following and followers lists for a user in a single request
app.get('/api/users/:username/connections', validateUsername, async (req, res) => {
    const { userId } = req; // From validateUsername middleware
    
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            const followingIds = userData?.following || [];
            const followerIds = userData?.followers || [];
            
            // Combine all unique user IDs
            const allUserIds = [...new Set([...followingIds, ...followerIds])];
            
            if (allUserIds.length === 0) {
                return res.json({ following: [], followers: [] });
            }
            
            // Fetch user details for all users in one batch
            const usersPromises = allUserIds.map(async (targetUserId) => {
                const doc = await db.collection('users').doc(targetUserId).get();
                if (doc.exists) {
                    const data = doc.data();
                    return {
                        userId: targetUserId,
                        username: data.username,
                        bio: data.bio || '',
                        gravatarHash: data.gravatarHash || '',
                        followersCount: data.followersCount || 0,
                        followingCount: data.followingCount || 0
                    };
                }
                return null;
            });
            
            const allUsers = (await Promise.all(usersPromises)).filter(u => u !== null);
            
            // Create lookup map for quick access
            const userMap = {};
            allUsers.forEach(user => {
                userMap[user.userId] = user;
            });
            
            // Build following and followers arrays
            const following = followingIds.map(id => userMap[id]).filter(u => u);
            const followers = followerIds.map(id => userMap[id]).filter(u => u);
            
            res.json({ following, followers });
        } else {
            res.status(503).json({ error: 'Firebase not available' });
        }
    } catch (error) {
        console.error('Error fetching connections:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get activity feed for current user
app.get('/api/feed', async (req, res) => {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        if (useFirebase && db && !firebaseFailureDetected) {
            // Query user's personal feed subcollection
            const feedSnapshot = await db.collection('feeds')
                .doc(userId)
                .collection('activities')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
            
            const activities = feedSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
            }));
            
            console.log(`📰 Retrieved ${activities.length} feed items for user ${userId}`);
            console.log('📅 First 5 timestamps:', activities.slice(0, 5).map(a => ({ 
                title: a.entityTitle, 
                created: a.createdAt 
            })));
            res.json(activities);
        } else {
            res.status(503).json({ error: 'Firebase not available' });
        }
    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Dynamic manifest.json endpoint for PWA
app.get('/manifest.json', (req, res) => {
    const manifest = {
        name: 'Sous',
        short_name: 'Sous',
        description: 'Recipes worth keeping',
        start_url: 'https://my-sous.com/',
        scope: 'https://my-sous.com/',
        display: 'standalone',
        background_color: '#faf8f5',
        theme_color: '#6b5d52',
        orientation: 'portrait-primary',
        icons: [
            {
                src: '/favicon.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
            }
        ]
    };
    
    // Set proper headers for PWA manifest
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(manifest);
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
        // Don't serve the static manifest.json since we have a dynamic endpoint
        if (path.endsWith('manifest.json')) {
            res.status(404);
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
    
    // Serve dedicated auth pages
    if (req.path === '/login') {
        return res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
    if (req.path === '/signup') {
        return res.sendFile(path.join(__dirname, 'public', 'signup.html'));
    }
    if (req.path === '/settings') {
        return res.sendFile(path.join(__dirname, 'public', 'settings.html'));
    }
    
    // Default to main SPA - inject dynamic OG tags
    const indexPath = path.join(__dirname, 'public', 'index.html');
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    fs.readFile(indexPath, 'utf8', (err, html) => {
        if (err) {
            return res.sendFile(indexPath);
        }
        // Replace placeholder URLs with actual domain
        const modifiedHtml = html
            .replace(/\{\{BASE_URL\}\}/g, baseUrl);
        res.send(modifiedHtml);
    });
});

app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('🔧 Environment check:');
    console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`  - Firebase Config Present: ${hasFirebaseConfig}`);
    console.log(`  - FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? 'SET' : 'MISSING'}`);
    await initializeFirebase();
});