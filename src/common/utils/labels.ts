import { CapacityUnit } from '@prisma/client';

export function capacityLabel(
  typeName: string,
  capacity: { toString(): string } | number,
  unit: CapacityUnit,
): string {
  return `${typeName} x ${Number(capacity.toString())} ${unit === 'KG' ? 'kg' : 'lts'}`;
}
