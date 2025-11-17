// Reset activityPublished flags on all recipes, collections, and menus
// This allows activities to be regenerated with correct slugs
// Run with: node reset-activity-published-flags.js

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

async function resetActivityFlags() {
    console.log('🔧 Starting activity flag reset...\n');
    
    try {
        // Reset recipes
        console.log('📝 Processing recipes...');
        const recipesSnapshot = await db.collection('recipes').get();
        console.log(`   Found ${recipesSnapshot.size} recipes`);
        
        let recipeResetCount = 0;
        const recipeBatch = db.batch();
        
        for (const doc of recipesSnapshot.docs) {
            const data = doc.data();
            console.log(`   📋 "${data.title}": activityPublished=${data.activityPublished}`);
            // Reset if published OR if field doesn't exist (set to false to allow regeneration)
            if (data.activityPublished === true || data.activityPublished === undefined) {
                recipeBatch.update(doc.ref, { activityPublished: false });
                recipeResetCount++;
                console.log(`      ✏️  Will reset to false`);
            }
        }
        
        if (recipeResetCount > 0) {
            await recipeBatch.commit();
            console.log(`   ✅ Reset ${recipeResetCount} recipes\n`);
        } else {
            console.log(`   ℹ️  No recipes needed reset\n`);
        }
        
        // Reset collections
        console.log('📁 Processing collections...');
        const collectionsSnapshot = await db.collection('collections').get();
        console.log(`   Found ${collectionsSnapshot.size} collections`);
        
        let collectionResetCount = 0;
        const collectionBatch = db.batch();
        
        for (const doc of collectionsSnapshot.docs) {
            const data = doc.data();
            if (data.activityPublished === true || data.activityPublished === undefined) {
                collectionBatch.update(doc.ref, { activityPublished: false });
                collectionResetCount++;
            }
        }
        
        if (collectionResetCount > 0) {
            await collectionBatch.commit();
            console.log(`   ✅ Reset ${collectionResetCount} collections\n`);
        } else {
            console.log(`   ℹ️  No collections needed reset\n`);
        }
        
        // Reset menus
        console.log('🍽️  Processing menus...');
        const menusSnapshot = await db.collection('menus').get();
        console.log(`   Found ${menusSnapshot.size} menus`);
        
        let menuResetCount = 0;
        const menuBatch = db.batch();
        
        for (const doc of menusSnapshot.docs) {
            const data = doc.data();
            if (data.activityPublished === true || data.activityPublished === undefined) {
                menuBatch.update(doc.ref, { activityPublished: false });
                menuResetCount++;
            }
        }
        
        if (menuResetCount > 0) {
            await menuBatch.commit();
            console.log(`   ✅ Reset ${menuResetCount} menus\n`);
        } else {
            console.log(`   ℹ️  No menus needed reset\n`);
        }
        
        console.log('📈 Summary:');
        console.log(`   Recipes reset: ${recipeResetCount}`);
        console.log(`   Collections reset: ${collectionResetCount}`);
        console.log(`   Menus reset: ${menuResetCount}`);
        console.log(`   Total: ${recipeResetCount + collectionResetCount + menuResetCount}`);
        
        console.log('\n✅ Activity flag reset complete!');
        console.log('💡 Now run: node clear-feed.js');
        console.log('💡 Then: node regenerate-all-activities.js');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error resetting activity flags:', error);
        process.exit(1);
    }
}

resetActivityFlags();
