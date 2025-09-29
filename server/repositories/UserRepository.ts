import { BaseRepository } from './BaseRepository';
import { users, type User, type InsertUser } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';

/**
 * User repository for user-specific database operations
 */
export class UserRepository extends BaseRepository<
  typeof users,
  User,
  InsertUser
> {
  constructor() {
    super(users);
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return user ?? undefined;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user ?? undefined;
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const existing = await this.findByUsername(username);
    return !existing;
  }

  /**
   * Check if email is available
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    const existing = await this.findByEmail(email);
    return !existing;
  }

  /**
   * Update user's last login
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.update(id, {
      lastLoginAt: new Date(),
    });
  }

  /**
   * Activate user account
   */
  async activateUser(id: string): Promise<User | undefined> {
    return await this.update(id, {
      isActive: true,
      activatedAt: new Date(),
    });
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(id: string): Promise<User | undefined> {
    return await this.update(id, {
      isActive: false,
    });
  }

  /**
   * Get active users
   */
  async getActiveUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.isActive, true));
  }

  /**
   * Search users by name or username
   */
  async searchUsers(query: string): Promise<User[]> {
    const pattern = `%${query}%`;
    return await this.executeRaw<User>(sql`
      SELECT * FROM users
      WHERE (
        username ILIKE ${pattern}
        OR email ILIKE ${pattern}
        OR (first_name || ' ' || last_name) ILIKE ${pattern}
      )
      AND is_active = true
      ORDER BY username
      LIMIT 50
    `);
  }
}
