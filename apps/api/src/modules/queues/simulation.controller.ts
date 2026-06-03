import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SimulationConfigService } from './simulation-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Simulation Sandbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('simulation')
export class SimulationController {
  constructor(private readonly simConfig: SimulationConfigService) {}

  @Post('normal-traffic')
  @ApiOperation({ summary: 'Generate healthy traffic' })
  generateNormalTraffic() {
    const config = this.simConfig.updateConfig({
      generateTraffic: true,
      simulateSmtpFailure: false,
      simulateWebhookOutage: false,
      simulateWorkerSlowdown: false,
      simulateInvalidPayload: false,
      simulateTimeoutFailure: false,
    });
    return { success: true, config };
  }

  @Post('smtp-failure')
  @ApiOperation({ summary: 'Trigger SMTP failure simulator' })
  triggerSmtpFailure() {
    const config = this.simConfig.updateConfig({
      simulateSmtpFailure: true,
    });
    return { success: true, config };
  }

  @Post('worker-slowdown')
  @ApiOperation({ summary: 'Trigger worker slowdown/bottleneck simulator' })
  triggerWorkerSlowdown() {
    const config = this.simConfig.updateConfig({
      simulateWorkerSlowdown: true,
    });
    return { success: true, config };
  }

  @Post('invalid-payload')
  @ApiOperation({ summary: 'Trigger schema payload validation failure' })
  triggerInvalidPayload() {
    const config = this.simConfig.updateConfig({
      simulateInvalidPayload: true,
    });
    return { success: true, config };
  }

  @Post('webhook-outage')
  @ApiOperation({ summary: 'Trigger Stripe webhook outage timeout' })
  triggerWebhookOutage() {
    const config = this.simConfig.updateConfig({
      simulateWebhookOutage: true,
    });
    return { success: true, config };
  }

  @Post('recover')
  @ApiOperation({ summary: 'Clear all simulation errors' })
  recover() {
    this.simConfig.clear();
    const config = this.simConfig.updateConfig({ generateTraffic: true });
    return { success: true, config };
  }
}
