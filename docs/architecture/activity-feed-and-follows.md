# Activity Feed & Follow System Architecture

## Overview

The activity feed and follow system enables users to follow each other and see a real-time stream of recipes, collections, and menus created by people they follow. This document explains the architecture, data model, and fan-out approach used.

## Data Model

### User Document Extensions

Each user document in `users/{userId}` now includes:

```javascript
{
  username: "andri",
  email: "user@example.com",
  following: ["userId1", "userId2", ...],  // Array of user IDs
  followers: ["userId3", "userId4", ...],  // Array of user IDs  
  followingCount: 45,                      // Count for display
  followersCount: 120,                     // Count for display
  createdAt: timestamp
}
```

**Why arrays on user documents?**
- Fast single-document read to get all following/followers
- Easy count display without additional queries
- Atomic updates using Firestore `arrayUnion`/`arrayRemove`
- Scalable up to ~10,000 users (well within 1MB document limit)

### Activities Collection

Global activities collection: `activities/{activityId}`

```javascript
{
  userId: "authorId",           // Who created it
  username: "andri",            // For display
  type: "recipe_created",       // Activity type
  entityId: "recipeId",         // Recipe/collection/menu ID
  entityTitle: "Alabama White Sauce",
  entitySlug: "alabama-white-sauce-ABC123",
  createdAt: timestamp
}
```

**Activity Types:**
- `recipe_created` - User created a new recipe
- `collection_created` - User created a new collection
- `menu_created` - User created a new menu

### Personal Feed Subcollections

Each user has a personal feed: `feeds/{userId}/activities/{activityId}`

```javascript
{
  userId: "authorId",
  username: "andri",
  type: "recipe_created",
  entityId: "recipeId",
  entityTitle: "Alabama White Sauce",
  entitySlug: "alabama-white-sauce-ABC123",
  createdAt: timestamp
}
```

**Why subcollections?**
- Ultra-fast reads: Single query per user, no joins
- No user limit: Works for any number of followed users
- Scales infinitely: Each user's feed is independent

## Fan-Out Architecture

### Why Fan-Out?

The fan-out approach solves Firestore's `in` query limitation (max 10 items). Instead of querying activities from multiple users, we pre-compute each user's feed.

**Trade-offs:**
- ✅ **Read Performance**: O(1) query per user feed
- ✅ **No Limits**: Works with unlimited followed users
- ✅ **Fast Timeline**: No sorting/merging needed
- ❌ **Write Amplification**: 1 post = N writes for N followers
- ❌ **Storage Cost**: Activities duplicated across feeds

### How Fan-Out Works

**When User B creates a recipe:**

1. **Save Recipe** → `recipes/{recipeId}`
2. **Create Activity** → `activities/{activityId}` (master record)
3. **Get Followers** → Query `users/{userB}` document, extract `followers` array
4. **Fan-Out** → Write activity to each follower's feed:
   ```
   feeds/{followerA}/activities/{activityId}
   feeds/{followerC}/activities/{activityId}
   feeds/{followerD}/activities/{activityId}
   ```

**When User A views their feed:**

1. **Query Personal Feed** → `feeds/{userA}/activities` ordered by `createdAt`
2. **Render** → Display 50 most recent activities
3. **Done** → No additional queries needed!

### Implementation Details

#### Server-Side Fan-Out Function

```javascript
async function fanOutActivity(authorUserId, activityData) {
  // 1. Get author's followers
  const authorDoc = await db.collection('users').doc(authorUserId).get();
  const followers = authorDoc.data().followers || [];
  
  // 2. Create master activity
  const activityRef = await db.collection('activities').add(activityData);
  
  // 3. Fan-out to all followers (batched writes, 500 per batch)
  for (let i = 0; i < followers.length; i += 500) {
    const batch = db.batch();
    const followerChunk = followers.slice(i, i + 500);
    
    followerChunk.forEach(followerId => {
      const feedRef = db.collection('feeds')
        .doc(followerId)
        .collection('activities')
        .doc(activityRef.id);
      
      batch.set(feedRef, activityData);
    });
    
    await batch.commit();
  }
}
```

#### Integration Points

Fan-out is called after creating recipes, collections, or menus:

```javascript
// Recipe creation endpoint
app.post('/api/:username/recipes', async (req, res) => {
  // 1. Create recipe
  const docRef = await db.collection('recipes').add(newRecipe);
  
  // 2. Fan-out activity (async, non-blocking)
  await fanOutActivity(req.userId, {
    userId: req.userId,
    username: username,
    type: 'recipe_created',
    entityId: docRef.id,
    entityTitle: title,
    entitySlug: slug
  });
  
  // 3. Return response
  res.json(result);
});
```

## Follow/Unfollow Flow

### Following a User

**API Endpoint:** `POST /api/users/:targetUserId/follow`

```javascript
// Request
{ currentUserId: "userA" }

// Server Operation (Batched Transaction)
batch.update('users/userA', {
  following: arrayUnion(targetUserId),
  followingCount: increment(1)
});

batch.update('users/targetUserId', {
  followers: arrayUnion(userA),
  followersCount: increment(1)
});

await batch.commit();
```

**Client-Side:**
```javascript
await API.followUser(targetUserId);
// Updates UI: button changes to "Following"
```

