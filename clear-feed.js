/**
 * Clear all activities from a specific user's feed
 * Usage: node clear-feed.js <userId>
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function clearUserFeed(userId) {
    console.log(`🔍 Finding activities for user: ${userId}`);
    
    const feedRef = db.collection('feeds').doc(userId).collection('activities');
    const snapshot = await feedRef.get();
    
    if (snapshot.empty) {
        console.log('✅ Feed is already empty');
        return;
    }
    
    console.log(`📊 Found ${snapshot.size} activities to delete`);
    
    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    let deletedCount = 0;
    
    while (true) {
        const snapshot = await feedRef.limit(batchSize).get();
        
        if (snapshot.empty) {
            break;
        }
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedCount += snapshot.size;
        console.log(`🗑️  Deleted ${deletedCount} activities...`);
    }
    
    console.log(`✅ Successfully cleared feed for user ${userId}`);
    console.log(`📊 Total activities deleted: ${deletedCount}`);
}

// Get userId from command line
const userId = process.argv[2];

if (!userId) {
    console.error('❌ Error: Please provide a userId');
    console.log('Usage: node clear-feed.js <userId>');
    process.exit(1);
}

clearUserFeed(userId)
    .then(() => {
        console.log('✅ Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
