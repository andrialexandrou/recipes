#!/usr/bin/env node

/**
 * Migration Script: Enable Search Visibility for All Users
 * 
 * Sets isSearchable: true for all users who don't have this field set.
 * This is the default behavior, so we're just making it explicit.
 * 
 * Usage: node scripts/enable-search-for-all-users.js
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

async function enableSearchForAllUsers() {
    try {
        console.log('🔍 Starting migration: Enable search visibility for all users\n');
        
        // Fetch all users
        const usersSnapshot = await db.collection('users').get();
        
        if (usersSnapshot.empty) {
            console.log('⚠️  No users found in database');
            return;
        }
        
        console.log(`📊 Found ${usersSnapshot.size} users\n`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        // Use batched writes for efficiency
        const batchSize = 500;
        const batches = [];
        let batch = db.batch();
        let operationCount = 0;
        
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            
            // Check if isSearchable is already set
            if (userData.hasOwnProperty('isSearchable')) {
                console.log(`⏭️  Skipping @${userData.username} - isSearchable already set to ${userData.isSearchable}`);
                skippedCount++;
                continue;
            }
            
            // Set isSearchable to true (default behavior)
            batch.update(doc.ref, { isSearchable: true });
            operationCount++;
            
            console.log(`✅ Queued @${userData.username} for update`);
            
            // Commit batch when it reaches 500 operations
            if (operationCount >= batchSize) {
                batches.push(batch.commit());
                batch = db.batch();
                operationCount = 0;
            }
        }
        
        // Commit any remaining operations
        if (operationCount > 0) {
            batches.push(batch.commit());
        }
        
        // Wait for all batches to complete
        console.log(`\n📤 Committing ${batches.length} batch(es) to Firestore...\n`);
        await Promise.all(batches);
        
        updatedCount = usersSnapshot.size - skippedCount;
        
        console.log('\n✨ Migration complete!');
        console.log(`📊 Summary:`);
        console.log(`   - Total users: ${usersSnapshot.size}`);
        console.log(`   - Updated: ${updatedCount}`);
        console.log(`   - Skipped: ${skippedCount}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
enableSearchForAllUsers();