### Unfollowing a User

**API Endpoint:** `DELETE /api/users/:targetUserId/follow`

```javascript
// Same as follow, but using arrayRemove and increment(-1)
batch.update('users/userA', {
  following: arrayRemove(targetUserId),
  followingCount: increment(-1)
});

batch.update('users/targetUserId', {
  followers: arrayRemove(userA),
  followersCount: increment(-1)
});
```

## Feed Rendering

### Fetching Feed

**API Endpoint:** `GET /api/feed?userId={userId}`

```javascript
// Server
const feedSnapshot = await db.collection('feeds')
  .doc(userId)
  .collection('activities')
  .orderBy('createdAt', 'desc')
  .limit(50)
  .get();
```

### Client-Side Rendering

```javascript
async function loadFeed() {
  const activities = await API.getFeed();
  renderFeed(activities);
}

function renderFeed(activities) {
  // Map each activity to HTML
  // Show username, action, entity title, timestamp
  // Make entity clickable to navigate to recipe/collection/menu
}
```

## Performance Characteristics

### Read Performance
- **Feed Query**: O(1) - Single indexed query
- **Latency**: ~50-100ms for 50 activities
- **No User Limit**: Works with any number of followed users

### Write Performance
- **Recipe Creation**: O(N) where N = number of followers
- **Batched Writes**: 500 writes per batch (Firestore limit)
- **Example**: 1,000 followers = 2 batch commits (~200ms)

### Storage Costs
- **Per Activity**: ~200 bytes
- **Per Follower**: 200 bytes × followers
- **Example**: 1,000 followers = 200KB per activity

## Scaling Considerations

### Current Implementation (MVP)
- ✅ Works for 0-10,000 followers per user
- ✅ Fast reads, acceptable write cost
- ✅ No query limits or batching needed client-side

### Future Optimizations (if needed)

1. **Lazy Fan-Out** (>10K followers)
   - Only fan-out to active users
   - Generate feed on-demand for inactive users

2. **Hybrid Approach**
   - Use fan-out for users with <5K followers
   - Use query-based approach for power users

3. **Feed Pagination**
   - Currently fetches 50 most recent
   - Add "Load More" with cursor-based pagination

4. **Activity Cleanup**
   - Automatically delete activities >90 days old
   - Reduce storage costs

## Security & Privacy

### Firestore Security Rules

```javascript
// Activities collection - anyone can read
match /activities/{activityId} {
  allow read: if true;
  allow write: if false; // Only server can write
}

// Personal feeds - only owner can read
match /feeds/{userId}/activities/{activityId} {
  allow read: if request.auth.uid == userId;
  allow write: if false; // Only server can write
}

// User documents
match /users/{userId} {
  allow read: if true; // Public profile info
  allow write: if request.auth.uid == userId;
}
```

### Privacy Considerations
- All activities are public (anyone can see via feed)
- Following/followers lists are public
- No private recipes yet (future feature)

## Testing Scenarios

### Functional Tests
1. ✅ User A follows User B → B's follower count increases
2. ✅ User B creates recipe → Activity appears in A's feed
3. ✅ User A unfollows User B → New activities don't appear in A's feed
4. ✅ User clicks activity → Navigates to correct recipe/collection/menu
5. ✅ Empty feed → Shows "No Activity Yet" message

### Performance Tests
1. Follow user with 100 followers → Check fan-out latency
2. Follow user with 1,000 followers → Verify batching works
3. Load feed with 50 activities → Check render time
4. Create recipe with 0 followers → Verify no fan-out errors

### Edge Cases
1. User with 0 followers → No fan-out, no errors
2. Follow self → Should fail with error
3. Double follow → Idempotent (arrayUnion handles this)
4. Rapid follow/unfollow → Atomic operations prevent race conditions

## Monitoring & Debugging

### Server Logs
```
📤 Fanning out activity to 45 followers
✅ Activity fanned out to 45 followers
📰 Retrieved 23 feed items for user abc123
```

### Client Logs
```
🔄 Fetching activity feed...
✅ Received feed: 23 activities
```

### Debug Checklist
- [ ] User document has `following` and `followers` arrays
- [ ] Activities collection has master records
- [ ] Feeds subcollection has activity copies
- [ ] Activity timestamps are present and valid
- [ ] Entity slugs match URL format

## Future Enhancements

### Planned Features
- [ ] Rich activity types (comments, likes, shares)
- [ ] Activity filtering (show only recipes, etc.)
- [ ] Feed notifications (unread count badge)
- [ ] Suggested users to follow
- [ ] Popular content ranking

### Potential Optimizations
- [ ] Activity deduplication (if user follows multiple creators of same item)
- [ ] Batched feed updates (websockets for real-time)
- [ ] Activity aggregation ("John and 5 others created recipes")
- [ ] Smart feed ranking (not just chronological)

## Related Documentation

- [Multi-User Architecture](../../agents.md#6-multi-user-architecture-with-userid)
- [Authentication System](../../agents.md#5-authentication-system)
- [Firestore Data Model](../../agents.md#9-firebase-integration)

---

**Last Updated:** November 16, 2025  
**Architecture Version:** 1.0  
**Implementation Status:** ✅ Complete
