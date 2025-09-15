const axios = require('axios');

class EmbeddingService {
  constructor() {
    this.jinaApiKey = process.env.JINA_API_KEY;
    this.jinaBaseUrl = 'https://api.jina.ai/v1/embeddings';
  }

  async generateEmbedding(text) {
    try {
      if (!this.jinaApiKey) {
        throw new Error('Jina API key not configured');
      }

      const response = await axios.post(
        this.jinaBaseUrl,
        {
          model: 'jina-embeddings-v2-base-en',
          input: [text],
          encoding_format: 'float'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.jinaApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding with Jina:', error.message);
      
      // Fallback to simple embedding (for demo purposes)
      return this.generateSimpleEmbedding(text);
    }
  }

  async generateBatchEmbeddings(texts) {
    try {
      if (!this.jinaApiKey) {
        throw new Error('Jina API key not configured');
      }

      const response = await axios.post(
        this.jinaBaseUrl,
        {
          model: 'jina-embeddings-v2-base-en',
          input: texts,
          encoding_format: 'float'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.jinaApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings with Jina:', error.message);
      
      // Fallback to simple embeddings
      return texts.map(text => this.generateSimpleEmbedding(text));
    }
  }

  // Simple embedding fallback (for demo purposes)
  generateSimpleEmbedding(text) {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0); // Standard embedding size
    
    // Simple hash-based embedding
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const charCode = word.charCodeAt(j);
        const index = (charCode + i + j) % embedding.length;
        embedding[index] += Math.sin(charCode * 0.1) * 0.1;
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }
}

module.exports = new EmbeddingService();