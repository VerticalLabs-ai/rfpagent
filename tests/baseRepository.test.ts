import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { pgTable, text } from 'drizzle-orm/pg-core';

import { users } from '@shared/schema';

type BaseRepositoryModule = typeof import('../server/repositories/BaseRepository');

describe('BaseRepository', () => {
  let BaseRepository: BaseRepositoryModule['BaseRepository'];

  beforeAll(async () => {
    const mockQueryBuilder = () => ({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    });

    const dbMock: any = {
      select: jest.fn(mockQueryBuilder),
      insert: jest.fn(() => ({ values: jest.fn(() => ({ returning: jest.fn().mockResolvedValue([]) })) })),
      update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ returning: jest.fn().mockResolvedValue([]) })) })) })),
      delete: jest.fn(() => ({ where: jest.fn(() => ({ rowCount: 0 })) })),
      execute: jest.fn().mockResolvedValue([]),
      transaction: jest.fn(async callback => callback(dbMock)),
    };

    await jest.unstable_mockModule('../server/db', () => ({
      __esModule: true,
      db: dbMock,
    }));

    ({ BaseRepository } = await import('../server/repositories/BaseRepository'));
  });

  it('infers the primary key from drizzle metadata when available', () => {
    class TestRepository extends BaseRepository<typeof users> {
      constructor() {
        super(users);
      }

      getPrimaryKeyColumn() {
        return this.primaryKey;
      }
    }

    const repo = new TestRepository();
    expect(repo.getPrimaryKeyColumn()).toBe(users.id);
  });

  it('resolves table columns by name using drizzle column metadata', () => {
    class TestRepository extends BaseRepository<typeof users> {
      constructor() {
        super(users);
      }

      resolve(column: string) {
        return this.resolveColumn(column);
      }
    }

    const repo = new TestRepository();
    expect(repo.resolve('email')).toBe(users.email);
  });

  it('throws a descriptive error when the column does not exist', () => {
    class TestRepository extends BaseRepository<typeof users> {
      constructor() {
        super(users);
      }

      resolve(column: string) {
        return this.resolveColumn(column);
      }
    }

    const repo = new TestRepository();
    expect(() => repo.resolve('missingColumn')).toThrow(
      'Column "missingColumn" does not exist on table "users"'
    );
  });

  it('requires an explicit primary key when the table has no id column', () => {
    const tableWithoutId = pgTable('tmp_without_id', {
      name: text('name').notNull(),
    });

    class RepoWithExplicitPrimaryKey extends BaseRepository<typeof tableWithoutId> {
      constructor() {
        super(tableWithoutId, tableWithoutId.name);
      }
    }

    expect(() => new RepoWithExplicitPrimaryKey()).not.toThrow();

    class RepoWithoutPrimaryKey extends BaseRepository<typeof tableWithoutId> {
      constructor() {
        super(tableWithoutId);
      }
    }

    expect(() => new RepoWithoutPrimaryKey()).toThrow(
      'BaseRepository requires a primary key column. Provide one explicitly when the table does not expose an "id" column.'
    );
  });
});
