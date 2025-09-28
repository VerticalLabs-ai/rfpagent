import cron from 'node-cron';
import { getMastraScrapingService } from '../services/mastraScrapingService';
import { NotificationService } from '../services/notificationService';
import { storage } from '../storage';

export function setupScrapingScheduler(): void {
  const scrapingService = getMastraScrapingService();
  const notificationService = new NotificationService();

  // Schedule portal scraping every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    console.log('Starting scheduled portal scraping...');
    try {
      await scrapingService.scrapeAllPortals();
      console.log('Scheduled portal scraping completed');
    } catch (error) {
      console.error('Error in scheduled portal scraping:', error);
    }
  });

  // Schedule deadline checking every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Checking RFP deadlines...');
    try {
      await checkUpcomingDeadlines();
    } catch (error) {
      console.error('Error checking deadlines:', error);
    }
  });

  // Schedule daily digest at 8 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('Sending daily digest...');
    try {
      await notificationService.sendDailyDigest();
    } catch (error) {
      console.error('Error sending daily digest:', error);
    }
  });

  // Schedule compliance monitoring every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    console.log('Monitoring compliance status...');
    try {
      await monitorCompliance();
    } catch (error) {
      console.error('Error monitoring compliance:', error);
    }
  });

  console.log('RFP scraping scheduler initialized');
}

async function checkUpcomingDeadlines(): Promise<void> {
  try {
    const notificationService = new NotificationService();

    // Get active RFPs with deadlines
    const activeRfps = await storage.getRFPsByStatus('approved');
    const today = new Date();

    for (const rfp of activeRfps) {
      if (!rfp.deadline) continue;

      const deadlineDate = new Date(rfp.deadline);
      const timeDiff = deadlineDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

      // Send reminders for deadlines within 7 days
      if (daysRemaining <= 7 && daysRemaining > 0) {
        await notificationService.sendDeadlineReminder(rfp.id, daysRemaining);
      }

      // Mark as overdue if past deadline
      if (daysRemaining <= 0 && rfp.status !== 'submitted') {
        await storage.updateRFP(rfp.id, {
          status: 'closed',
        });

        await storage.createNotification({
          type: 'compliance',
          title: 'RFP Deadline Missed',
          message: `${rfp.title} deadline has passed`,
          relatedEntityType: 'rfp',
          relatedEntityId: rfp.id,
        });
      }
    }
  } catch (error) {
    console.error('Error checking deadlines:', error);
  }
}

async function monitorCompliance(): Promise<void> {
  try {
    const notificationService = new NotificationService();

    // Get RFPs in review status that might need attention
    const reviewRfps = await storage.getRFPsByStatus('review');

    for (const rfp of reviewRfps) {
      if (rfp.riskFlags) {
        const highRiskFlags = (rfp.riskFlags as any[]).filter(
          flag => flag.type === 'high'
        );

        if (highRiskFlags.length > 0) {
          // Check if we've already sent alerts for these risk flags
          const recentNotifications = await storage.getAllNotifications(10);
          const hasRecentAlert = recentNotifications.some(
            notification =>
              notification.relatedEntityId === rfp.id &&
              notification.type === 'compliance' &&
              notification.createdAt &&
              new Date().getTime() -
                new Date(notification.createdAt).getTime() <
                24 * 60 * 60 * 1000 // 24 hours
          );

          if (!hasRecentAlert) {
            await notificationService.sendComplianceAlert(
              rfp.id,
              highRiskFlags
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('Error monitoring compliance:', error);
  }
}
