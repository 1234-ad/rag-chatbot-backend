const { GoogleGenerativeAI } = require('@google/generative-ai');
const chromaService = require('./chromaService');
const embeddingService = require('./embeddingService');
const redisClient = require('../config/redis');

class RAGService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.cachePrefix = 'rag_cache:';
    this.cacheTTL = parseInt(process.env.CACHE_TTL) || 1800; // 30 minutes
  }

  async processQuery(query, sessionId) {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}${Buffer.from(query).toString('base64')}`;
      const cachedResult = await redisClient.get(cacheKey);
      
      if (cachedResult) {
        console.log('Returning cached result');
        return JSON.parse(cachedResult);
      }

      // Generate embedding for the query
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Retrieve relevant documents from Chroma
      const searchResults = await chromaService.queryDocuments(queryEmbedding, 5);
      
      if (!searchResults.documents || searchResults.documents[0].length === 0) {
        const fallbackResponse = "I don't have enough information in my knowledge base to answer that question. Could you try asking about recent news topics?";
        
        // Cache the fallback response
        await redisClient.setEx(cacheKey, this.cacheTTL, JSON.stringify(fallbackResponse));
        return fallbackResponse;
      }

      // Prepare context from retrieved documents
      const context = searchResults.documents[0]
        .slice(0, 3) // Top 3 most relevant documents
        .map((doc, index) => {
          const metadata = searchResults.metadatas[0][index];
          return `Article ${index + 1}: ${metadata?.title || 'News Article'}
Content: ${doc}
Source: ${metadata?.url || 'Unknown'}
Published: ${metadata?.published_date || 'Unknown'}`;
        })
        .join('\n\n');

      // Generate response using Gemini
      const prompt = `You are a helpful news chatbot. Based on the following news articles, answer the user's question accurately and concisely.

Context from news articles:
${context}

User Question: ${query}

Instructions:
- Provide a clear, informative answer based on the provided context
- If the context doesn't fully answer the question, say so
- Include relevant details from the articles
- Keep the response conversational and helpful
- If you mention specific facts, try to indicate which article they came from

Answer:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Cache the response
      await redisClient.setEx(cacheKey, this.cacheTTL, JSON.stringify(response));

      return response;
    } catch (error) {
      console.error('Error in RAG processing:', error);
      return "I'm sorry, I encountered an error while processing your question. Please try again.";
    }
  }

  async clearCache() {
    try {
      const keys = await redisClient.keys(`${this.cachePrefix}*`);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(`Cleared ${keys.length} cached responses`);
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  async getCacheStats() {
    try {
      const keys = await redisClient.keys(`${this.cachePrefix}*`);
      return {
        totalCachedQueries: keys.length,
        cachePrefix: this.cachePrefix,
        cacheTTL: this.cacheTTL
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalCachedQueries: 0, cachePrefix: this.cachePrefix, cacheTTL: this.cacheTTL };
    }
  }
}

module.exports = new RAGService();