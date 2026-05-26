import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { SimulationConfigService } from './simulation-config.service';

@Injectable()
export class TrafficGeneratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrafficGeneratorService.name);
  private timer: NodeJS.Timeout;

  constructor(
    private queuesService: QueuesService,
    private simConfig: SimulationConfigService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.tick();
    }, 3500);
    this.logger.log('Traffic generator service successfully initialized.');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async tick() {
    if (!this.simConfig.getConfig().generateTraffic) {
      return;
    }

    const count = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < count; i++) {
      await this.generateRandomJob();
    }
  }

  private async generateRandomJob() {
    const queueOptions = [
      {
        name: 'email_queue',
        jobs: [
          { name: 'send_welcome_email', mockData: { userId: 'usr_902', email: 'alice@example.com', template: 'welcome_v2' } },
          { name: 'send_password_reset', mockData: { userId: 'usr_104', email: 'bob@domain.org', token: 'rst_9a2f7' } },
          { name: 'send_receipt_email', mockData: { orderId: 'ord_f823', amount: 89.99, email: 'sales@cust.com' } },
        ],
      },
      {
        name: 'image_processing_queue',
        jobs: [
          { name: 'resize_avatar', mockData: { avatarId: 'avt_992a', dimensions: [128, 128], imageUrl: 'https://cdn.queuewatch.io/avatars/avt_992a.png' } },
          { name: 'compress_hero_image', mockData: { assetId: 'img_88a', originalSize: '12.4MB', imageUrl: 'https://cdn.queuewatch.io/heros/large_home.png' } },
        ],
      },
      {
        name: 'webhook_delivery_queue',
        jobs: [
          { name: 'stripe_invoice_payment_succeeded', mockData: { invoiceId: 'in_8f11', customerId: 'cus_8aa2', total: 199.00 } },
          { name: 'hubspot_contact_sync', mockData: { contactId: 'hb_823', email: 'charlie@hub.com', updatedFields: ['last_login'] } },
        ],
      },
      {
        name: 'ai_task_queue',
        jobs: [
          { name: 'vectorize_documents', mockData: { docId: 'doc_44b', chunkCount: 142, embeddingEngine: 'text-embedding-ada-002' } },
          { name: 'run_sentiment_analysis', mockData: { reviewId: 'rv_021', textSnippet: 'Excellent background queue processor, absolutely wow.' } },
        ],
      },
    ];

    const chosenQueue = queueOptions[Math.floor(Math.random() * queueOptions.length)];
    const chosenJob = chosenQueue.jobs[Math.floor(Math.random() * chosenQueue.jobs.length)];

    try {
      await this.queuesService.addJob(chosenQueue.name, chosenJob.name, chosenJob.mockData);
    } catch (e) {
      this.logger.error(`Traffic Generator failed to enqueue job on ${chosenQueue.name}: ${e.message}`);
    }
  }
}
