const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const chromaService = require('../services/chromaService');
const embeddingService = require('../services/embeddingService');

class NewsIngestionService {
  constructor() {
    this.parser = new Parser();
    this.articles = [];
  }

  async ingestFromRSS() {
    const rssFeeds = [
      'https://feeds.reuters.com/reuters/topNews',
      'https://feeds.reuters.com/reuters/businessNews',
      'https://feeds.reuters.com/reuters/technologyNews',
      'https://feeds.reuters.com/reuters/worldNews',
      'https://rss.cnn.com/rss/edition.rss',
      'https://feeds.bbci.co.uk/news/rss.xml'
    ];

    console.log('Starting RSS ingestion...');

    for (const feedUrl of rssFeeds) {
      try {
        console.log(`Fetching from: ${feedUrl}`);
        const feed = await this.parser.parseURL(feedUrl);
        
        for (const item of feed.items.slice(0, 10)) { // Limit to 10 articles per feed
          const article = {
            id: uuidv4(),
            title: item.title || 'No title',
            content: this.cleanContent(item.contentSnippet || item.content || item.summary || ''),
            url: item.link || '',
            published_date: item.pubDate || item.isoDate || new Date().toISOString(),
            source: feed.title || 'Unknown',
            category: this.extractCategory(feedUrl)
          };

          if (article.content.length > 100) { // Only add articles with substantial content
            this.articles.push(article);
          }
        }
      } catch (error) {
        console.error(`Error fetching RSS feed ${feedUrl}:`, error.message);
      }
    }

    console.log(`Collected ${this.articles.length} articles from RSS feeds`);
  }

  async ingestFromWebScraping() {
    const newsUrls = [
      'https://www.reuters.com/world/',
      'https://www.reuters.com/business/',
      'https://www.reuters.com/technology/'
    ];

    console.log('Starting web scraping...');

    for (const url of newsUrls) {
      try {
        console.log(`Scraping: ${url}`);
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        // Reuters-specific selectors
        $('article, .story-card, .media-story-card').each((index, element) => {
          if (index >= 5) return false; // Limit to 5 articles per page

          const $el = $(element);
          const title = $el.find('h2, h3, .headline').first().text().trim();
          const content = $el.find('p, .summary').first().text().trim();
          const link = $el.find('a').first().attr('href');

          if (title && content && content.length > 50) {
            const article = {
              id: uuidv4(),
              title: title,
              content: this.cleanContent(content),
              url: link ? (link.startsWith('http') ? link : `https://www.reuters.com${link}`) : url,
              published_date: new Date().toISOString(),
              source: 'Reuters',
              category: this.extractCategory(url)
            };

            this.articles.push(article);
          }
        });
      } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
      }
    }

