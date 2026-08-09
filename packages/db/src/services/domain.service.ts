/**
 * @file V1-02: workspace-scoped domain CRUD (AC-02).
 *
 * Every query is scoped by `workspaceId` per SCHEMA rule 3 — no domain
 * operation crosses workspace boundaries.  `DomainService` is persistence-
 * agnostic: it takes a `PrismaClient` parameter and never owns the singleton.
 */
import type { PrismaClient, Domain } from '@prisma/client';

export type DomainErrorCode = 'NOT_FOUND' | 'DUPLICATE_DOMAIN';

/** Typed service error for domain operations. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class DomainService {
  /** List all domains in a workspace, newest first. */
  static async list(
    db: PrismaClient,
    workspaceId: string,
  ): Promise<Domain[]> {
    return db.domain.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new domain in a workspace.
   * Throws `DomainError('DUPLICATE_DOMAIN', …)` if the name is already
   * registered anywhere on the platform (platform-wide uniqueness).
   */
  static async create(
    db: PrismaClient,
    params: { workspaceId: string; domainName: string },
  ): Promise<Domain> {
    const existing = await db.domain.findUnique({
      where: { domainName: params.domainName },
    });
    if (existing) {
      throw new DomainError(
        'DUPLICATE_DOMAIN',
        'Domain is already being monitored',
      );
    }
    return db.domain.create({
      data: {
        workspaceId: params.workspaceId,
        domainName: params.domainName,
      },
    });
  }

  /**
   * Delete a domain, scoped to the workspace.
   * Throws `DomainError('NOT_FOUND', …)` when the id does not exist or
   * does not belong to the given workspace.
   */
  static async remove(
    db: PrismaClient,
    workspaceId: string,
    domainId: string,
  ): Promise<void> {
    const owned = await db.domain.findFirst({
      where: { id: domainId, workspaceId },
    });
    if (!owned) {
      throw new DomainError(
        'NOT_FOUND',
        'Domain not found',
      );
    }
    await db.domain.delete({ where: { id: domainId } });
  }
}
