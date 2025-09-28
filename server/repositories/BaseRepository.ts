import { db } from '../db';
import { PgTableWithColumns, PgColumn } from 'drizzle-orm/pg-core';
import { eq, sql, and, or, gte, lte, desc, asc, count } from 'drizzle-orm';

/**
 * Base repository providing common CRUD operations
 * All entity repositories extend this class for consistent functionality
 */
export abstract class BaseRepository<
  TTable extends PgTableWithColumns<any>,
  TSelect = TTable['$inferSelect'],
  TInsert = TTable['$inferInsert'],
> {
  protected constructor(
    protected table: TTable,
    protected primaryKey: PgColumn = table.id as PgColumn
  ) {}

  /**
   * Find entity by ID
   */
  async findById(id: string | number): Promise<TSelect | undefined> {
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq(this.primaryKey, id));
    return result || undefined;
  }

  /**
   * Find all entities
   */
  async findAll(options?: FindAllOptions): Promise<TSelect[]> {
    let query = db.select().from(this.table);

    if (options?.orderBy) {
      const column = this.table[options.orderBy as keyof TTable] as PgColumn;
      query = query.orderBy(
        options.direction === 'desc' ? desc(column) : asc(column)
      ) as any;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }

    return await query;
  }

  /**
   * Find entities with count for pagination
   */
  async findWithCount(
    options?: FindAllOptions
  ): Promise<{ data: TSelect[]; total: number }> {
    const [data, [{ total }]] = await Promise.all([
      this.findAll(options),
      db.select({ total: count() }).from(this.table),
    ]);

    return { data, total: Number(total) };
  }

  /**
   * Create new entity
   */
  async create(data: TInsert): Promise<TSelect> {
    const [result] = await db.insert(this.table).values(data).returning();
    return result;
  }

  /**
   * Create multiple entities
   */
  async createMany(data: TInsert[]): Promise<TSelect[]> {
    return await db.insert(this.table).values(data).returning();
  }

  /**
   * Update entity by ID
   */
  async update(
    id: string | number,
    updates: Partial<TInsert>
  ): Promise<TSelect | undefined> {
    const [result] = await db
      .update(this.table)
      .set(updates)
      .where(eq(this.primaryKey, id))
      .returning();
    return result || undefined;
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string | number): Promise<boolean> {
    const result = await db.delete(this.table).where(eq(this.primaryKey, id));
    return result.rowCount > 0;
  }

  /**
   * Soft delete entity by ID (if table has deletedAt column)
   */
  async softDelete(id: string | number): Promise<TSelect | undefined> {
    const deletedAtColumn = (this.table as any).deletedAt;
    if (!deletedAtColumn) {
      throw new Error(
        'Table does not support soft delete (missing deletedAt column)'
      );
    }

    const [result] = await db
      .update(this.table)
      .set({ [deletedAtColumn.name]: new Date() } as any)
      .where(eq(this.primaryKey, id))
      .returning();
    return result || undefined;
  }

  /**
   * Check if entity exists
   */
  async exists(id: string | number): Promise<boolean> {
    const [result] = await db
      .select({ id: this.primaryKey })
      .from(this.table)
      .where(eq(this.primaryKey, id))
      .limit(1);
    return !!result;
  }

  /**
   * Count total entities
   */
  async count(conditions?: any): Promise<number> {
    let query = db.select({ count: count() }).from(this.table);

    if (conditions) {
      query = query.where(conditions) as any;
    }

    const [{ count: total }] = await query;
    return Number(total);
  }

  /**
   * Find entities by column value
   */
  async findBy(column: keyof TTable, value: any): Promise<TSelect[]> {
    const tableColumn = this.table[column] as PgColumn;
    return await db.select().from(this.table).where(eq(tableColumn, value));
  }

  /**
   * Find single entity by column value
   */
  async findOneBy(
    column: keyof TTable,
    value: any
  ): Promise<TSelect | undefined> {
    const tableColumn = this.table[column] as PgColumn;
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq(tableColumn, value))
      .limit(1);
    return result || undefined;
  }

  /**
   * Execute raw SQL query
   */
  protected async executeRaw<T = any>(
    query: string,
    params?: any[]
  ): Promise<T[]> {
    return await db.execute(sql.raw(query, params));
  }

  /**
   * Begin transaction
   */
  async transaction<T>(callback: (tx: typeof db) => Promise<T>): Promise<T> {
    return await db.transaction(callback);
  }
}

/**
 * Options for findAll operations
 */
export interface FindAllOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  direction?: 'asc' | 'desc';
}

/**
 * Common filter interface
 */
export interface BaseFilter {
  limit?: number;
  offset?: number;
  orderBy?: string;
  direction?: 'asc' | 'desc';
}

/**
 * Repository result interface
 */
export interface RepositoryResult<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

/**
 * Create paginated result
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number = 1,
  pageSize: number = 10
): RepositoryResult<T> {
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    total,
    page,
    pageSize,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}
