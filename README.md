# RAG-Powered News Chatbot Backend

A Node.js/Express backend for a Retrieval-Augmented Generation (RAG) chatbot that answers queries about news articles using vector embeddings and Google Gemini AI.

## 🚀 Features

- **RAG Pipeline**: Ingest news articles, generate embeddings, and retrieve relevant context
- **Vector Database**: Chroma DB for storing and querying document embeddings
- **Real-time Chat**: Socket.IO for real-time messaging
- **Session Management**: Redis-based session handling with TTL
- **Caching**: Intelligent response caching for improved performance
- **News Ingestion**: RSS feeds and web scraping for article collection
- **Embeddings**: Jina Embeddings API with fallback support

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO
- **Vector DB**: ChromaDB
- **Cache/Sessions**: Redis
- **LLM**: Google Gemini Pro
- **Embeddings**: Jina Embeddings v2
- **News Sources**: RSS feeds, Web scraping

## 📋 Prerequisites

- Node.js 16+ 
- Redis server
- ChromaDB server
- Google Gemini API key
- Jina Embeddings API key (optional)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/1234-ad/rag-chatbot-backend.git
   cd rag-chatbot-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   PORT=5000
   REDIS_URL=redis://localhost:6379
   CHROMA_HOST=localhost
   CHROMA_PORT=8000
   GEMINI_API_KEY=your_gemini_api_key
   JINA_API_KEY=your_jina_api_key
   SESSION_TTL=3600
   CACHE_TTL=1800
   ```

4. **Start required services**
   ```bash
   # Start Redis
   redis-server
   
   # Start ChromaDB
   docker run -p 8000:8000 chromadb/chroma
   ```

5. **Ingest news articles**
   ```bash
   npm run ingest
   ```

6. **Start the server**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## 📡 API Endpoints

### Session Management
- `POST /api/session` - Create new session
- `GET /api/session/:sessionId/history` - Get session history
- `DELETE /api/session/:sessionId` - Clear session

### Chat
- `POST /api/chat` - Send message and get response

### Health Check
- `GET /health` - Server health status

## 🔌 Socket.IO Events

### Client → Server
- `join-session` - Join a session room
- `send-message` - Send chat message

### Server → Client
- `message-response` - Chat response
- `typing` - Typing indicator
- `error` - Error messages

## 🏗 Architecture

### RAG Pipeline Flow
1. **Query Processing**: User sends message
2. **Embedding Generation**: Convert query to vector using Jina API
3. **Vector Search**: Find relevant articles in ChromaDB
4. **Context Preparation**: Format retrieved articles
5. **LLM Generation**: Generate response using Gemini with context
6. **Caching**: Store response in Redis for future queries

### Caching Strategy

#### Response Caching
- **Key**: `rag_cache:{base64_query}`
- **TTL**: 30 minutes (configurable)
- **Purpose**: Avoid re-processing identical queries

#### Session Caching
- **Key**: `session:{sessionId}`
- **TTL**: 1 hour (configurable)
- **Purpose**: Maintain user sessions and chat history

#### Cache Warming
```javascript
// Implement cache warming for common queries
const commonQueries = [
  "What's the latest news?",
  "Tell me about technology news",
  "What's happening in business?"
];

// Pre-generate responses during low-traffic periods
```

#### TTL Configuration
```javascript
// Environment variables for TTL control
SESSION_TTL=3600    // 1 hour
CACHE_TTL=1800      // 30 minutes

// Dynamic TTL based on query complexity
const dynamicTTL = queryComplexity > 0.8 ? 7200 : 1800;
```

## 📊 Performance Optimizations

### Embedding Optimization
- Batch processing for multiple embeddings
- Fallback to simple embeddings if API fails
- Embedding caching for repeated content

### Database Optimization
- Connection pooling for Redis
- Efficient vector similarity search
- Document chunking for large articles

### Memory Management
- Session cleanup for expired sessions
- Limited chat history (50 messages per session)
- Garbage collection for unused embeddings

## 🔍 News Ingestion

The system supports multiple news sources:

### RSS Feeds
- Reuters (Top News, Business, Technology, World)
- CNN RSS
- BBC News RSS

### Web Scraping
- Reuters article pages
- Configurable selectors for different news sites

### Sample Data
- Fallback sample articles for development/testing

### Running Ingestion
```bash
# One-time ingestion
npm run ingest

# Scheduled ingestion (implement with cron)
0 */6 * * * cd /path/to/app && npm run ingest
```

## 🚀 Deployment

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
REDIS_URL=redis://your-redis-host:6379
CHROMA_HOST=your-chroma-host
GEMINI_API_KEY=your-production-key
```

### Hosting Options
- **Render.com**: Easy deployment with Redis add-on
- **Railway**: Simple Node.js deployment
- **Heroku**: With Redis and ChromaDB add-ons
- **AWS/GCP**: Full control with managed services

## 🧪 Testing

```bash
# Test the health endpoint
curl http://localhost:5000/health

# Test session creation
curl -X POST http://localhost:5000/api/session

# Test chat endpoint
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the latest news?", "sessionId": "your-session-id"}'
```

## 📈 Monitoring

### Key Metrics
- Response time for RAG queries
- Cache hit/miss ratios
- Active session count
- Vector database query performance
- Memory usage and garbage collection

### Logging
```javascript
// Structured logging for production
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## 🔒 Security

- Input validation and sanitization
- Rate limiting for API endpoints
- CORS configuration
- Environment variable protection
- Session token validation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Troubleshooting

### Common Issues

1. **ChromaDB Connection Failed**
   ```bash
   # Ensure ChromaDB is running
   docker run -p 8000:8000 chromadb/chroma
   ```

2. **Redis Connection Error**
   ```bash
   # Check Redis status
   redis-cli ping
   ```

3. **Embedding Generation Fails**
   - Check Jina API key
   - System falls back to simple embeddings

4. **No Articles Found**
   ```bash
   # Re-run ingestion
   npm run ingest
   ```

### Debug Mode
```bash
DEBUG=* npm run dev
```

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the logs for error details