// Redis Status Check Script
// Run this to check if users are marked online/offline in Redis

const Redis = require('ioredis');

const redis = new Redis({
  host: 'redis-15824.c325.us-east-1-4.ec2.cloud.redislabs.com',
  port: 15824,
  password: 'aAHfkukg22mvPzk0yznnmBbpab2Xo5Bv',
});

async function checkUserOnlineStatus() {
  console.log('🔍 Checking user online status in Redis...\n');
  
  try {
    // Check online users
    const onlineUsers = await redis.keys('user:online:*');
    console.log('📱 Online users in Redis:');
    
    for (const key of onlineUsers) {
      const userId = key.split(':')[2];
      const userData = await redis.hgetall(key);
      console.log(`  ✅ User ${userId}:`, userData);
    }
    
    if (onlineUsers.length === 0) {
      console.log('  ❌ No users currently online in Redis');
    }
    
    // Check specific user
    const userId = 1; // Change this to test specific user
    const userKey = `user:online:${userId}`;
    const isOnline = await redis.exists(userKey);
    
    console.log(`\n👤 User ${userId} online status:`, isOnline ? '✅ Online' : '❌ Offline');
    
    if (isOnline) {
      const userData = await redis.hgetall(userKey);
      console.log('  User data:', userData);
    }
    
  } catch (error) {
    console.error('❌ Redis error:', error.message);
  }
  
  await redis.quit();
}

async function simulateUserOnline(userId, socketId) {
  console.log(`🟢 Simulating user ${userId} going online...`);
  
  try {
    await redis.hset(`user:online:${userId}`, {
      userId: userId.toString(),
      socketId: socketId || `socket_${Date.now()}`,
      userType: 'USER',
      lastSeen: new Date().toISOString()
    });
    
    console.log(`✅ User ${userId} marked as online`);
  } catch (error) {
    console.error('❌ Error marking user online:', error.message);
  }
  
  await redis.quit();
}

async function simulateUserOffline(userId) {
  console.log(`🔴 Simulating user ${userId} going offline...`);
  
  try {
    await redis.del(`user:online:${userId}`);
    console.log(`✅ User ${userId} marked as offline`);
  } catch (error) {
    console.error('❌ Error marking user offline:', error.message);
  }
  
  await redis.quit();
}

// Command line interface
const command = process.argv[2];
const userId = parseInt(process.argv[3]) || 1;

switch (command) {
  case 'check':
    checkUserOnlineStatus();
    break;
  case 'online':
    simulateUserOnline(userId);
    break;
  case 'offline':
    simulateUserOffline(userId);
    break;
  default:
    console.log('Usage:');
    console.log('  node redis-status-check.js check          # Check all online users');
    console.log('  node redis-status-check.js online [id]    # Mark user as online');
    console.log('  node redis-status-check.js offline [id]   # Mark user as offline');
    console.log('\nExample:');
    console.log('  node redis-status-check.js online 1       # Mark user 1 as online');
    console.log('  node redis-status-check.js check          # Check status');
    console.log('  node redis-status-check.js offline 1      # Mark user 1 as offline');
}
