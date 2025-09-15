const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const redisClient = require('./config/redis');
const chromaService = require('./services/chromaService');
const ragService = require('./services/ragService');
const sessionService = require('./services/sessionService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create new session
app.post('/api/session', async (req, res) => {
  try {
    const sessionId = uuidv4();
    await sessionService.createSession(sessionId);
    res.json({ sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session history
app.get('/api/session/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await sessionService.getSessionHistory(sessionId);
    res.json({ history });
  } catch (error) {
    console.error('Error fetching session history:', error);
    res.status(500).json({ error: 'Failed to fetch session history' });
  }
});

// Clear session
app.delete('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await sessionService.clearSession(sessionId);
    res.json({ message: 'Session cleared successfully' });
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'Message and sessionId are required' });
    }

    // Process the query through RAG pipeline
    const response = await ragService.processQuery(message, sessionId);
    
    // Store in session history
    await sessionService.addToHistory(sessionId, {
      user: message,
      bot: response,
      timestamp: new Date().toISOString()
    });

    res.json({ response });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Socket.IO for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    console.log(`User ${socket.id} joined session ${sessionId}`);
  });

  socket.on('send-message', async (data) => {
    try {
      const { message, sessionId } = data;
      
      // Emit typing indicator
      socket.to(sessionId).emit('typing', true);
      
      // Process through RAG pipeline
      const response = await ragService.processQuery(message, sessionId);
      
      // Store in session history
      await sessionService.addToHistory(sessionId, {
        user: message,
        bot: response,
        timestamp: new Date().toISOString()
      });

      // Emit response
      socket.to(sessionId).emit('typing', false);
      io.to(sessionId).emit('message-response', {
        user: message,
        bot: response,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Socket error:', error);
      socket.emit('error', 'Failed to process message');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// Initialize services and start server
async function startServer() {
  try {
    // Initialize Redis connection
    await redisClient.connect();
    console.log('Connected to Redis');
    
    // Initialize Chroma service
    await chromaService.initialize();
    console.log('Connected to Chroma');
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;