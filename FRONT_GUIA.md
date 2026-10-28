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
4. **Clientes** (búsqueda rápida por nombre/razón social/CUIT/teléfono, alta persona o empresa, alta/edición, ver envases e historial)
5. **Envases/Matafuegos** (búsqueda por N° de serie o por cliente)
6. **Vencimientos** (campana con contador + lista de clientes a contactar)
7. **Catálogo y precios** *(admin)*: tipos, capacidades, precio de venta y de recarga
8. **Productos y kits** *(admin)*: alta con stock, armado de kits, ajuste de stock e historial; **Marcas** *(admin edita; el vendedor puede crear)*
9. **Configuración del negocio** *(admin)*: datos, punto de venta, próximos números, días de aviso
10. **Usuarios y permisos** *(admin)*

## 4. Flujos principales

### 4.0 Clientes: persona o empresa
- Al crear un cliente hay un selector **Persona / Empresa** (por defecto Persona) → campo `customerType`: `PERSON` o `COMPANY`.
- **Persona** (persona humana): obligatorios `firstName`, `lastName`, `phone`. `cuit` opcional.
- **Empresa** (persona jurídica): obligatorios `businessName` (razón social), `cuit`, `phone`. **No lleva nombre ni apellido**: si se envían `firstName`/`lastName`, la API los ignora y los guarda en `null`.
- **CUIT**: se puede enviar con o sin guiones (`30-12345678-1` o `30123456781`); la API lo guarda solo con 11 dígitos y valida el dígito verificador. Si es inválido responde `400`; si ya existe otro cliente con ese CUIT responde `409`.
- Mostrar el cliente siempre con **`displayName`** (lo guarda y mantiene la API): razón social si es empresa, "Nombre Apellido" si es persona. Está en clientes, ventas, comprobantes, envases y avisos. No armar el nombre en el front con `firstName`/`lastName` (en empresas pueden venir `null`).
- En el formulario: si es Empresa mostrar solo razón social + CUIT (requeridos), sin nombre ni apellido; si es Persona mostrar nombre y apellido y ocultar razón social. Al editar, cambiar de Empresa a Persona borra la razón social y exige nombre y apellido; cambiar de Persona a Empresa borra nombre y apellido.
- Listado: `?search=` busca por **`displayName`** (nombre y apellido o razón social; varias palabras en cualquier orden), **teléfono** y **CUIT** (con o sin guiones); `?customerType=PERSON|COMPANY` filtra por tipo. Orden: alfabético por `displayName`, mezclando personas y empresas.
- La ficha usa `displayName` como propietario (`tagOwnerName`).
- Errores de validación: `400` con `message` como arreglo de textos (ej. "La razón social es obligatoria para empresas").

### 4.1 Nueva venta
1. Buscar cliente: `GET /customers?search=juan perez` (o por teléfono). Si no existe → `POST /customers` (ver 4.0 y la tabla de Clientes: selector Persona / Empresa).
2. Cargar la lista de precios una vez (cachear): `GET /extinguisher-types` → tipos con `capacities[]` (cada capacidad trae `salePrice` y `rechargePrice`). La unidad (`KG` o `LT`) está en el tipo. Mostrar etiqueta tipo "ABC polvo x 5 kg" / "Clase K x 6 lts".
3. Armar ítems. Para cada matafuego elegir `itemType` (`NEW_SALE` o `RECHARGE`) y la capacidad; **N° de serie obligatorio** (`serialNumber`), **marca obligatoria** (`brandId`, de `GET /brands`) al registrar un matafuego nuevo, y fechas opcionales. Precio sugerido = `salePrice` (venta) o `rechargePrice` (recarga); editable (`unitPrice`).
   - Si la capacidad no tiene precio cargado y no se envía `unitPrice`, el servidor responde `400`.
   - Recarga de un envase ya registrado → enviar `extinguisherId`. Para elegirlo: `GET /customers/:id/extinguishers` con el cliente ya seleccionado (ver Clientes). Si el envase ya tiene N° de serie no hace falta enviarlo; si no lo tiene, es obligatorio.
   - El **N° de serie es obligatorio solo en matafuegos** (`NEW_SALE` y `RECHARGE`); sin él responde `400` ("El N° de serie es obligatorio para los matafuegos"). En `OTHER` no se pide.
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
- **No depende de ningún job**: la API calcula el estado con la fecha de aviso (`notifyFrom`). `NOTIFIED` ("a contactar") = aviso abierto (`PENDING` o `NOTIFIED`) con `notifyFrom` <= hoy, incluidos los ya vencidos; `PENDING` = programado, con `notifyFrom` en el futuro. Los avisos devuelven siempre el estado calculado, así que un aviso que ya corresponde contactar viene como `NOTIFIED` aunque en la base siga `PENDING`. `POST /renewal-reminders/check` ya no es necesario.

