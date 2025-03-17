import { prisma } from '../lib/prisma';
import { summarizeArticles } from '../lib/summarizer';
import { sendEmail } from '../lib/emailService';
import { sendSMS } from '../lib/smsService';

export class NewsletterService {
  async generateNewsletter(userId: string) {
    // Get user preferences
    const preferences = await prisma.newsletterPreferences.findUnique({
      where: { userId },
    });

    if (!preferences || !preferences.enabled) {
      return;
    }
    // Fetch articles based on user's topics
    const articles = await prisma.Article.findMany({
      where: {
        topic: { in: preferences.topics },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    // Generate summaries
    const summaries = await summarizeArticles(articles);

    // Create newsletter content
    const newsletterContent = this.formatNewsletter(summaries);

    // Send notifications based on user preference
    if (preferences.notificationMethod === 'email' || preferences.notificationMethod === 'both') {
      await sendEmail(userId, newsletterContent);
    }

    if (preferences.notificationMethod === 'sms' || preferences.notificationMethod === 'both') {
      await sendSMS(userId, newsletterContent);
    }
  }

  private formatNewsletter(summaries: any[]) {
    // Format the newsletter content
    return `
      <h1>Your AI News Digest</h1>
      ${summaries.map(summary => `
        <h2>${summary.title}</h2>
        <p>${summary.content}</p>
      `).join('')}
    `;
  }
} 