# Guía para el Front – FireExtracking

Sistema para administrar un negocio de **venta y recarga de matafuegos** (extintores). Esta guía explica de qué trata la aplicación, qué pantallas necesita y qué endpoints usar. Detalle de tablas: [DISENO_TABLAS.md](DISENO_TABLAS.md). Documentación interactiva: `http://localhost:3000/api/docs` (Swagger).

## 1. De qué trata la aplicación

- Los clientes (casi siempre particulares) llegan al mostrador y piden un matafuego. **No suelen traer envase**: se registra el envase en el momento de la venta.
- En cada venta se **imprime una ficha** por matafuego (tipo y capacidad, N° de extintor, fecha de carga, vencimiento a 1 año, propietario, domicilio).
- Se emite un comprobante interno **Factura X** (por el total). Si el cliente paga en partes, cada pago genera un **Recibo de pago** (monto, acumulado pagado y saldo restante).
- Los comprobantes se guardan en PDF y **el front los envía por email**.
- Cada carga vence a 1 año: unos días antes (configurable) el sistema avisa **qué cliente hay que contactar** para renovar.
- Las recargas también se registran (el cliente deja su envase y se lleva otro; ese canje se resolverá más adelante).

### Roles
| Rol | Puede |
|---|---|
| **Administrador** | Todo: usuarios, catálogo y precios, configuración del negocio, anular ventas, borrar clientes/envases |
| **Vendedor** | Clientes, envases, ventas, pagos, comprobantes y avisos de renovación |

El login devuelve `role` y `permissions` (lista de strings, ej. `sales.create`); usalos para mostrar/ocultar menús. El servidor igualmente responde `403` si no corresponde.

## 2. Convenciones de la API

- **Base URL:** `/api`. Todas las rutas requieren `Authorization: Bearer <accessToken>` salvo `POST /auth/login` y `POST /auth/refresh`.
- **Validación estricta:** si se envía un campo que no existe en el DTO, responde `400`. Enviar solo los campos documentados.
- **Errores:** `{ statusCode, message, error }` (`message` puede ser un array en validaciones). `401` sin sesión → intentar refresh; `403` sin permiso; `404` no encontrado; `409` duplicado.
- **Montos y capacidades** (`Decimal`) llegan como **string** (`"15000.00"`, `"2.50"`): convertir para mostrar. Al enviar, usar número.
- **Fechas:** `date` → `"2026-10-19"` (carga, vencimiento); momentos → ISO 8601 con zona.
- **Paginación** (clientes, envases, ventas, avisos): query `page` (1..), `limit` (1..100, default 20), `search`. Respuesta: `{ data: [], total, page, limit }`.
- **Borrado:** lógico (los registros borrados no aparecen).
- **Moneda/zona horaria:** pesos argentinos, zona `America/Argentina/Salta`.

## 3. Pantallas sugeridas

1. **Login / cambio de contraseña**
2. **Nueva venta** (pantalla principal del vendedor) – ver flujo en sección 4
3. **Ventas** (listado, filtro por cliente/estado de pago, detalle, registrar pago, reimprimir ficha/comprobantes)
4. **Clientes** (búsqueda rápida por nombre/teléfono, alta/edición, ver envases e historial)
5. **Envases/Matafuegos** (búsqueda por N° de extintor)
6. **Vencimientos** (campana con contador + lista de clientes a contactar)
7. **Catálogo y precios** *(admin)*: tipos, capacidades, precio de venta y de recarga
8. **Configuración del negocio** *(admin)*: datos, punto de venta, próximos números, días de aviso
9. **Usuarios y permisos** *(admin)*

## 4. Flujos principales

### 4.1 Nueva venta
1. Buscar cliente: `GET /customers?search=juan perez` (o por teléfono). Si no existe → `POST /customers` (obligatorios: `firstName`, `lastName`, `phone`; opcionales: `address`, `email`, `notes`).
2. Cargar la lista de precios una vez (cachear): `GET /extinguisher-types` → tipos con `capacities[]` (cada capacidad trae `salePrice` y `rechargePrice`). La unidad (`KG` o `LT`) está en el tipo. Mostrar etiqueta tipo "ABC polvo x 5 kg" / "Clase K x 6 lts".
3. Armar ítems. Para cada matafuego elegir `itemType` (`NEW_SALE` o `RECHARGE`) y la capacidad; opcional N° de extintor, marca, fechas. Precio sugerido = `salePrice` (venta) o `rechargePrice` (recarga); editable (`unitPrice`).
   - Si la capacidad no tiene precio cargado y no se envía `unitPrice`, el servidor responde `400`.
   - Recarga de un envase ya registrado → enviar `extinguisherId`.
   - Cosas que no son matafuegos (`itemType: OTHER`) requieren `description` y admiten `quantity`.
4. Opcional: pago inicial (`initialPayment`).
5. `POST /sales` → devuelve la venta completa con `items`, `payments` y `receipts`. Con eso se imprimen la **ficha de cada ítem con envase** y la **Factura X** (y el Recibo si hubo pago).