### 4.4 Configuración *(admin)*
`PATCH /business-settings` permite ajustar: nombre/domicilio/teléfono (salen en ficha y comprobantes), `pointOfSale` (default `0001`), `facturaXNextNumber` y `reciboPagoXNextNumber` (próximo número, default 1), `renewalNoticeDays` (días de anticipación, default 3; **al guardarlo con este campo se recalculan todos los avisos abiertos**: `notifyFrom = vencimiento − días`, los que todavía no llegaron a esa fecha vuelven a `PENDING` y los `CONTACTED`/`RENEWED`/`DISMISSED` no se tocan), `tagValidityMonths` (vigencia, default 12).
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
| GET | `/customers?search&customerType&page&limit` | `search` busca por displayName (nombre, apellido o razón social), teléfono y CUIT (varias palabras); `customerType`: `PERSON\|COMPANY` |
| GET | `/customers/:id` | Incluye sus envases |
| POST | `/customers` | `{ customerType? (default PERSON), firstName?, lastName?, businessName?, cuit?, phone, address?, email?, notes? }`. PERSON requiere `firstName`+`lastName`; COMPANY requiere `businessName`+`cuit`. Responde el cliente con `displayName` |
| PATCH | `/customers/:id` | Mismos campos, todos opcionales (las reglas por tipo se validan sobre el resultado final). Para vaciar un texto opcional (dirección, notas) enviar `""` |
| GET | `/customers/:id/extinguishers` | **Todos** los matafuegos del cliente, sin paginar (para recargas). Cada uno trae `label` ("ABC polvo x 5 kg"), `serialNumber`, `brand`, `licensePlate`, `requiresLicensePlate`, `capacity.type`, `status` y `lastDueDate` (último vencimiento) |
| DELETE | `/customers/:id` (A) | |

### Envases
| Método | Ruta | Notas |
|---|---|---|
| GET | `/extinguishers?search&customerId&page&limit` | `search` busca por **N° de serie** o por **cliente** (nombre y apellido o razón social, varias palabras); `customerId` filtra por dueño. Se pueden combinar |
| GET | `/extinguishers/:id` | |
| POST | `/extinguishers` | `{ customerId?, capacityId, serialNumber?, manufactureDate?, hydraulicTestDueDate?, brandId (obligatoria), licensePlate?, status?, notes? }`. En `PATCH` la marca sigue siendo opcional (hay envases viejos sin marca) (la marca viene como `brand: { id, name }` en las respuestas) |
| PATCH | `/extinguishers/:id` | |
| DELETE | `/extinguishers/:id` (A) | |

`status`: `IN_STOCK`, `SOLD`, `CUSTOMER_OWNED`, `OUT_OF_SERVICE`.

### Marcas
| Método | Ruta | Notas |
|---|---|---|
| GET | `/brands?search&page&limit` | Ordenadas por nombre; `search` filtra por nombre (autocompletar) |
| GET | `/brands/:id` | |
| POST | `/brands` | `{ name }`. Lo puede usar cualquier usuario (p. ej. cargar una marca faltante durante una venta). `409` si ya existe |
| PATCH | `/brands/:id` (A) | `{ name }` |
| DELETE | `/brands/:id` (A) | Baja lógica: los matafuegos que ya la tenían la siguen mostrando |

> Cambio: el campo de texto `brand` de matafuegos y de los ítems de venta pasó a **`brandId`** (id de una marca). Las marcas que ya estaban cargadas como texto se migraron al catálogo.

