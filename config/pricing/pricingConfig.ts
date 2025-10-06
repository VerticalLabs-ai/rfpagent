import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// Schema for rate configuration
const rateEntrySchema = z.object({
  unitRate: z.number().positive(),
  unit: z.string().min(1),
});

const pricingConfigSchema = z.object({
  historicalRates: z.record(z.string(), rateEntrySchema),
  stateTaxRates: z.record(z.string(), z.number().min(0).max(100)),
});

export type RateEntry = z.infer<typeof rateEntrySchema>;
export type PricingConfig = z.infer<typeof pricingConfigSchema>;

class PricingConfigLoader {
  private static instance: PricingConfigLoader;
  private config: PricingConfig | null = null;

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): PricingConfigLoader {
    if (!PricingConfigLoader.instance) {
      PricingConfigLoader.instance = new PricingConfigLoader();
    }
    return PricingConfigLoader.instance;
  }

  private loadConfig(): void {
    try {
      const configPath = join(__dirname, 'rates.json');
      const rawData = readFileSync(configPath, 'utf-8');
      const parsedData = JSON.parse(rawData);

      // Validate the configuration
      this.config = pricingConfigSchema.parse(parsedData);

      // Ensure required fields exist
      if (!this.config.historicalRates.default) {
        throw new Error('Missing required "default" entry in historicalRates');
      }
      if (!this.config.stateTaxRates.default) {
        throw new Error('Missing required "default" entry in stateTaxRates');
      }

      console.log('✅ Pricing configuration loaded and validated successfully');
    } catch (error) {
      console.error('❌ Failed to load pricing configuration:', error);
      throw new Error(
        `Failed to load pricing configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public getHistoricalRate(category: string): RateEntry {
    if (!this.config) {
      throw new Error('Pricing configuration not loaded');
    }

    return (
      this.config.historicalRates[category] ||
      this.config.historicalRates.default
    );
  }

  public getStateTaxRate(stateCode: string): number {
    if (!this.config) {
      throw new Error('Pricing configuration not loaded');
    }

    return (
      this.config.stateTaxRates[stateCode] ||
      this.config.stateTaxRates.default
    );
  }

  public getAllHistoricalRates(): Record<string, RateEntry> {
    if (!this.config) {
      throw new Error('Pricing configuration not loaded');
    }

    return this.config.historicalRates;
  }

  public getAllStateTaxRates(): Record<string, number> {
    if (!this.config) {
      throw new Error('Pricing configuration not loaded');
    }

    return this.config.stateTaxRates;
  }

  /**
   * Reload configuration from disk (useful for testing or hot-reload scenarios)
   */
  public reload(): void {
    this.loadConfig();
  }
}

export const pricingConfigLoader = PricingConfigLoader.getInstance();
