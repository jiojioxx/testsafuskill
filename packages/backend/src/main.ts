import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  // Global BigInt serialization fix
  const originalStringify = JSON.stringify;
  JSON.stringify = function(value, replacer, space) {
    return originalStringify.call(this, value, function(key, val) {
      if (typeof val === 'bigint') {
        return Number(val);
      }
      return replacer ? replacer(key, val) : val;
    }, space);
  };

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // 开发环境：启用 CORS
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:5173',
      credentials: true,
    });
  }

  // 生产环境：服务前端静态文件
  if (process.env.NODE_ENV === 'production') {
    const frontendPath = join(__dirname, '..', '..', 'frontend', 'dist');
    
    // 静态资源服务
    app.useStaticAssets(frontendPath, {
      prefix: '/',
      index: false, // 不自动返回 index.html
    });

    // 所有非 API 路由返回 index.html（支持前端路由）
    app.use((req, res, next) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(join(frontendPath, 'index.html'));
      } else {
        next();
      }
    });

    console.log(`Serving frontend from: ${frontendPath}`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
