import { CustomerType } from '@prisma/client';

export interface NameFields {
  customerType: CustomerType;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}

/** Datos basicos del cliente para anidar en otras respuestas (`select`). */
export const CUSTOMER_NAME_SELECT = {
  id: true,
  displayName: true,
  customerType: true,
  cuit: true,
  phone: true,
} as const;

/** Valor que se guarda en customers.display_name. Razon social para empresas; "Nombre Apellido" para personas. */
export function customerDisplayName(c: NameFields): string {
  if (c.customerType === CustomerType.COMPANY) {
    return c.businessName ?? [c.firstName, c.lastName].filter(Boolean).join(' ');
  }
  return [c.firstName, c.lastName].filter(Boolean).join(' ');
}

/** Deja solo los digitos de un CUIT ("20-12345678-6" -> "20123456786"). */
export function normalizeCuit(value: string): string {
  return value.replace(/\D/g, '');
}

/** Valida largo y digito verificador (modulo 11). */
export function isValidCuit(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(cuit[i]), 0);
  const mod = 11 - (sum % 11);
  const check = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return check === Number(cuit[10]);
}