### Productos y kits
Los matafuegos NO son productos: siguen siendo **tipo + capacidad** (Catálogo y precios). Los productos y kits son otra lista.

| Método | Ruta | Notas |
|---|---|---|
| GET | `/products?search&kind&brandId&activeOnly&page&limit` | `search` por nombre o marca; `kind`: `PRODUCT\|KIT`; `activeOnly=true` solo activos |
| GET | `/products/:id` | |
| POST | `/products` (A) | Ver body abajo |
| PATCH | `/products/:id` (A) | `{ name?, price?, brandId?, isActive?, items? }`. No cambia el tipo ni el stock. En un kit, `items` **reemplaza** todos los componentes |
| DELETE | `/products/:id` (A) | Baja lógica. `409` si el producto está en algún kit |
| POST | `/products/:id/stock` (A) | `{ delta, notes? }`: suma (`delta` > 0) o resta (< 0) stock. `400` si quedaría negativo |
| GET | `/products/:id/stock-movements?page&limit` (A) | Historial de stock |
| GET | `/catalog/items?search&page&limit` | **Listado único para el buscador de la venta**: matafuegos, productos y kits juntos (ver abajo) |

Body de `POST /products`:
```json
// Producto: name, price y stock obligatorios; brandId opcional
{ "name": "Guantes", "price": 3500, "stock": 40, "brandId": "uuid" }

// Kit: name y price (precio fijo del kit) + items (al menos 1). No lleva stock.
{
  "kind": "KIT",
  "name": "Kit básico",
  "price": 50000,
  "items": [
    { "capacityId": "uuid", "quantity": 1 },   // un matafuego (tipo + capacidad)
    { "productId": "uuid", "quantity": 2 }     // un producto
  ]
}
```
- Cada componente lleva `productId` **o** `capacityId` (uno solo). Un kit no puede incluir otros kits ni repetir un componente.
- Las respuestas traen `brand: { id, name }`, `availableStock` y, en kits, `items[]` con `quantity`, `product` o `capacity { id, label }`.
- `availableStock`: en un producto es su `stock`; en un kit es **cuántos kits se pueden armar** con el componente más escaso (`null` si el kit solo tiene matafuegos, que no manejan stock).

`GET /catalog/items` devuelve filas con `kind`:
| `kind` | Qué es | Campos de precio | Se vende con `itemType` |
|---|---|---|---|
| `EXTINGUISHER` | Tipo + capacidad (`name` = "ABC polvo x 5 kg") | `salePrice`, `rechargePrice` | `NEW_SALE` o `RECHARGE` (`capacityId` = `id`) |
| `PRODUCT` | Producto suelto | `price`, `availableStock` | `PRODUCT` (`productId` = `id`) |
| `KIT` | Kit (con `items[]`) | `price`, `availableStock` | `KIT` (`productId` = `id`) |

Solo trae activos, ordenados por nombre y paginados.

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
| GET | `/sales/:id` | Venta con cliente, vendedor, ítems (con envase y capacidad), pagos y comprobantes. Los componentes de un kit traen `parentItemId` |
| POST | `/sales/:id/cancel` (A) | Anula la venta, anula sus comprobantes, descarta avisos pendientes y **repone el stock** de los productos |

