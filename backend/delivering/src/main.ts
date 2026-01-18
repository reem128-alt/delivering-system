import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  try {
    const app = await NestFactory.create(AppModule);
    // Enable CORS for GraphQL
    app.enableCors({
      origin: process.env.WEBSOCKET_CORS_ORIGIN?.split(',') || '*',
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: 'Content-Type, Accept, Authorization',
    });
    const port = Number(process.env.PORT ?? 4000);
    await app.listen(port);
    const url = await app.getUrl();
    logger.log(`Application started successfully on ${url}`);
  } catch (error) {
    logger.error(
      'Application failed to start',
      error instanceof Error ? error.stack : error,
    );
    process.exit(1);
  }
}

bootstrap();
