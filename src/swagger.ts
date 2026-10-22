import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Swagger UI en /api/docs (mismo setup que maintain-api, con assets por CDN). */
export function setupSwagger(app: INestApplication) {
  // El nombre del esquema debe coincidir con @ApiBearerAuth() de los
  // controllers (nombre por defecto "bearer"). Si no coincide, Swagger UI
  // guarda el token pero NO lo adjunta a las peticiones.
  const config = new DocumentBuilder()
    .setTitle('FireExtracking API')
    .setDescription('Sistema de gestión de venta de matafuegos')
    .setVersion('1.0')
    .addServer('/')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.min.js',
    ],
  });
}
