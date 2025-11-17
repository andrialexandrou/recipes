#!/usr/bin/env node

/**
 * Migration Script: Add Follow System Fields to Users
 * 
 * This script updates all existing user documents in Firestore to include
 * the fields needed for the follow system:
 * - following: [] (array of user IDs)
 * - followers: [] (array of user IDs)
 * - followingCount: 0
 * - followersCount: 0
 * 
 * Usage:
 *   node migrate-users-for-follows.js
 * 
 * Requirements:
 *   - FIREBASE_SERVICE_ACCOUNT_KEY environment variable set
 *   - FIREBASE_PROJECT_ID environment variable set
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin
console.log('🔧 Initializing Firebase Admin...');

try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
    });
    
    console.log('✅ Firebase Admin initialized');
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
}

const db = admin.firestore();

async function migrateUsers() {
    console.log('\n🚀 Starting user migration for follow system...\n');
    
    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Found ${usersSnapshot.size} users to migrate\n`);
        
        if (usersSnapshot.empty) {
            console.log('⚠️  No users found. Nothing to migrate.');
            return;
        }
        
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        // Process each user
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            
            console.log(`Processing user: ${userData.username || userId}`);
            
            // Check what fields are missing
            const updates = {};
            
            if (!userData.hasOwnProperty('following')) {
                updates.following = [];
                console.log('  ➕ Adding following array');
            }
            
            if (!userData.hasOwnProperty('followers')) {
                updates.followers = [];
                console.log('  ➕ Adding followers array');
            }
            
            if (!userData.hasOwnProperty('followingCount')) {
                updates.followingCount = 0;
                console.log('  ➕ Adding followingCount');
            }
            
            if (!userData.hasOwnProperty('followersCount')) {
                updates.followersCount = 0;
                console.log('  ➕ Adding followersCount');
            }
            
            // Check if user has email (should exist but verify)
            if (!userData.email) {
                console.log('  ⚠️  WARNING: User missing email field');
            }
            
            // Check if user has username (should exist but verify)
            if (!userData.username) {
                console.log('  ⚠️  WARNING: User missing username field');
            }
            
            // Apply updates if needed
            if (Object.keys(updates).length > 0) {
                try {
                    await db.collection('users').doc(userId).update(updates);
                    updatedCount++;
                    console.log('  ✅ Updated successfully\n');
                } catch (error) {
                    errorCount++;
                    console.error(`  ❌ Failed to update: ${error.message}\n`);
                }
            } else {
                skippedCount++;
                console.log('  ⏭️  Already has all fields, skipping\n');
            }
        }
        
        // Summary
        console.log('━'.repeat(60));
        console.log('📋 Migration Summary:');
        console.log('━'.repeat(60));
        console.log(`Total users:        ${usersSnapshot.size}`);
        console.log(`Updated:            ${updatedCount}`);
        console.log(`Skipped (no changes): ${skippedCount}`);
        console.log(`Errors:             ${errorCount}`);
        console.log('━'.repeat(60));
        
        if (errorCount > 0) {
            console.log('\n⚠️  Migration completed with errors. Review the logs above.');
            process.exit(1);
        } else {
            console.log('\n✅ Migration completed successfully!');
        }
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Verification function to check migration results
async function verifyMigration() {
    console.log('\n🔍 Verifying migration...\n');
    
    try {
        const usersSnapshot = await db.collection('users').get();
        
        let allValid = true;
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const username = userData.username || userDoc.id;
            
            const hasAllFields = 
                userData.hasOwnProperty('following') &&
                userData.hasOwnProperty('followers') &&
                userData.hasOwnProperty('followingCount') &&
                userData.hasOwnProperty('followersCount');
            
            if (!hasAllFields) {
                console.log(`❌ ${username}: Missing required fields`);
                allValid = false;
            } else {
                // Check field types
                const validTypes = 
                    Array.isArray(userData.following) &&
                    Array.isArray(userData.followers) &&
                    typeof userData.followingCount === 'number' &&
                    typeof userData.followersCount === 'number';
                
                if (!validTypes) {
                    console.log(`❌ ${username}: Invalid field types`);
                    allValid = false;
                } else {
                    console.log(`✅ ${username}: All fields valid`);
                }
            }
        }
        
        if (allValid) {
            console.log('\n✅ All users have valid follow system fields!');
        } else {
            console.log('\n⚠️  Some users have invalid or missing fields. Re-run migration.');
        }
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    }
}

// Main execution
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║   User Follow System Migration Script                    ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
    await migrateUsers();
    await verifyMigration();
    
    console.log('\n👋 Migration script completed. Exiting...\n');
    process.exit(0);
}

// Run migration
main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
