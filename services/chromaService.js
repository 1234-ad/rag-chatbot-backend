const { ChromaClient } = require('chromadb');

class ChromaService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.collectionName = 'news_articles';
  }

  async initialize() {
    try {
      this.client = new ChromaClient({
        path: `http://${process.env.CHROMA_HOST || 'localhost'}:${process.env.CHROMA_PORT || 8000}`
      });

      // Create or get collection
      try {
        this.collection = await this.client.getCollection({
          name: this.collectionName
        });
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: { description: 'News articles for RAG chatbot' }
        });
      }

      console.log('Chroma service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Chroma service:', error);
      throw error;
    }
  }

  async addDocuments(documents, embeddings, metadatas, ids) {
    try {
      await this.collection.add({
        documents,
        embeddings,
        metadatas,
        ids
      });
      console.log(`Added ${documents.length} documents to collection`);
    } catch (error) {
      console.error('Error adding documents to Chroma:', error);
      throw error;
    }
  }

  async queryDocuments(queryEmbedding, nResults = 5) {
    try {
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults
      });
      return results;
    } catch (error) {
      console.error('Error querying Chroma:', error);
      throw error;
    }
  }

  async getCollectionCount() {
    try {
      const count = await this.collection.count();
      return count;
    } catch (error) {
      console.error('Error getting collection count:', error);
      return 0;
    }
  }

  async deleteCollection() {
    try {
      await this.client.deleteCollection({ name: this.collectionName });
      console.log('Collection deleted successfully');
    } catch (error) {
      console.error('Error deleting collection:', error);
      throw error;
    }
  }
}

module.exports = new ChromaService();