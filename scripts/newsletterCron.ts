import { prisma } from '../lib/prisma.js';
import { NewsletterService } from '../services/NewsletterService.js';
import cron from 'node-cron';

const newsletterService = new NewsletterService();

async function sendNewsletters() {
  try {
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Get all users with enabled newsletter preferences
    const preferences = await prisma.newsletterPreferences.findMany({
      where: {
        enabled: true,
        OR: [
          // Daily newsletters
          {
            frequency: 'daily',
            time: currentTime
          },
          // Weekly newsletters on the specified day
          {
            frequency: 'weekly',
            time: currentTime,
            days: {
              has: currentDay
            }
          }
        ]
      },
      include: {
        user: true
      }
    });

    console.log(`Found ${preferences.length} users with newsletters scheduled for ${currentTime}`);

    // Process newsletters in batches to avoid overwhelming the system
    const BATCH_SIZE = 10;
    for (let i = 0; i < preferences.length; i += BATCH_SIZE) {
      const batch = preferences.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (pref) => {
          if (!pref.user?.email) {
            console.warn(`Skipping newsletter for user ${pref.userId}: No email found`);
            return;
          }

          try {
            await newsletterService.generateNewsletter(pref.userId);
            console.log(`Successfully sent ${pref.frequency} newsletter to user ${pref.userId}`);
          } catch (error) {
            console.error(`Failed to send newsletter to user ${pref.userId}:`, error);
            
            // Log the error for monitoring
            await prisma.newsletterError.create({
              data: {
                userId: pref.userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date()
              }
            });
          }
        })
      );

      // Add a small delay between batches to prevent rate limiting
      if (i + BATCH_SIZE < preferences.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('Error in sendNewsletters:', error);
  }
}

// Run every minute to check for newsletters to send
cron.schedule('* * * * *', sendNewsletters);

console.log('Newsletter cron job started');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Newsletter cron job stopped');
  process.exit();
});

// Error handling for unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in newsletter service:', error);
}); 