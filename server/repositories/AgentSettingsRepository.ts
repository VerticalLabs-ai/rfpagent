import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import {
  companyAgentSettings,
  type CompanyAgentSettings,
  type InsertCompanyAgentSettings,
} from '@shared/schema';

/**
 * Repository for managing company-specific agent settings
 * Allows customization of agent behavior (prompts, priority, enabled/disabled) per company profile
 */
export class AgentSettingsRepository {
  /**
   * Get all agent settings for a company
   */
  async getSettingsForCompany(
    companyProfileId: string
  ): Promise<CompanyAgentSettings[]> {
    return db
      .select()
      .from(companyAgentSettings)
      .where(eq(companyAgentSettings.companyProfileId, companyProfileId));
  }

  /**
   * Get settings for a specific agent and company
   */
  async getSettingsByAgentAndCompany(
    companyProfileId: string,
    agentId: string
  ): Promise<CompanyAgentSettings | undefined> {
    const results = await db
      .select()
      .from(companyAgentSettings)
      .where(
        and(
          eq(companyAgentSettings.companyProfileId, companyProfileId),
          eq(companyAgentSettings.agentId, agentId)
        )
      );
    return results[0];
  }

  /**
   * Create new agent settings
   */
  async createSettings(
    data: InsertCompanyAgentSettings
  ): Promise<CompanyAgentSettings> {
    const [result] = await db
      .insert(companyAgentSettings)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Update existing agent settings
   */
  async updateSettings(
    id: string,
    data: Partial<InsertCompanyAgentSettings>
  ): Promise<CompanyAgentSettings> {
    const [result] = await db
      .update(companyAgentSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companyAgentSettings.id, id))
      .returning();
    return result;
  }

  /**
   * Upsert agent settings (create or update)
   */
  async upsertSettings(
    companyProfileId: string,
    agentId: string,
    data: Partial<InsertCompanyAgentSettings>
  ): Promise<CompanyAgentSettings> {
    const existing = await this.getSettingsByAgentAndCompany(
      companyProfileId,
      agentId
    );

    if (existing) {
      return this.updateSettings(existing.id, data);
    }

    return this.createSettings({
      companyProfileId,
      agentId,
      ...data,
    });
  }

  /**
   * Delete agent settings (reset to defaults)
   */
  async deleteSettings(id: string): Promise<void> {
    await db.delete(companyAgentSettings).where(eq(companyAgentSettings.id, id));
  }

  /**
   * Get all enabled agents for a company
   */
  async getEnabledAgentsForCompany(
    companyProfileId: string
  ): Promise<CompanyAgentSettings[]> {
    return db
      .select()
      .from(companyAgentSettings)
      .where(
        and(
          eq(companyAgentSettings.companyProfileId, companyProfileId),
          eq(companyAgentSettings.isEnabled, true)
        )
      );
  }

  /**
   * Get agent priority for a company (returns default 5 if not set)
   */
  async getAgentPriorityForCompany(
    companyProfileId: string,
    agentId: string
  ): Promise<number> {
    const settings = await this.getSettingsByAgentAndCompany(
      companyProfileId,
      agentId
    );
    return settings?.priority ?? 5; // Default priority
  }
}

// Export singleton instance
export const agentSettingsRepository = new AgentSettingsRepository();