### 4.2 Pago posterior / parcial
`POST /payments` con `saleId`, `amount` (≤ saldo), `method`. Devuelve `{ payment, receipt }`; el `receipt` es el **Recibo de pago** con `paidToDate` y `balanceAfter`. Estados de la venta: `PENDING` → `PARTIAL` → `PAID`.

### 4.3 Vencimientos
- Mostrar badge con `GET /renewal-reminders/summary` (`NOTIFIED` = clientes a contactar ahora).
- Lista: `GET /renewal-reminders` (por defecto trae `NOTIFIED`; filtrar con `?status=`). Cada aviso trae cliente (nombre, teléfono, email), envase y fecha de vencimiento.
- Después de llamar al cliente: `PATCH /renewal-reminders/:id/contacted` con `notes`. Si no corresponde: `/dismiss`.
- Si el cliente renueva, se registra una venta con ítem `RECHARGE` de ese `extinguisherId` y el aviso pasa solo a `RENEWED`.
- Un job diario (6 am) marca los avisos; `POST /renewal-reminders/check` lo fuerza.

### 4.4 Configuración *(admin)*
`PATCH /business-settings` permite ajustar: nombre/domicilio/teléfono (salen en ficha y comprobantes), `pointOfSale` (default `0001`), `facturaXNextNumber` y `reciboPagoXNextNumber` (próximo número, default 1), `renewalNoticeDays` (días de anticipación, default 3), `tagValidityMonths` (vigencia, default 12).
Formato de número de comprobante: `{pointOfSale}-{number}` → `0001-00000001`.

## 5. Endpoints

`(A)` = solo Administrador.

### Auth
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/login` | `{ userName, password }` | `{ user: { id, userName, firstName, lastName, role, urlPhoto, permissions[] }, accessToken, refreshToken }` |
| POST | `/auth/refresh` | header `Authorization: Bearer <refreshToken>` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | – | `{ success }` |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` (mín. 8) | `{ success }` |

### Clientes
| Método | Ruta | Notas |
|---|---|---|
| GET | `/customers?search&page&limit` | `search` busca por nombre, apellido y teléfono (varias palabras) |
| GET | `/customers/:id` | Incluye sus envases |
| POST | `/customers` | `{ firstName, lastName, phone, address?, email?, notes? }` |
| PATCH | `/customers/:id` | Mismos campos, todos opcionales |
| DELETE | `/customers/:id` (A) | |

### Envases
| Método | Ruta | Notas |
|---|---|---|
| GET | `/extinguishers?search&customerId&page&limit` | `search` = N° de extintor |
| GET | `/extinguishers/:id` | |
| POST | `/extinguishers` | `{ customerId?, capacityId, serialNumber?, manufactureDate?, hydraulicTestDueDate?, brand?, status?, notes? }` |
| PATCH | `/extinguishers/:id` | |
| DELETE | `/extinguishers/:id` (A) | |

`status`: `IN_STOCK`, `SOLD`, `CUSTOMER_OWNED`, `OUT_OF_SERVICE`.

### Catálogo y precios
| Método | Ruta | Notas |
|---|---|---|
| GET | `/extinguisher-types` | Tipos con `capacities[]` y precios (lista completa) |
| POST / PATCH / DELETE | `/extinguisher-types[/:id]` (A) | `{ code, name, unit: KG\|LT, order?, isActive? }` |
| GET | `/extinguisher-capacities?typeId` | |
| POST | `/extinguisher-capacities` (A) | `{ typeId, capacity, salePrice?, rechargePrice?, order?, isActive? }` |
| PATCH | `/extinguisher-capacities/:id` (A) | Se usa también para **cargar/actualizar precios** |
| DELETE | `/extinguisher-capacities/:id` (A) | |

Tipos cargados: ABC polvo, BC polvo, BC anhídrido carbónico (CO2), HCFC, Clase K, Clase A, AFFF.

### Ventas
| Método | Ruta | Notas |
|---|---|---|
| POST | `/sales` | Ver body abajo |
| GET | `/sales?search&customerId&paymentStatus&page&limit` | `search` por datos del cliente; `paymentStatus`: `PENDING\|PARTIAL\|PAID` |
| GET | `/sales/:id` | Venta con cliente, vendedor, ítems (con envase y capacidad), pagos y comprobantes |
| POST | `/sales/:id/cancel` (A) | Anula la venta, anula sus comprobantes y descarta avisos pendientes |

