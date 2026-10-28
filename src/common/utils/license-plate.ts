import { BadRequestException } from '@nestjs/common';
import { CapacityUnit } from '@prisma/client';

/** Mayusculas y sin espacios ni guiones ("ab 123-cd" -> "AB123CD"). undefined si viene vacia. */
export function normalizeLicensePlate(raw?: string | null): string | undefined {
  const plate = raw?.replace(/[\s-]/g, '').toUpperCase();
  if (!plate) return undefined;
  if (!/^[A-Z0-9]{5,8}$/.test(plate)) {
    throw new BadRequestException('La patente no es válida (ej: AB123CD o ABC123)');
  }
  return plate;
}

/** Los matafuegos de 1 kg son de vehiculo: llevan patente en la ficha. */
export function requiresLicensePlate(unit: CapacityUnit, capacity: { toString(): string } | number): boolean {
  return unit === 'KG' && Number(capacity.toString()) === 1;
}
