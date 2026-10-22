import { CapacityUnit, Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ROLES = [
  { name: 'Administrador', description: 'Configura todo el sistema' },
  { name: 'Vendedor', description: 'Registra ventas y atiende clientes' },
];

// [name, description, roles que lo tienen]
const A = 'Administrador';
const V = 'Vendedor';
const PERMISSIONS: [string, string, string[]][] = [
  ['customers.read', 'Ver clientes', [A, V]],
  ['customers.write', 'Crear y editar clientes', [A, V]],
  ['extinguishers.read', 'Ver matafuegos', [A, V]],
  ['extinguishers.write', 'Crear y editar matafuegos', [A]],
  ['sales.read', 'Ver ventas', [A, V]],
  ['sales.create', 'Registrar ventas', [A, V]],
  ['sales.cancel', 'Anular ventas', [A]],
  ['payments.read', 'Ver pagos', [A, V]],
  ['payments.create', 'Registrar pagos', [A, V]],
  ['receipts.read', 'Ver comprobantes', [A, V]],
  ['reminders.read', 'Ver avisos de vencimiento', [A, V]],
  ['reminders.manage', 'Gestionar avisos de vencimiento', [A, V]],
  ['catalog.read', 'Ver tipos, capacidades y precios', [A, V]],
  ['catalog.manage', 'Administrar tipos, capacidades y precios', [A]],
  ['settings.read', 'Ver configuración del negocio', [A, V]],
  ['settings.manage', 'Modificar configuración del negocio', [A]],
  ['users.manage', 'Administrar usuarios, roles y permisos', [A]],
];

// code, name, unit, capacidades
const TYPES: [string, string, CapacityUnit, number[]][] = [
  ['ABC', 'ABC polvo', 'KG', [1, 2.5, 5, 10, 25, 50, 100]],
  ['BC', 'BC polvo', 'KG', [1, 2.5, 5, 10, 25, 50, 100]],
  ['BC_CO2', 'BC anhídrido carbónico (CO2)', 'KG', [2, 3, 3.5, 5, 7, 10, 20, 45]],
  ['HCFC', 'HCFC', 'KG', [2.5, 5, 10]],
  ['K', 'Clase K', 'LT', [6]],
  ['A', 'Clase A', 'LT', [10, 25, 50, 100]],
  ['AFFF', 'AFFF', 'LT', [10, 25, 50, 100]],
];

async function main() {
  const roleIds: Record<string, string> = {};
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    roleIds[r.name] = role.id;
  }

  const permissionIds: Record<string, string> = {};
  for (const [i, [name, description, roles]] of PERMISSIONS.entries()) {
    const perm = await prisma.permission.upsert({
      where: { name },
      update: { description, order: i + 1 },
      create: { name, description, order: i + 1 },
    });
    for (const roleName of roles) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleIds[roleName], permissionId: perm.id } },
        update: {},
        create: { roleId: roleIds[roleName], permissionId: perm.id },
      });
    }
    permissionIds[name] = perm.id;
  }

  // Sincroniza: quita de cada rol los permisos que ya no le corresponden.
  for (const roleName of Object.keys(roleIds)) {
    const allowed = PERMISSIONS.filter(([, , roles]) => roles.includes(roleName)).map(
      ([name]) => permissionIds[name],
    );
    await prisma.rolePermission.deleteMany({
      where: { roleId: roleIds[roleName], permissionId: { notIn: allowed } },
    });
  }

  const adminUser = process.env.SEED_ADMIN_USER ?? 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('Definí SEED_ADMIN_PASSWORD en el .env');
  const existing = await prisma.user.findUnique({ where: { userName: adminUser } });
  if (!existing) {
    await prisma.user.create({
      data: {
        userName: adminUser,
        password: await argon2.hash(adminPassword),
        firstName: 'Administrador',
        lastName: 'Sistema',
        roleId: roleIds['Administrador'],
      },
    });
  }

  for (const [i, [code, name, unit, caps]] of TYPES.entries()) {
    const type = await prisma.extinguisherType.upsert({
      where: { code },
      update: {},
      create: { code, name, unit, order: i + 1 },
    });
    for (const [j, c] of caps.entries()) {
      await prisma.extinguisherCapacity.upsert({
        where: { typeId_capacity: { typeId: type.id, capacity: new Prisma.Decimal(c) } },
        update: {},
        create: { typeId: type.id, capacity: c, order: j + 1 },
      });
    }
  }

  if (!(await prisma.businessSettings.findFirst())) {
    await prisma.businessSettings.create({
      data: {
        businessName: 'Matafuegos B.N.',
        address: 'Av. Ennio Pontussi 1713 B° Solidaridad 3ra Etapa - Salta',
        phone: '3874791291',
        pointOfSale: '0001',
        facturaXNextNumber: 1,
        reciboPagoXNextNumber: 1,
        renewalNoticeDays: 3,
        tagValidityMonths: 12,
      },
    });
  }

  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
