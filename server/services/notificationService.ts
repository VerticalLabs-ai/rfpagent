import { storage } from '../storage';

interface EmailConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail?: string;
}

export class NotificationService {
  private emailConfig: EmailConfig;

  constructor() {
    this.emailConfig = {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: process.env.SMTP_USER,
      smtpPassword: process.env.SMTP_PASSWORD,
      fromEmail: process.env.FROM_EMAIL || 'noreply@rfp-agent.com',
    };
  }

  async sendNewRFPNotification(rfpId: string): Promise<void> {
    try {
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) return;

      const notification = {
        type: 'discovery' as const,
        title: 'New RFP Discovered',
        message: `New opportunity found: ${rfp.title} from ${rfp.agency}`,
        relatedEntityType: 'rfp' as const,
        relatedEntityId: rfpId,
      };

      await storage.createNotification(notification);

      // Send email if configured
      if (this.isEmailConfigured()) {
        await this.sendEmail({
          subject: notification.title,
          body: `
            <h2>New RFP Discovered</h2>
            <p><strong>Title:</strong> ${rfp.title}</p>
            <p><strong>Agency:</strong> ${rfp.agency}</p>
            <p><strong>Deadline:</strong> ${rfp.deadline || 'Not specified'}</p>
            <p><strong>Estimated Value:</strong> ${rfp.estimatedValue || 'Not specified'}</p>
            <p><strong>Source:</strong> ${rfp.sourceUrl}</p>
            <p>Review the opportunity in your RFP dashboard.</p>
          `,
        });
      }
    } catch (error) {
      console.error('Error sending new RFP notification:', error);
    }
  }

  async sendComplianceAlert(rfpId: string, riskItems: any[]): Promise<void> {
    try {
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) return;

      const highRiskItems = riskItems.filter(item => item.type === 'high');

      if (highRiskItems.length === 0) return;

      const notification = {
        type: 'compliance' as const,
        title: 'High Risk Compliance Items Detected',
        message: `${highRiskItems.length} high-risk items found in ${rfp.title}`,
        relatedEntityType: 'rfp' as const,
        relatedEntityId: rfpId,
      };

      await storage.createNotification(notification);

      // Send email if configured
      if (this.isEmailConfigured()) {
        const riskList = highRiskItems
          .map(
            item =>
              `<li><strong>${item.category}:</strong> ${item.description}</li>`
          )
          .join('');

        await this.sendEmail({
          subject: `URGENT: High Risk Compliance Items - ${rfp.title}`,
          body: `
            <h2>High Risk Compliance Alert</h2>
            <p><strong>RFP:</strong> ${rfp.title}</p>
            <p><strong>Agency:</strong> ${rfp.agency}</p>
            <p><strong>Deadline:</strong> ${rfp.deadline || 'Not specified'}</p>
            
            <h3>High Risk Items Requiring Immediate Attention:</h3>
            <ul>${riskList}</ul>
            
            <p><strong>Action Required:</strong> Review these items immediately to ensure compliance.</p>
          `,
        });
      }
    } catch (error) {
      console.error('Error sending compliance alert:', error);
    }
  }

  async sendProposalReadyNotification(
    rfpId: string,
    proposalId: string
  ): Promise<void> {
    try {
      const [rfp, proposal] = await Promise.all([
        storage.getRFP(rfpId),
        storage.getProposal(proposalId),
      ]);

      if (!rfp || !proposal) return;

      const notification = {
        type: 'approval' as const,
        title: 'Proposal Ready for Review',
        message: `AI has completed the proposal for ${rfp.title}`,
        relatedEntityType: 'proposal' as const,
        relatedEntityId: proposalId,
      };

      await storage.createNotification(notification);

      // Send email if configured
      if (this.isEmailConfigured()) {
        await this.sendEmail({
          subject: `Proposal Ready for Review - ${rfp.title}`,
          body: `
            <h2>Proposal Ready for Review</h2>
            <p><strong>RFP:</strong> ${rfp.title}</p>
            <p><strong>Agency:</strong> ${rfp.agency}</p>
            <p><strong>Estimated Margin:</strong> ${proposal.estimatedMargin}%</p>
            <p><strong>Deadline:</strong> ${rfp.deadline || 'Not specified'}</p>
            
            <p>The AI has completed generating the proposal. Please review and approve for submission.</p>
            <p>Access your dashboard to review the proposal details.</p>
          `,
        });
      }
    } catch (error) {
      console.error('Error sending proposal ready notification:', error);
    }
  }

  async sendSubmissionConfirmation(submissionId: string): Promise<void> {
    try {
      const submission = await storage.getSubmission(submissionId);
      if (!submission) return;

      const rfp = await storage.getRFP(submission.rfpId);
      if (!rfp) return;

      const notification = {
        type: 'submission' as const,
        title: 'Proposal Successfully Submitted',
        message: `Proposal for ${rfp.title} has been submitted successfully`,
        relatedEntityType: 'submission' as const,
        relatedEntityId: submissionId,
      };

      await storage.createNotification(notification);

      // Send email if configured
      if (this.isEmailConfigured()) {
        const confirmationNumber =
          submission.receiptData?.confirmationNumber || 'N/A';

        await this.sendEmail({
          subject: `Submission Confirmed - ${rfp.title}`,
          body: `
            <h2>Proposal Submission Confirmed</h2>
            <p><strong>RFP:</strong> ${rfp.title}</p>
            <p><strong>Agency:</strong> ${rfp.agency}</p>
            <p><strong>Confirmation Number:</strong> ${confirmationNumber}</p>
            <p><strong>Submitted At:</strong> ${submission.submittedAt}</p>
            
            <p>Your proposal has been successfully submitted to the procurement portal.</p>
            <p>You will be notified of any updates regarding this submission.</p>
          `,
        });
      }
    } catch (error) {
      console.error('Error sending submission confirmation:', error);
    }
  }

  async sendDeadlineReminder(
    rfpId: string,
    daysRemaining: number
  ): Promise<void> {
    try {
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) return;

      const urgencyLevel = daysRemaining <= 2 ? 'URGENT' : 'REMINDER';

      const notification = {
        type: 'compliance' as const,
        title: `${urgencyLevel}: RFP Deadline Approaching`,
        message: `${rfp.title} deadline in ${daysRemaining} days`,
        relatedEntityType: 'rfp' as const,
        relatedEntityId: rfpId,
      };

      await storage.createNotification(notification);

      // Send email if configured
      if (this.isEmailConfigured()) {
        await this.sendEmail({
          subject: `${urgencyLevel}: RFP Deadline in ${daysRemaining} Days - ${rfp.title}`,
          body: `
            <h2>RFP Deadline Reminder</h2>
            <p><strong>RFP:</strong> ${rfp.title}</p>
            <p><strong>Agency:</strong> ${rfp.agency}</p>
            <p><strong>Deadline:</strong> ${rfp.deadline}</p>
            <p><strong>Days Remaining:</strong> ${daysRemaining}</p>
            <p><strong>Current Status:</strong> ${rfp.status}</p>
            
            ${
              daysRemaining <= 2
                ? '<p style="color: red;"><strong>URGENT ACTION REQUIRED:</strong> This deadline is approaching quickly!</p>'
                : '<p>Please ensure the proposal is ready for submission.</p>'
            }
          `,
        });
      }
    } catch (error) {
      console.error('Error sending deadline reminder:', error);
    }
  }

  private isEmailConfigured(): boolean {
    return !!(
      this.emailConfig.smtpHost &&
      this.emailConfig.smtpUser &&
      this.emailConfig.smtpPassword
    );
  }

  private async sendEmail(params: {
    subject: string;
    body: string;
  }): Promise<void> {
    try {
      // This would integrate with an email service
      // For now, we'll log what would be sent
      console.log('Email would be sent:');
      console.log('Subject:', params.subject);
      console.log('Body:', params.body);

      // TODO: Implement actual email sending using nodemailer or similar
      // const transporter = nodemailer.createTransporter({...});
      // await transporter.sendMail({...});
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  async sendDailyDigest(): Promise<void> {
    try {
      // Get today's activity
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // This would compile a daily digest of activity
      const notification = {
        type: 'discovery' as const,
        title: 'Daily RFP Activity Digest',
        message: 'Your daily summary of RFP activity',
        relatedEntityType: null as any,
        relatedEntityId: null as any,
      };

      await storage.createNotification(notification);
    } catch (error) {
      console.error('Error sending daily digest:', error);
    }
  }
}
