/**
 * Clear ALL activities from ALL feeds and the master activities collection
 * Usage: node clear-feed.js
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

async function deleteCollection(collectionRef, batchSize = 500) {
    let deletedCount = 0;
    
    while (true) {
        const snapshot = await collectionRef.limit(batchSize).get();
        
        if (snapshot.empty) {
            break;
        }
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedCount += snapshot.size;
        
        if (snapshot.size > 0) {
            console.log(`   🗑️  Deleted ${deletedCount} documents...`);
        }
    }
    
    return deletedCount;
}

async function clearAllFeeds() {
    console.log('🔄 Starting comprehensive feed cleanup...\n');
    
    try {
        // Step 1: Clear master activities collection
        console.log('📊 Clearing master activities collection...');
        const activitiesRef = db.collection('activities');
        
        // First, count total activities
        const activitiesCountSnapshot = await activitiesRef.count().get();
        const totalActivities = activitiesCountSnapshot.data().count;
        console.log(`   Found ${totalActivities} total activities to delete`);
        
        const activitiesCount = await deleteCollection(activitiesRef);
        console.log(`✅ Deleted ${activitiesCount} master activities\n`);
        
        // Verify deletion
        const remainingActivities = await activitiesRef.limit(1).get();
        if (!remainingActivities.empty) {
            console.warn('⚠️  Warning: Some activities may remain. Running second pass...');
            const secondPass = await deleteCollection(activitiesRef);
            console.log(`✅ Second pass deleted ${secondPass} additional activities\n`);
        }
        
        // Step 2: Clear all user feeds
        console.log('👥 Clearing all user feeds...');
        const usersSnapshot = await db.collection('users').get();
        console.log(`   Found ${usersSnapshot.size} users\n`);
        
        let totalFeedActivities = 0;
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const username = userDoc.data().username || 'unknown';
            
            const feedRef = db.collection('feeds').doc(userId).collection('activities');
            
            // Count activities in this feed
            const feedCountSnapshot = await feedRef.count().get();
            const feedCount = feedCountSnapshot.data().count;
            
            if (feedCount > 0) {
                console.log(`   Processing feed for: ${username} (${feedCount} activities)`);
                const count = await deleteCollection(feedRef);
                console.log(`   ✅ Deleted ${count} activities from ${username}'s feed`);
                totalFeedActivities += count;
                
                // Verify deletion
                const remainingFeed = await feedRef.limit(1).get();
                if (!remainingFeed.empty) {
                    console.warn(`   ⚠️  Running second pass for ${username}...`);
                    const secondPass = await deleteCollection(feedRef);
                    console.log(`   ✅ Second pass deleted ${secondPass} additional activities`);
                    totalFeedActivities += secondPass;
                }
            } else {
                console.log(`   ℹ️  Feed already empty for ${username}`);
            }
        }
        
        console.log('\n📈 Summary:');
        console.log(`   Master activities deleted: ${activitiesCount}`);
        console.log(`   Total feed activities deleted: ${totalFeedActivities}`);
        console.log(`   Users processed: ${usersSnapshot.size}`);
        console.log('\n✅ All feeds cleared successfully!');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

clearAllFeeds();
