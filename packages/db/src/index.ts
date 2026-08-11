import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { PrismaClient };

// V1-02: workspace-scoped domain CRUD
export { DomainService, DomainError } from './services/domain.service';
export type { DomainErrorCode } from './services/domain.service';
export { WorkspaceService } from './services/workspace.service';

// V1-03: scan persistence
export { ScanService, ScanError } from './services/scan.service';
export type { ScanErrorCode } from './services/scan.service';

// V1-05: dashboard aggregate stats
export { DashboardService } from './services/dashboard.service';
export type { DomainSummary, WorkspaceStats } from './services/dashboard.service';
