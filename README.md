# FireExtracking API

API NestJS + Prisma + PostgreSQL para administrar un negocio de venta y recarga de matafuegos.
El diseño de tablas está en [DISENO_TABLAS.md](DISENO_TABLAS.md).

## Puesta en marcha

1. `npm install`
2. Copiar `.env.example` a `.env` y completar `DATABASE_URL`, los secretos JWT y `SEED_ADMIN_PASSWORD`.
3. `npx prisma migrate dev --name init` (crea las tablas)
4. `npm run db:seed` (roles, permisos, usuario administrador, tipos/capacidades de matafuegos y configuración del negocio)
5. `npm run start:dev`

Swagger: `http://localhost:3000/api/docs`

## Roles

- **Administrador**: configura todo (usuarios, catálogo y precios, configuración, anula ventas).
- **Vendedor**: clientes, matafuegos, ventas, pagos y avisos.

## Flujo principal

- `POST /api/sales`: registra la venta (crea envases si hace falta), fija carga y vencimiento (+12 meses), crea el aviso de renovación, emite la **Factura X** y, si se envía `initialPayment`, registra el pago con su **Recibo de pago**.
- `POST /api/payments`: pagos posteriores (parciales o totales) sobre el saldo; cada uno emite un Recibo de pago.
- `GET /api/renewal-reminders`: clientes a contactar (el job diario marca los avisos `NOTIFIED` según `renewalNoticeDays`).
- `PATCH /api/business-settings`: datos del negocio, punto de venta, próximos números de comprobante y días de aviso.
