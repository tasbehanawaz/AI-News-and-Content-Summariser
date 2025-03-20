import { prisma } from '../lib/prisma.js';
import { summarizeArticles } from '../lib/summarizer.js';
import { sendEmail, formatNewsletterEmail } from '../lib/emailService.js';
import { sendSMS } from '../lib/smsService.js';

interface ArticleSummary {
  title: string;
  content: string;
  source: string;
  author?: string;
  publishedAt?: string;
}

export class NewsletterService {
  async generateNewsletter(userId: string) {
    try {
      // Get user preferences with user email
      const preferences = await prisma.newsletterPreferences.findUnique({
        where: { userId },
        include: { user: true }
      });

      if (!preferences || !preferences.enabled || !preferences.user?.email) {
        console.log('Newsletter disabled or user not found for userId:', userId);
        return;
      }

      // Convert topics to lowercase for case-insensitive matching
      const lowerCaseTopics = preferences.topics.map(topic => topic.toLowerCase());

      // Fetch articles based on user's topics (case-insensitive)
      const articles = await prisma.article.findMany({
        where: {
          topic: { in: lowerCaseTopics },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: {
          publishedAt: 'desc'
        },
        take: 10 // Limit to 10 most recent articles
      });

      if (articles.length === 0) {
        console.log('No articles found for topics:', preferences.topics);
        // Log this for monitoring
        await prisma.newsletterError.create({
          data: {
            userId: preferences.userId,
            error: `No articles found for topics: ${preferences.topics.join(', ')}`,
            timestamp: new Date()
          }
        });
        return;
      }

      // Generate summaries
      const summaries = await summarizeArticles(articles);

      // Convert summaries to the correct format
      const formattedSummaries: ArticleSummary[] = summaries.map(summary => ({
        title: summary.title,
        content: summary.content,
        source: summary.source || 'AI News Summariser',
        author: summary.author,
        publishedAt: summary.publishedAt || new Date().toISOString()
      }));

      // Create newsletter content using the improved template
      const newsletterContent = formatNewsletterEmail(formattedSummaries, preferences.frequency as 'daily' | 'weekly');

      // Send notifications based on user preference
      if (preferences.notificationMethod === 'email' || preferences.notificationMethod === 'both') {
        await sendEmail(userId, newsletterContent);
        console.log('Newsletter email sent to user:', userId);
      }

      if (preferences.notificationMethod === 'sms' || preferences.notificationMethod === 'both') {
        const plainTextContent = this.formatPlainTextNewsletter(formattedSummaries);
        await sendSMS(userId, plainTextContent);
        console.log('Newsletter SMS sent to user:', userId);
      }
    } catch (error) {
      console.error('Failed to generate newsletter:', error);
      // Log the error for monitoring
      await prisma.newsletterError.create({
        data: {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        }
      });
      throw error;
    }
  }

  private formatPlainTextNewsletter(summaries: ArticleSummary[]): string {
    return summaries.map(summary => `
${summary.title}
${summary.author ? `By ${summary.author}` : ''}
${summary.source} • ${new Date(summary.publishedAt || '').toLocaleDateString()}

${summary.content}

-------------------
    `).join('\n');
  }
} 