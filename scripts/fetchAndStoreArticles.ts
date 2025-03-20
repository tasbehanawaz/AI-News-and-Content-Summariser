import { prisma } from '../lib/prisma.js';
import { getTopNews, NEWS_CATEGORIES } from '../lib/news-service.js';
import cron from 'node-cron';

async function fetchAndStoreArticles() {
  try {
    console.log('Starting to fetch articles...', new Date().toISOString());
    
    // Fetch articles for each category
    for (const category of NEWS_CATEGORIES) {
      console.log(`Fetching articles for category: ${category}`);
      
      try {
        const { articles } = await getTopNews(category);
        let storedCount = 0;
        
        // Store each article
        for (const article of articles) {
          if (!article.title || !article.description) {
            console.log('Skipping article with missing required fields');
            continue;
          }

          const articleId = Buffer.from(article.url).toString('base64');
          
          await prisma.article.upsert({
            where: {
              id: articleId
            },
            update: {
              title: article.title,
              content: article.description,
              topic: category.toLowerCase(),
              author: article.author || null,
              publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
              source: article.source?.name || null,
            },
            create: {
              id: articleId,
              title: article.title,
              content: article.description,
              topic: category.toLowerCase(),
              author: article.author || null,
              publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
              source: article.source?.name || null,
            },
          });
          storedCount++;
        }
        
        console.log(`Stored ${storedCount} articles for category: ${category}`);

        // Add a small delay between categories to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing category ${category}:`, error);
        continue; // Continue with next category even if one fails
      }
    }
    
    // Clean up old articles
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count } = await prisma.article.deleteMany({
      where: {
        createdAt: {
          lt: twentyFourHoursAgo
        }
      }
    });
    console.log(`Cleaned up ${count} old articles`);
    
    console.log('Finished fetching and storing articles');
  } catch (error) {
    console.error('Error in fetchAndStoreArticles:', error);
  }
}

// Run immediately
fetchAndStoreArticles();

// Then run every 30 minutes
cron.schedule('*/30 * * * *', fetchAndStoreArticles);

console.log('Article fetching service started');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Article fetching service stopped');
  process.exit();
});

// Error handling for unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in article fetching service:', error);
}); 