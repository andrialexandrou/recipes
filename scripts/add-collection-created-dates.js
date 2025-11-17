// Add createdAt dates to collections that don't have them
// Sets to 7 days ago as a reasonable default
// Run with: node add-collection-created-dates.js

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

async function addCollectionDates() {
    console.log('📅 Adding createdAt dates to collections...\n');
    
    try {
        const collectionsSnapshot = await db.collection('collections').get();
        console.log(`📊 Found ${collectionsSnapshot.size} collections\n`);
        
        // 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const timestamp = admin.firestore.Timestamp.fromDate(sevenDaysAgo);
        
        console.log(`🕐 Default date: ${sevenDaysAgo.toISOString()} (7 days ago)\n`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        const batch = db.batch();
        
        for (const doc of collectionsSnapshot.docs) {
            const data = doc.data();
            
            if (!data.createdAt) {
                batch.update(doc.ref, { createdAt: timestamp });
                updatedCount++;
                console.log(`✏️  Adding date to: ${data.name || 'Untitled'}`);
            } else {
                skippedCount++;
                console.log(`⏭️  Skipping (already has date): ${data.name || 'Untitled'}`);
            }
        }
        
        if (updatedCount > 0) {
            await batch.commit();
            console.log(`\n✅ Added createdAt to ${updatedCount} collections`);
        } else {
            console.log(`\nℹ️  No collections needed updating`);
        }
        
        console.log(`📈 Summary:`);
        console.log(`   Updated: ${updatedCount}`);
        console.log(`   Skipped: ${skippedCount}`);
        console.log(`   Total: ${collectionsSnapshot.size}`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addCollectionDates();
