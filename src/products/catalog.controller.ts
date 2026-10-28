import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, paginated } from '../common/dto/pagination-query.dto';
import { capacityLabel } from '../common/utils/labels';
import { requiresLicensePlate } from '../common/utils/license-plate';
import { PRODUCT_INCLUDE, presentProduct } from './products.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listado unico para el buscador de la venta: matafuegos (tipo + capacidad), productos y kits.
   * `kind`: EXTINGUISHER | PRODUCT | KIT. Solo trae activos.
   */
  @Get('items')
  async items(@Query() q: PaginationQueryDto) {
    const search = q.search?.trim();
    const [products, capacities] = await Promise.all([
      this.prisma.client.product.findMany({
        where: {
          isDeleted: false,
          isActive: true,
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { brand: { name: { contains: search, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.client.extinguisherCapacity.findMany({
        where: {
          isDeleted: false,
          isActive: true,
          type: {
            isDeleted: false,
            isActive: true,
            ...(search
              ? {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
        },
        include: { type: true },
      }),
    ]);

    const rows = [
      ...capacities.map((c) => ({
        kind: 'EXTINGUISHER' as const,
        id: c.id,
        name: capacityLabel(c.type.name, c.capacity, c.type.unit),
        salePrice: c.salePrice,
        rechargePrice: c.rechargePrice,
        requiresLicensePlate: requiresLicensePlate(c.type.unit, c.capacity),
        price: null,
        availableStock: null as number | null,
        brand: null as { id: string; name: string } | null,
        items: [] as ReturnType<typeof presentProduct>['items'],
      })),
      ...products.map((p) => {
        const v = presentProduct(p);
        return {
          kind: p.kind === ProductKind.KIT ? ('KIT' as const) : ('PRODUCT' as const),
          id: p.id,
          name: p.name,
          salePrice: null,
          rechargePrice: null,
          requiresLicensePlate: false,
          price: p.price,
          availableStock: v.availableStock,
          brand: v.brand,
          items: v.items,
        };
      }),
    ].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

    return paginated(rows.slice((q.page - 1) * q.limit, q.page * q.limit), rows.length, q);
  }
}