    console.log(`Total articles after scraping: ${this.articles.length}`);
  }

  async generateSampleArticles() {
    console.log('Generating sample articles...');
    
    const sampleArticles = [
      {
        id: uuidv4(),
        title: "Global Climate Summit Reaches Historic Agreement",
        content: "World leaders at the Global Climate Summit have reached a historic agreement to reduce carbon emissions by 50% over the next decade. The agreement includes commitments from major economies to invest in renewable energy infrastructure and phase out fossil fuel subsidies. Environmental groups have praised the deal as a significant step forward in combating climate change.",
        url: "https://example.com/climate-summit",
        published_date: new Date().toISOString(),
        source: "Global News",
        category: "environment"
      },
      {
        id: uuidv4(),
        title: "Tech Giants Report Strong Q3 Earnings",
        content: "Major technology companies have reported stronger-than-expected earnings for the third quarter, driven by increased demand for cloud services and artificial intelligence solutions. Companies like Microsoft, Google, and Amazon saw significant growth in their cloud computing divisions, while AI-related investments continue to pay off.",
        url: "https://example.com/tech-earnings",
        published_date: new Date().toISOString(),
        source: "Tech Today",
        category: "technology"
      },
      {
        id: uuidv4(),
        title: "New Medical Breakthrough in Cancer Treatment",
        content: "Researchers at leading medical institutions have announced a breakthrough in cancer treatment using personalized immunotherapy. The new treatment approach has shown promising results in clinical trials, with patients experiencing significant tumor reduction. The therapy works by training the patient's immune system to better recognize and attack cancer cells.",
        url: "https://example.com/cancer-breakthrough",
        published_date: new Date().toISOString(),
        source: "Medical Journal",
        category: "health"
      },
      {
        id: uuidv4(),
        title: "Global Markets React to Economic Policy Changes",
        content: "International markets have shown mixed reactions to recent economic policy announcements from major central banks. While some investors remain optimistic about growth prospects, others express concerns about inflation and interest rate changes. Financial analysts suggest that market volatility may continue in the coming weeks.",
        url: "https://example.com/market-reaction",
        published_date: new Date().toISOString(),
        source: "Financial Times",
        category: "business"
      },
      {
        id: uuidv4(),
        title: "Space Mission Successfully Lands on Mars",
        content: "The latest Mars exploration mission has successfully landed on the red planet, marking another milestone in space exploration. The rover is equipped with advanced scientific instruments to search for signs of past microbial life and collect samples for future return to Earth. Mission scientists are excited about the potential discoveries ahead.",
        url: "https://example.com/mars-mission",
        published_date: new Date().toISOString(),
        source: "Space News",
        category: "science"
      }
    ];

    this.articles.push(...sampleArticles);
    console.log(`Added ${sampleArticles.length} sample articles`);
  }

  cleanContent(content) {
    return content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 1000); // Limit content length
  }

  extractCategory(url) {
    if (url.includes('business')) return 'business';
    if (url.includes('technology') || url.includes('tech')) return 'technology';
    if (url.includes('world')) return 'world';
    if (url.includes('health')) return 'health';
    if (url.includes('science')) return 'science';
    if (url.includes('sports')) return 'sports';
    return 'general';
  }

  async storeInVectorDB() {
    console.log('Storing articles in vector database...');

    // Remove duplicates based on title
    const uniqueArticles = this.articles.filter((article, index, self) =>
      index === self.findIndex(a => a.title === article.title)
    );

    console.log(`Processing ${uniqueArticles.length} unique articles`);

    // Prepare data for batch processing
    const documents = uniqueArticles.map(article => 
      `${article.title}\n\n${article.content}`
    );
    
    const metadatas = uniqueArticles.map(article => ({
      title: article.title,
      url: article.url,
      published_date: article.published_date,
      source: article.source,
      category: article.category
    }));

    const ids = uniqueArticles.map(article => article.id);

    // Generate embeddings in batches
    const batchSize = 10;
    const embeddings = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`Generating embeddings for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(documents.length/batchSize)}`);
      
      const batchEmbeddings = await embeddingService.generateBatchEmbeddings(batch);
      embeddings.push(...batchEmbeddings);
    }

    // Store in Chroma
    await chromaService.addDocuments(documents, embeddings, metadatas, ids);
    
    console.log(`Successfully stored ${uniqueArticles.length} articles in vector database`);
  }

  async run() {
    try {
      console.log('Starting news ingestion process...');
      
      // Initialize Chroma service
      await chromaService.initialize();
      
      // Try RSS ingestion first
      await this.ingestFromRSS();
      
      // If we don't have enough articles, try web scraping
      if (this.articles.length < 20) {
        await this.ingestFromWebScraping();
      }
      
      // If still not enough, add sample articles
      if (this.articles.length < 10) {
        await this.generateSampleArticles();
      }

      // Ensure we have at least some articles
      if (this.articles.length === 0) {
        throw new Error('No articles were collected');
      }

      // Store in vector database
      await this.storeInVectorDB();
      
      // Get final count
      const count = await chromaService.getCollectionCount();
      console.log(`Ingestion complete! Total articles in database: ${count}`);
      
    } catch (error) {
      console.error('Error during news ingestion:', error);
      process.exit(1);
    }
  }
}

// Run the ingestion if this file is executed directly
if (require.main === module) {
  const ingestionService = new NewsIngestionService();
  ingestionService.run();
}

module.exports = NewsIngestionService;