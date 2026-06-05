import { Injectable } from '@nestjs/common';

export interface SimulationConfig {
  generateTraffic: boolean;
  simulateSmtpFailure: boolean;
  simulateWebhookOutage: boolean;
  simulateWorkerSlowdown: boolean;
  simulateInvalidPayload: boolean;
  simulateTimeoutFailure: boolean;
}

@Injectable()
export class SimulationConfigService {
  private config: SimulationConfig = {
    generateTraffic: false, // Default to false to ensure a clean, real-data-only experience by default
    simulateSmtpFailure: false,
    simulateWebhookOutage: false,
    simulateWorkerSlowdown: false,
    simulateInvalidPayload: false,
    simulateTimeoutFailure: false,
  };

  getConfig(): SimulationConfig {
    return this.config;
  }

  updateConfig(partial: Partial<SimulationConfig>): SimulationConfig {
    this.config = { ...this.config, ...partial };
    return this.config;
  }

  clear() {
    this.config = {
      generateTraffic: false,
      simulateSmtpFailure: false,
      simulateWebhookOutage: false,
      simulateWorkerSlowdown: false,
      simulateInvalidPayload: false,
      simulateTimeoutFailure: false,
    };
  }
}