Body de `POST /sales`:
```json
{
  "customerId": "uuid",
  "notes": "opcional",
  "items": [
    {
      "itemType": "NEW_SALE",          // NEW_SALE | RECHARGE | OTHER
      "capacityId": "uuid",            // tipo + capacidad (o extinguisherId para un envase existente)
      "serialNumber": "1872854",       // opcional
      "manufactureDate": "2024-05-01", // opcional
      "hydraulicTestDueDate": "2029-05-01", // opcional
      "brand": "opcional",
      "unitPrice": 15000,              // opcional; si falta usa el precio de la capacidad
      "description": "solo para OTHER",
      "quantity": 1                    // solo OTHER; los matafuegos son 1 por ítem
    }
  ],
  "initialPayment": { "amount": 5000, "method": "CASH", "reference": "opcional", "notes": "opcional", "paidAt": "opcional ISO" }
}
```
Cada ítem de matafuego devuelve `chargeDate` (hoy), `expirationDate` (+12 meses), `tagOwnerName`, `tagAddress`, y su `extinguisher` (con `serialNumber`, fechas de fabricación/prueba hidráulica) y `capacity.type` (tipo y unidad) → datos de la **ficha**.

### Pagos
| Método | Ruta | Notas |
|---|---|---|
| POST | `/payments` | `{ saleId, amount, method, paidAt?, reference?, notes? }` → `{ payment, receipt }` |
| GET | `/payments/sale/:saleId` | Pagos de una venta, con su recibo |

`method`: `CASH`, `TRANSFER`, `DEBIT_CARD`, `CREDIT_CARD`, `OTHER`.

### Comprobantes
| Método | Ruta | Notas |
|---|---|---|
| GET | `/receipts?saleId` | |
| GET | `/receipts/:id` | Con cliente, pago y venta/ítems |

Campos: `type` (`FACTURA_X` \| `RECIBO_PAGO_X`), `pointOfSale`, `number`, `issuedAt`, `totalAmount`, `paidToDate`/`balanceAfter` (solo recibos), `status` (`ISSUED` \| `VOID`). Título sugerido en pantalla: "Factura X" y "Recibo de pago".

### Vencimientos
| Método | Ruta | Notas |
|---|---|---|
| GET | `/renewal-reminders?status&page&limit` | Default `NOTIFIED`. Estados: `PENDING`, `NOTIFIED`, `CONTACTED`, `RENEWED`, `DISMISSED` |
| GET | `/renewal-reminders/grouped?status&page&limit` | **Una fila por cliente + fecha de vencimiento** (paginado por grupos). Cada grupo: `customerId`, `dueDate`, `customer`, `count`, `reminderIds[]`, `reminders[]` (cada uno con `extinguisher.label` y `serialNumber`) |
| GET | `/renewal-reminders/summary/grouped` | Mismos contadores por estado pero en **grupos** (clientes a contactar) |
| PATCH | `/renewal-reminders/bulk-contacted` | `{ ids: [], notes? }` marca varios como contactados → `{ updated }` |
| PATCH | `/renewal-reminders/bulk-dismiss` | `{ ids: [], notes? }` → `{ updated }` |
| GET | `/renewal-reminders/summary` | `{ PENDING, NOTIFIED, CONTACTED, RENEWED, DISMISSED }` (contadores) |
| POST | `/renewal-reminders/check` | Fuerza el chequeo diario |
| PATCH | `/renewal-reminders/:id/contacted` | `{ notes? }` |
| PATCH | `/renewal-reminders/:id/dismiss` | `{ notes? }` |

### Configuración
| Método | Ruta | Notas |
|---|---|---|
| GET | `/business-settings` | Datos del negocio (encabezado de ficha y comprobantes) |
| PATCH | `/business-settings` (A) | `{ businessName?, address?, phone?, email?, logoUrl?, pointOfSale?, facturaXNextNumber?, reciboPagoXNextNumber?, renewalNoticeDays?, tagValidityMonths? }` |

### Usuarios, roles y permisos (A)
| Método | Ruta | Notas |
|---|---|---|
| GET / GET :id | `/users` | |
| POST | `/users` | `{ userName, password (mín. 8), firstName, lastName, roleId, urlPhoto? }` |
| PATCH | `/users/:id` | Sin password |
| PATCH | `/users/:id/password` | `{ newPassword }` (cierra sus sesiones) |
| DELETE | `/users/:id` | |
| GET | `/roles` | Para el selector de rol |
| GET | `/roles/:id/permissions` | |
| PUT | `/roles/:id/permissions` | `{ permissionIds: [] }` reemplaza el conjunto |
| GET | `/permissions` | |

## 6. Sesión (tokens)

- `accessToken` dura ~15 min, `refreshToken` ~7 días (configurables en el servidor).
- Ante un `401`, llamar `POST /auth/refresh` enviando el **refreshToken** como Bearer; guardar el nuevo par y reintentar. Si falla, volver al login.

## 7. Pendiente en el backend (impacta al front)

- **PDF:** aún no existen endpoints que generen el PDF de la ficha y de los comprobantes. Hasta entonces el front puede armar la ficha/comprobante con los datos que devuelve `GET /sales/:id` e imprimir desde el navegador; cuando se agregue el PDF en el servidor (`GET /sales/:id/items/:itemId/tag.pdf`, `GET /receipts/:id/pdf`, a definir), el front solo cambia la fuente.
- **Canje de envase en recargas:** a definir más adelante.
