const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const db = admin.firestore();

// Helper function to extract preview text
function extractPreview(content) {
    if (!content) return '';
    // Remove markdown syntax and get first 150 chars
    const plainText = content
        .replace(/#{1,6}\s+/g, '') // Remove headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .trim();
    
    return plainText.length > 150 ? plainText.substring(0, 147) + '...' : plainText;
}

// Fanout function (copied from server.js)
async function fanOutActivity(authorUserId, activityData) {
    try {
        console.log('🔍 Starting fanout for user:', authorUserId, 'activity:', activityData.type);
        
        // Get author's user document to access followers array
        const authorDoc = await db.collection('users').doc(authorUserId).get();
        if (!authorDoc.exists) {
            console.log('⚠️ Author user not found for fan-out:', authorUserId);
            return;
        }
        
        const authorData = authorDoc.data();
        const followers = authorData.followers || [];
        console.log('👥 Author followers:', followers.length, followers);
        
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
        
        console.log('✅ Created activity in main collection:', activityRef.id);
        
        // Fan-out to each follower's feed using batched writes
        const batchSize = 500;
        for (let i = 0; i < followers.length; i += batchSize) {
            const batch = db.batch();
            const followerChunk = followers.slice(i, i + batchSize);
            
            followerChunk.forEach(followerId => {
                const feedRef = db.collection('feeds')
                    .doc(followerId)
                    .collection('activities')
                    .doc(activityRef.id);
                
                batch.set(feedRef, {
                    ...activityData,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            
            await batch.commit();
            console.log(`📤 Batched fanout to followers: ${followerChunk.join(', ')}`);
        }
        
        console.log(`✅ Activity fanned out to ${followers.length} followers`);
        return activityRef.id;
        
    } catch (error) {
        console.error('❌ Fan-out failed:', error);
        throw error;
    }
}

// Main function to manually publish a recipe
async function manuallyPublishRecipe(recipeId) {
    try {
        console.log('🔍 Looking up recipe:', recipeId);
        
        // Get the recipe
        const recipeDoc = await db.collection('recipes').doc(recipeId).get();
        if (!recipeDoc.exists) {
            throw new Error('Recipe not found: ' + recipeId);
        }
        
        const recipeData = recipeDoc.data();
        const { title, content, userId, username } = recipeData;
        
        console.log('📄 Found recipe:', { title, userId, username });
        
        // Check if already published
        if (recipeData.activityPublished) {
            console.log('⚠️ Recipe already marked as published');
            const shouldContinue = process.argv.includes('--force');
            if (!shouldContinue) {
                console.log('Use --force to publish anyway');
                return;
            }
            console.log('🔧 Forcing publish despite already published flag');
        }
        
        // Validate required fields
        if (!userId) {
            throw new Error('Recipe has no userId - cannot fanout');
        }
        
        if (!title || !title.trim()) {
            throw new Error('Recipe has no title - cannot fanout');
        }
        
        // Check title quality
        const hasRealTitle = title && title.trim() && 
            !title.toLowerCase().includes('untitled') && 
            title.trim().length > 0;
            
        if (!hasRealTitle) {
            throw new Error(`Recipe title "${title}" is not suitable for fanout`);
        }
        
        console.log('✅ Recipe validation passed');
        
        // Mark as published
        await recipeDoc.ref.update({ activityPublished: true });
        console.log('✅ Marked recipe as published');
        
        // Create slug
        const slug = title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        // Trigger fanout
        const activityId = await fanOutActivity(userId, {
            userId: userId,
            username: username,
            type: 'recipe_created',
            entityId: recipeId,
            entityTitle: title,
            entitySlug: `${slug}-${recipeId}`,
            preview: extractPreview(content),
            createdAt: recipeData.createdAt || admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('🎉 Recipe published successfully!');
        console.log('📋 Summary:', {
            recipeId,
            activityId,
            title,
            author: username,
            slug: `${slug}-${recipeId}`
        });
        
    } catch (error) {
        console.error('❌ Failed to publish recipe:', error.message);
        process.exit(1);
    }
}

// Script usage
if (require.main === module) {
    const recipeId = process.argv[2];
    
    if (!recipeId) {
        console.log('Usage: node manual-fanout.js <recipeId> [--force]');
        console.log('');
        console.log('Examples:');
        console.log('  node manual-fanout.js abc123');
        console.log('  node manual-fanout.js abc123 --force  # Force publish even if already published');
        process.exit(1);
    }
    
    manuallyPublishRecipe(recipeId)
        .then(() => {
            console.log('✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { manuallyPublishRecipe, fanOutActivity };