Body de `POST /sales`:
```json
{
  "customerId": "uuid",
  "notes": "opcional",
  "items": [
    {
      "itemType": "NEW_SALE",          // NEW_SALE | RECHARGE | PRODUCT | KIT | OTHER
      "capacityId": "uuid",            // tipo + capacidad (o extinguisherId para un envase existente)
      "serialNumber": "1872854",       // OBLIGATORIO en NEW_SALE/RECHARGE (salvo que el envase existente ya lo tenga); no se pide en OTHER
      "manufactureDate": "2024-05-01", // opcional
      "hydraulicTestDueDate": "2029-05-01", // opcional
      "brandId": "uuid",               // OBLIGATORIA al registrar un matafuego nuevo (con capacityId); no se pide con extinguisherId. De GET /brands
      "licensePlate": "AB123CD",       // OBLIGATORIA si el matafuego es de 1 kg (ver abajo)
      "unitPrice": 15000,              // opcional; si falta usa el precio de la capacidad
      "description": "solo para OTHER",
      "quantity": 1                    // OTHER, PRODUCT y KIT (cantidad); los matafuegos son 1 por ítem
    },
    { "itemType": "PRODUCT", "productId": "uuid", "quantity": 2 },   // unitPrice opcional (default: price del producto)
    {
      "itemType": "KIT", "productId": "uuid", "quantity": 1,          // unitPrice opcional (default: price del kit)
      "extinguishers": [                                              // un objeto por CADA matafuego que incluye el kit
        { "capacityId": "uuid", "serialNumber": "1872854", "brandId": "uuid", "licensePlate": "AB123CD", "manufactureDate": "2024-05-01" }
      ]
    }
  ],
  "initialPayment": { "amount": 5000, "method": "CASH", "reference": "opcional", "notes": "opcional", "paidAt": "opcional ISO" }
}
```
Cada ítem de matafuego devuelve `chargeDate` (hoy), `expirationDate` (+12 meses), `tagOwnerName`, `tagAddress`, y su `extinguisher` (con `serialNumber`, fechas de fabricación/prueba hidráulica) y `capacity.type` (tipo y unidad) → datos de la **ficha**.

#### Patente en matafuegos de 1 kg
- Los matafuegos de **1 kg** (unidad `KG`, capacidad 1) son de vehículo: la **patente** se imprime en la ficha. Es **obligatoria** al vender o recargar uno (`NEW_SALE` / `RECHARGE`, y también dentro de un kit en `extinguishers[].licensePlate`). Sin patente responde `400` ("La patente es obligatoria para los matafuegos de 1 kg").
- Se envía en `licensePlate`. La API la normaliza (mayúsculas, sin espacios ni guiones: "ab 123-cd" → "AB123CD") y valida que tenga entre 5 y 8 letras/números (cubre `ABC123`, `AB123CD`, motos, etc.); si no, `400` ("La patente no es válida").
- Para saber cuándo mostrar el campo: `requiresLicensePlate` (boolean) viene en `GET /catalog/items` (filas `EXTINGUISHER`), en `GET /customers/:id/extinguishers` y en `items[].capacity` de los kits. También se puede deducir: unidad `KG` y capacidad `1`.
- **Recargas:** si el envase ya tiene patente (`extinguisher.licensePlate`), precargarla en el formulario y permitir cambiarla; si no se envía, la API reutiliza la guardada. Si se envía una distinta, queda la nueva como última patente del envase.
- En otros tamaños la patente es opcional: si se envía, se guarda igual.
- La ficha imprime **`tagLicensePlate`** (patente de esa venta, igual que `tagOwnerName` y `tagAddress`). Cada línea de la venta la trae.

#### Productos y kits en la venta
- **`PRODUCT`**: requiere `productId` y `quantity`. Descuenta stock; si no alcanza responde `400` ("Stock insuficiente de "Guantes" (disponible: 3, pedido: 5)"). Conviene validar contra `availableStock` en el front, pero la API lo vuelve a verificar.
- **`KIT`**: requiere `productId`. Cada objeto de `extinguishers[]` lleva `serialNumber` y `brandId` obligatorios. Se cobra **una línea con el precio fijo del kit** (× `quantity`). Si el kit incluye matafuegos, `extinguishers[]` debe traer **un objeto por cada unidad** (cantidad del componente × cantidad de kits), con `capacityId` y **`serialNumber` obligatorio**. Si faltan o sobran responde `400` con el detalle ("El kit "Kit básico" incluye 1 ABC polvo x 5 kg: cargá el N° de serie de cada uno").
- La respuesta de `GET /sales/:id` trae, además de la línea `KIT`, **una línea hija por cada componente** con `parentItemId` = id de la línea del kit y `unitPrice`/`subtotal` en 0. El total suma solo la línea del kit.
- Para imprimir: agrupar las líneas hijas bajo su kit (`parentItemId`); no sumarlas. Cada matafuego hijo tiene su propia **ficha** (con `expirationDate`) y su aviso de vencimiento, igual que uno vendido suelto.
- Para decidir qué formulario mostrar al agregar un ítem usar el `kind` de `GET /catalog/items` (tabla de arriba).

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
