// Trigger activity regeneration for all recipes, collections, and menus
// This makes a minimal update to each entity to trigger the activity fanout
// Run with: node regenerate-all-activities.js

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

// Helper to extract preview text from markdown
function extractPreview(content, maxLength = 150) {
    if (!content) return '';
    const plainText = content
        .replace(/^#+\s+/gm, '')
        .replace(/[*_~`]/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/\n+/g, ' ')
        .trim();
    return plainText.length > maxLength 
        ? plainText.substring(0, maxLength) + '...'
        : plainText;
}

// Fan out activity helper
async function fanOutActivity(authorUserId, activityData) {
    try {
        // Get author's followers
        const userDoc = await db.collection('users').doc(authorUserId).get();
        const userData = userDoc.data();
        const followers = userData?.followers || [];
        
        if (followers.length === 0) {
            console.log('   ℹ️  No followers to notify');
            return;
        }
        
        // Create master activity record (use provided createdAt or current time)
        const activityRef = await db.collection('activities').add(activityData);
        
        // Fan out to all followers' feeds
        const batch = db.batch();
        for (const followerUserId of followers) {
            const feedRef = db.collection('feeds').doc(followerUserId).collection('activities').doc(activityRef.id);
            batch.set(feedRef, activityData);
        }
        await batch.commit();
        
        console.log(`   ✅ Fanned out to ${followers.length} followers`);
    } catch (error) {
        console.error('   ❌ Failed to fan out activity:', error.message);
    }
}

async function regenerateActivities() {
    console.log('🔄 Starting activity regeneration...\n');
    
    try {
        // Get all users to map userIds
        const usersSnapshot = await db.collection('users').get();
        const userIdMap = {};
        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            userIdMap[data.username] = doc.id;
        });
        
        // Regenerate recipe activities
        console.log('📝 Processing recipes...');
        const recipesSnapshot = await db.collection('recipes').get();
        console.log(`   Found ${recipesSnapshot.size} recipes\n`);
        
        let recipesProcessed = 0;
        
        for (const doc of recipesSnapshot.docs) {
            const recipe = doc.data();
            
            console.log(`   🔍 Recipe "${recipe.title}": activityPublished=${recipe.activityPublished}, hasTitle=${!!recipe.title}`);
            
            // Skip if already published
            if (recipe.activityPublished === true) {
                console.log(`      ⏭️  Skipped (already published)`);
                continue;
            }
            
            const hasRealTitle = recipe.title && recipe.title.trim() && 
                !recipe.title.toLowerCase().includes('untitled');
            
            if (!hasRealTitle) {
                console.log(`   ⏭️  Skipping "${recipe.title || 'Untitled'}" (no real title)`);
                continue;
            }
            
            recipesProcessed++;
            
            const userId = userIdMap[recipe.username];
            if (!userId) {
                console.log(`   ⏭️  Skipping "${recipe.title}" (user not found: ${recipe.username})`);
                continue;
            }
            
            console.log(`   📢 Publishing: "${recipe.title}"`);
            
            const slug = recipe.title.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            
            const fullSlug = `${slug}-${doc.id}`;
            console.log(`   🔍 Generated slug: "${fullSlug}" (base: "${slug}", id: "${doc.id}")`);
            
            await fanOutActivity(userId, {
                userId: userId,
                username: recipe.username,
                type: 'recipe_created',
                entityId: doc.id,
                entityTitle: recipe.title,
                entitySlug: fullSlug,
                preview: extractPreview(recipe.content),
                createdAt: recipe.createdAt || admin.firestore.Timestamp.now()
            });
            
            // Mark as published
            await doc.ref.update({ activityPublished: true });
        }
        
        // Regenerate collection activities
        console.log('\n📁 Processing collections...');
        const collectionsSnapshot = await db.collection('collections').get();
        console.log(`   Found ${collectionsSnapshot.size} collections\n`);
        
        let collectionsProcessed = 0;
        
        for (const doc of collectionsSnapshot.docs) {
            const collection = doc.data();
            
            // Skip if already published
            if (collection.activityPublished === true) {
                continue;
            }
            
            collectionsProcessed++;
            const userId = userIdMap[collection.username];
            
            if (!userId) {
                console.log(`   ⏭️  Skipping "${collection.name}" (user not found: ${collection.username})`);
                continue;
            }
            
            console.log(`   📢 Publishing: "${collection.name}"`);
            
            const slug = (collection.name || 'untitled').toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            
            await fanOutActivity(userId, {
                userId: userId,
                username: collection.username,
                type: 'collection_created',
                entityId: doc.id,
                entityTitle: collection.name || 'Untitled Collection',
                entitySlug: `${slug}-${doc.id}`,
                preview: collection.description || '',
                createdAt: collection.createdAt || admin.firestore.Timestamp.now()
            });
            
            await doc.ref.update({ activityPublished: true });
        }
        
        // Regenerate menu activities
        console.log('\n🍽️  Processing menus...');
        const menusSnapshot = await db.collection('menus').get();
        console.log(`   Found ${menusSnapshot.size} menus\n`);
        
        let menusProcessed = 0;
        
        for (const doc of menusSnapshot.docs) {
            const menu = doc.data();
            
            // Skip if already published
            if (menu.activityPublished === true) {
                continue;
            }
            
            menusProcessed++;
            const userId = userIdMap[menu.username];
            
            if (!userId) {
                console.log(`   ⏭️  Skipping "${menu.name}" (user not found: ${menu.username})`);
                continue;
            }
            
            console.log(`   📢 Publishing: "${menu.name}"`);
            
            const slug = (menu.name || 'untitled').toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            
            await fanOutActivity(userId, {
                userId: userId,
                username: menu.username,
                type: 'menu_created',
                entityId: doc.id,
                entityTitle: menu.name || 'Untitled Menu',
                entitySlug: `${slug}-${doc.id}`,
                preview: extractPreview(menu.content || menu.description),
                createdAt: menu.createdAt || admin.firestore.Timestamp.now()
            });
            
            await doc.ref.update({ activityPublished: true });
        }
        
        console.log('\n📈 Summary:');
        console.log(`   Recipes processed: ${recipesProcessed}`);
        console.log(`   Collections processed: ${collectionsProcessed}`);
        console.log(`   Menus processed: ${menusProcessed}`);
        console.log('\n✅ Activity regeneration complete!');
        console.log('💡 Refresh your feed to see the updated activities');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error regenerating activities:', error);
        process.exit(1);
    }
}

regenerateActivities();
