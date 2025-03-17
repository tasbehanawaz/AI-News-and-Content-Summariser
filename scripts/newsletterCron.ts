import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { NewsletterService } from '../services/NewsletterService';

const newsletterService = new NewsletterService();

// Run every hour
cron.schedule('0 * * * *', async () => {
  try {
    // Get all active newsletter subscriptions
    const activeSubscriptions = await prisma.newsletterPreferences.findMany({
      where: { enabled: true },
    });

    // Check each subscription
    for (const subscription of activeSubscriptions) {
      const [hour, minute] = subscription.time.split(':');
      const currentHour = new Date().getHours();
      const currentMinute = new Date().getMinutes();

      // If it's time to send the newsletter
      if (currentHour === parseInt(hour) && currentMinute === parseInt(minute)) {
        await newsletterService.generateNewsletter(subscription.userId);
      }
    }
  } catch (error) {
    console.error('Newsletter cron job failed:', error);
  }
}); 