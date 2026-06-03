import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkersService } from './workers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Workers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  @ApiOperation({ summary: 'List all background workers and health properties' })
  @ApiResponse({ status: 200, description: 'Return background worker lists.' })
  getWorkers() {
    return this.workersService.getWorkersList();
  }
}
