import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Set global API routing prefix
  app.setGlobalPrefix('api');

  // Configure CORS policies
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Compile Swagger OpenAPI Specs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('QueueWatch Observability API')
    .setDescription('Real-time observability and outage simulator panel for BullMQ + Redis background job architectures.')
    .setVersion('1.0.0')
    .addTag('Queues Telemetry & Controls')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3001;

  await app.listen(port);
  
  logger.log(`========================================================================`);
  logger.log(`🚀 QueueWatch API Backend is actively running on: http://localhost:${port}/api`);
  logger.log(`📖 Interactive OpenAPI documentation: http://localhost:${port}/api/docs`);
  logger.log(`========================================================================`);
}
bootstrap();
