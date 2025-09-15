const redisClient = require('../config/redis');

class SessionService {
  constructor() {
    this.sessionPrefix = 'session:';
    this.sessionTTL = parseInt(process.env.SESSION_TTL) || 3600; // 1 hour
  }

  async createSession(sessionId) {
    try {
      const sessionKey = `${this.sessionPrefix}${sessionId}`;
      const sessionData = {
        id: sessionId,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        messageCount: 0
      };

      await redisClient.setEx(sessionKey, this.sessionTTL, JSON.stringify(sessionData));
      console.log(`Created session: ${sessionId}`);
      return sessionData;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async getSession(sessionId) {
    try {
      const sessionKey = `${this.sessionPrefix}${sessionId}`;
      const sessionData = await redisClient.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async updateSessionActivity(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return await this.createSession(sessionId);
      }

      session.lastActivity = new Date().toISOString();
      session.messageCount = (session.messageCount || 0) + 1;

      const sessionKey = `${this.sessionPrefix}${sessionId}`;
      await redisClient.setEx(sessionKey, this.sessionTTL, JSON.stringify(session));
      
      return session;
    } catch (error) {
      console.error('Error updating session activity:', error);
      throw error;
    }
  }

  async addToHistory(sessionId, messageData) {
    try {
      const historyKey = `${this.sessionPrefix}${sessionId}:history`;
      const historyItem = {
        ...messageData,
        id: Date.now().toString()
      };

      // Add to list (most recent first)
      await redisClient.lPush(historyKey, JSON.stringify(historyItem));
      
      // Keep only last 50 messages
      await redisClient.lTrim(historyKey, 0, 49);
      
      // Set TTL for history
      await redisClient.expire(historyKey, this.sessionTTL);

      // Update session activity
      await this.updateSessionActivity(sessionId);

      console.log(`Added message to history for session: ${sessionId}`);
    } catch (error) {
      console.error('Error adding to history:', error);
      throw error;
    }
  }

  async getSessionHistory(sessionId) {
    try {
      const historyKey = `${this.sessionPrefix}${sessionId}:history`;
      const historyItems = await redisClient.lRange(historyKey, 0, -1);
      
      return historyItems.map(item => JSON.parse(item)).reverse(); // Oldest first
    } catch (error) {
      console.error('Error getting session history:', error);
      return [];
    }
  }

  async clearSession(sessionId) {
    try {
      const sessionKey = `${this.sessionPrefix}${sessionId}`;
      const historyKey = `${this.sessionPrefix}${sessionId}:history`;
      
      await Promise.all([
        redisClient.del(sessionKey),
        redisClient.del(historyKey)
      ]);

      console.log(`Cleared session: ${sessionId}`);
    } catch (error) {
      console.error('Error clearing session:', error);
      throw error;
    }
  }

  async getActiveSessions() {
    try {
      const keys = await redisClient.keys(`${this.sessionPrefix}*`);
      const sessionKeys = keys.filter(key => !key.includes(':history'));
      
      const sessions = [];
      for (const key of sessionKeys) {
        const sessionData = await redisClient.get(key);
        if (sessionData) {
          sessions.push(JSON.parse(sessionData));
        }
      }

      return sessions;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  async cleanupExpiredSessions() {
    try {
      const sessions = await this.getActiveSessions();
      const now = new Date();
      let cleanedCount = 0;

      for (const session of sessions) {
        const lastActivity = new Date(session.lastActivity);
        const timeDiff = (now - lastActivity) / 1000; // seconds

        if (timeDiff > this.sessionTTL) {
          await this.clearSession(session.id);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired sessions`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }
}

module.exports = new SessionService();