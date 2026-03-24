const { PrismaClient } = require('@prisma/client');

// Einzelne Prisma-Instanz für die gesamte App (Singleton)
const prisma = new PrismaClient();

module.exports = prisma;
