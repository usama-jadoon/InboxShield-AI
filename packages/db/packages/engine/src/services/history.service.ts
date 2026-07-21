import { PrismaClient } from '@prisma/client';
import { ReportModel } from '../report/types';

export class HistoryService {
  /**
   * Persists a verified immutable snapshot into the database mapped to the domain.
   */
  static async saveSnapshot(db: PrismaClient, reportModel: ReportModel, workspaceId: string): Promise<string> {
    const domainName = reportModel.metadata.domain;

    // Validate domain hierarchy mapping
    let domain = await db.domain.findUnique({ where: { domainName }});

    if (!domain) {
      domain = await db.domain.create({
        data: { domainName, workspaceId }
      });
    }

    // Persist immutable artifact
    const snapshot = await db.scanReport.create({
      data: {
        domainId: domain.id,
        score: reportModel.executiveSummary.score,
        riskLevel: reportModel.executiveSummary.riskLevel,
        reportModel: reportModel as unknown as object // Persisted entirely unmutated as raw JSON logic
      }
    });

    return snapshot.id;
  }

  /**
   * Universal fetch for UI tracking. Allows UI sorting by metadata without deserializing payloads.
   */
  static async getHistory(db: PrismaClient, params: { workspaceId: string, limit?: number, domainFilter?: string, riskFilter?: string }) {
    const { workspaceId, limit = 50, domainFilter, riskFilter } = params;

    const whereClause: Record<string, unknown> = {
      domain: { workspaceId }
    };

    if (domainFilter) {
       (whereClause.domain as Record<string,unknown>).domainName = { contains: domainFilter, mode: 'insensitive' };
    }

    if (riskFilter) {
       whereClause.riskLevel = riskFilter;
    }

    const records = await db.scanReport.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
         id: true,
         score: true,
         riskLevel: true,
         createdAt: true,
         domain: { select: { domainName: true } }
      }
    });

    return records.map((r: Record<string, any>) => ({
      id: r.id,
      domain: r.domain.domainName,
      score: r.score,
      riskLevel: r.riskLevel,
      createdAt: r.createdAt.toISOString()
    }));
  }

  /**
   * Re-hydrates a saved JSON model instantly perfectly bypassing expensive recomputation
   */
  static async getSnapshot(db: PrismaClient, reportId: string, workspaceId: string): Promise<ReportModel | null> {
    const record = await db.scanReport.findUnique({
      where: { id: reportId },
      include: { domain: true }
    });

    if (!record || record.domain.workspaceId !== workspaceId) return null;

    return record.reportModel as unknown as ReportModel;
  }
}
