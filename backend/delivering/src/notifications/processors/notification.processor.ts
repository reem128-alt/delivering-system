import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { NotificationPayload } from '../dto/send-notification.dto';

@Processor('notifications') //decorator mark this class as a processor
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Process('retry-notification') //decorator mark this method as a processor
  /* Handles failed notifications that need to be retried*/
  async handleRetryNotification(
    job: Job<{ notificationId: number; payload: NotificationPayload }>,
  ) {
    const { notificationId, payload } = job.data;

    this.logger.log(
      `Retrying notification ${notificationId} (Attempt ${job.attemptsMade + 1})`,
    );

    try {
      await this.notificationsService.sendNotification(payload);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Retry failed for notification ${notificationId}: ${message}`,
      );
      throw error;
    }
  }

  // Processes time-delayed notifications Sends notifications at specific times (reminders, promotions, etc.)

  @Process('scheduled-notification')
  async handleScheduledNotification(job: Job<NotificationPayload>) {
    this.logger.log(
      `Processing scheduled notification for user ${job.data.userId}`,
    );
    await this.notificationsService.sendNotification(job.data);
  }
}
