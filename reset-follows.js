/**
 * Reset all follow-related data (follows, followers, activities, feeds)
 * Usage: node reset-follows.js
 * WARNING: This will clear ALL follow data for ALL users!
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

async function resetFollows() {
    console.log('🧹 Starting follow data cleanup...\n');
    
    // 1. Clear all activities (with batching for large collections)
    console.log('🗑️  Clearing activities collection...');
    let totalActivities = 0;
    const activitiesRef = db.collection('activities');
    
    while (true) {
        const activitiesSnapshot = await activitiesRef.limit(500).get();
        if (activitiesSnapshot.empty) break;
        
        const batch = db.batch();
        activitiesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        totalActivities += activitiesSnapshot.size;
        console.log(`   Deleted ${activitiesSnapshot.size} activities...`);
    }
    
    if (totalActivities > 0) {
        console.log(`✅ Deleted ${totalActivities} total activities\n`);
    } else {
        console.log('✅ No activities to delete\n');
    }
    
    // 2. Clear all feeds subcollections
    console.log('🗑️  Clearing feeds subcollections...');
    const feedsSnapshot = await db.collection('feeds').get();
    let totalFeedActivities = 0;
    
    for (const feedDoc of feedsSnapshot.docs) {
        console.log(`   Clearing feed for user: ${feedDoc.id}`);
        const activitiesRef = feedDoc.ref.collection('activities');
        
        // Delete in batches of 500 until empty
        while (true) {
            const activitiesSnapshot = await activitiesRef.limit(500).get();
            if (activitiesSnapshot.empty) break;
            
            const batch = db.batch();
            activitiesSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            totalFeedActivities += activitiesSnapshot.size;
            console.log(`   Deleted ${activitiesSnapshot.size} activities...`);
        }
        
        // Delete the feed document itself
        await feedDoc.ref.delete();
    }
    
    if (totalFeedActivities > 0) {
        console.log(`✅ Deleted ${totalFeedActivities} feed activities from ${feedsSnapshot.size} feeds\n`);
    } else {
        console.log('✅ No feed activities to delete\n');
    }
    
    // 3. Reset follow fields in users
    console.log('🗑️  Resetting user follow fields...');
    const usersSnapshot = await db.collection('users').get();
    const userBatch = db.batch();
    
    usersSnapshot.docs.forEach(doc => {
        userBatch.update(doc.ref, {
            following: [],
            followers: [],
            followingCount: 0,
            followersCount: 0
        });
    });
    
    await userBatch.commit();
    console.log(`✅ Reset follow fields for ${usersSnapshot.size} users\n`);
    
    console.log('✅ Follow data cleanup complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Activities deleted: ${totalActivities}`);
    console.log(`   - Feed activities deleted: ${totalFeedActivities}`);
    console.log(`   - Users reset: ${usersSnapshot.size}`);
}

resetFollows()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
