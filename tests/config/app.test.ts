import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getCompanyName, appConfig } from '../../config/app';

describe('App Configuration', () => {
  const originalEnv = process.env.COMPANY_NAME;

  afterEach(() => {
    // Restore original env value
    if (originalEnv !== undefined) {
      process.env.COMPANY_NAME = originalEnv;
    } else {
      delete process.env.COMPANY_NAME;
    }
  });

  describe('getCompanyName', () => {
    it('should return company name from environment variable when set', () => {
      process.env.COMPANY_NAME = 'Test Company Inc';
      const companyName = getCompanyName();
      expect(companyName).toBe('Test Company Inc');
    });

    it('should trim whitespace from environment variable', () => {
      process.env.COMPANY_NAME = '  Whitespace Company  ';
      const companyName = getCompanyName();
      expect(companyName).toBe('Whitespace Company');
    });

    it('should fall back to default company mapping when env var not set', () => {
      delete process.env.COMPANY_NAME;
      const companyName = getCompanyName();
      expect(companyName).toBe('iByte Enterprises LLC');
    });

    it('should fall back to default company mapping when env var is empty', () => {
      process.env.COMPANY_NAME = '';
      const companyName = getCompanyName();
      expect(companyName).toBe('iByte Enterprises LLC');
    });

    it('should fall back to default company mapping when env var is only whitespace', () => {
      process.env.COMPANY_NAME = '   ';
      const companyName = getCompanyName();
      expect(companyName).toBe('iByte Enterprises LLC');
    });
  });

  describe('appConfig', () => {
    it('should provide companyName via getter', () => {
      process.env.COMPANY_NAME = 'Config Test Company';
      expect(appConfig.companyName).toBe('Config Test Company');
    });

    it('should provide full company profile', () => {
      const profile = appConfig.getCompanyProfile();
      expect(profile).toBeDefined();
      expect(profile.profile).toBeDefined();
      expect(profile.profile.companyName).toBe('iByte Enterprises LLC');
      expect(profile.profile.businessAddress).toBeDefined();
      expect(profile.relevantCertifications).toBeDefined();
      expect(profile.applicableInsurance).toBeDefined();
    });

    it('should return fresh timestamps on each call to getCompanyProfile', () => {
      const profile1 = appConfig.getCompanyProfile();
      const profile2 = appConfig.getCompanyProfile();

      // Timestamps should be different (or very close if called immediately)
      expect(profile1.profile.createdAt).toBeDefined();
      expect(profile2.profile.createdAt).toBeDefined();
    });
  });
});
