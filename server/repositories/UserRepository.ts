import { BaseRepository } from './BaseRepository';
import { users, type User, type InsertUser } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
    return await this.findOneBy('username', username);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | undefined> {
    return await this.findOneBy('email', email);
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    return !user;
  }

  /**
   * Check if email is available
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return !user;
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
    return await this.findBy('isActive', true);
  }

  /**
   * Search users by name or username
   */
  async searchUsers(query: string): Promise<User[]> {
    return await this.executeRaw(
      `
      SELECT * FROM users
      WHERE (
        username ILIKE $1
        OR email ILIKE $1
        OR (first_name || ' ' || last_name) ILIKE $1
      )
      AND is_active = true
      ORDER BY username
      LIMIT 50
      `,
      [`%${query}%`]
    );
  }
}
