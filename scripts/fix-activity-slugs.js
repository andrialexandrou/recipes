// Fix entitySlug in existing activities to include full ID
// Run with: node fix-activity-slugs.js

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountKey) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not found in environment');
    process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountKey);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function fixActivitySlugs() {
    console.log('🔧 Starting activity slug fix...\n');
    
    try {
        // Get all activities
        const activitiesSnapshot = await db.collection('activities').get();
        console.log(`📊 Found ${activitiesSnapshot.size} activities\n`);
        
        let fixedCount = 0;
        let skippedCount = 0;
        
        const batch = db.batch();
        let batchCount = 0;
        const MAX_BATCH = 500;
        
        for (const doc of activitiesSnapshot.docs) {
            const activity = doc.data();
            
            // Check if slug already has the ID (contains the entity ID)
            if (activity.entitySlug && activity.entityId) {
                // If slug doesn't end with the entity ID, fix it
                if (!activity.entitySlug.includes(activity.entityId)) {
                    const newSlug = `${activity.entitySlug}-${activity.entityId}`;
                    batch.update(doc.ref, { entitySlug: newSlug });
                    batchCount++;
                    fixedCount++;
                    
                    console.log(`✏️  Fixing: ${activity.entitySlug} → ${newSlug}`);
                    
                    // Commit batch if we hit the limit
                    if (batchCount >= MAX_BATCH) {
                        await batch.commit();
                        console.log(`✅ Committed batch of ${batchCount} updates\n`);
                        batchCount = 0;
                    }
                } else {
                    skippedCount++;
                }
            }
        }
        
        // Commit remaining updates
        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch of ${batchCount} updates\n`);
        }
        
        console.log('\n📈 Summary:');
        console.log(`   Fixed: ${fixedCount}`);
        console.log(`   Skipped (already correct): ${skippedCount}`);
        console.log(`   Total: ${activitiesSnapshot.size}`);
        
        // Now fix all the feed activities
        console.log('\n🔧 Fixing feed activities...');
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Found ${usersSnapshot.size} users\n`);
        
        let feedFixedCount = 0;
        let feedSkippedCount = 0;
        
        for (const userDoc of usersSnapshot.docs) {
            const feedSnapshot = await db.collection('feeds').doc(userDoc.id).collection('activities').get();
            
            if (feedSnapshot.empty) continue;
            
            console.log(`👤 Fixing feed for user ${userDoc.id} (${feedSnapshot.size} activities)`);
            
            const feedBatch = db.batch();
            let feedBatchCount = 0;
            
            for (const feedDoc of feedSnapshot.docs) {
                const activity = feedDoc.data();
                
                if (activity.entitySlug && activity.entityId) {
                    if (!activity.entitySlug.includes(activity.entityId)) {
                        const newSlug = `${activity.entitySlug}-${activity.entityId}`;
                        feedBatch.update(feedDoc.ref, { entitySlug: newSlug });
                        feedBatchCount++;
                        feedFixedCount++;
                        
                        if (feedBatchCount >= MAX_BATCH) {
                            await feedBatch.commit();
                            console.log(`   ✅ Committed feed batch of ${feedBatchCount} updates`);
                            feedBatchCount = 0;
                        }
                    } else {
                        feedSkippedCount++;
                    }
                }
            }
            
            if (feedBatchCount > 0) {
                await feedBatch.commit();
                console.log(`   ✅ Committed final feed batch of ${feedBatchCount} updates`);
            }
        }
        
        console.log('\n📈 Feed Summary:');
        console.log(`   Fixed: ${feedFixedCount}`);
        console.log(`   Skipped (already correct): ${feedSkippedCount}`);
        
        console.log('\n✅ Activity slug fix complete!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error fixing activity slugs:', error);
        process.exit(1);
    }
}

fixActivitySlugs();
