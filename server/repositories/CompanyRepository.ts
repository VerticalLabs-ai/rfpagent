import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  companyProfiles,
  companyAddresses,
  companyContacts,
  companyIdentifiers,
  companyCertifications,
  companyInsurance,
  type CompanyProfile,
  type CompanyAddress,
  type CompanyContact,
  type CompanyIdentifier,
  type CompanyCertification,
  type CompanyInsurance,
  type InsertCompanyProfile,
  type InsertCompanyAddress,
  type InsertCompanyContact,
  type InsertCompanyIdentifier,
  type InsertCompanyCertification,
  type InsertCompanyInsurance,
} from '@shared/schema';
import { BaseRepository } from './BaseRepository';

/**
 * Repository for managing company profiles and related entities
 * Handles company profiles, addresses, contacts, identifiers, certifications, and insurance
 */
export class CompanyRepository extends BaseRepository<typeof companyProfiles> {
  constructor() {
    super(companyProfiles);
  }

  // Company Profiles

  /**
   * Get a company profile by ID
   */
  async getCompanyProfile(id: string): Promise<CompanyProfile | undefined> {
    const [profile] = await db
      .select()
      .from(companyProfiles)
      .where(
        and(eq(companyProfiles.id, id), eq(companyProfiles.isActive, true))
      );
    return profile || undefined;
  }

  /**
   * Get company profile with all related entities
   */
  async getCompanyProfileWithDetails(id: string): Promise<any> {
    const profile = await this.getCompanyProfile(id);
    if (!profile) return null;

    const [addresses, contacts, identifiers, certifications, insurance] =
      await Promise.all([
        this.getCompanyAddresses(id),
        this.getCompanyContacts(id),
        this.getCompanyIdentifiers(id),
        this.getCompanyCertifications(id),
        this.getCompanyInsurance(id),
      ]);

    return {
      ...profile,
      addresses,
      contacts,
      identifiers,
      certifications,
      insurance,
    };
  }

  /**
   * Create a new company profile
   */
  async createCompanyProfile(
    profile: InsertCompanyProfile
  ): Promise<CompanyProfile> {
    const [newProfile] = await db
      .insert(companyProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  /**
   * Update a company profile
   */
  async updateCompanyProfile(
    id: string,
    updates: Partial<CompanyProfile>
  ): Promise<CompanyProfile> {
    const [updatedProfile] = await db
      .update(companyProfiles)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(companyProfiles.id, id))
      .returning();
    return updatedProfile;
  }

  /**
   * Soft delete a company profile
   */
  async deleteCompanyProfile(id: string): Promise<void> {
    await db
      .update(companyProfiles)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(companyProfiles.id, id));
  }

  // Company Addresses

  /**
   * Get all addresses for a company profile
   */
  async getCompanyAddresses(
    companyProfileId: string
  ): Promise<CompanyAddress[]> {
    return await db
      .select()
      .from(companyAddresses)
      .where(
        and(
          eq(companyAddresses.companyProfileId, companyProfileId),
          eq(companyAddresses.isActive, true)
        )
      )
      .orderBy(asc(companyAddresses.addressType));
  }

  /**
   * Create a new company address
   */
  async createCompanyAddress(
    address: InsertCompanyAddress
  ): Promise<CompanyAddress> {
    const [newAddress] = await db
      .insert(companyAddresses)
      .values(address)
      .returning();
    return newAddress;
  }

  /**
   * Update a company address
   */
  async updateCompanyAddress(
    id: string,
    updates: Partial<CompanyAddress>
  ): Promise<CompanyAddress> {
    const [updatedAddress] = await db
      .update(companyAddresses)
      .set(updates)
      .where(eq(companyAddresses.id, id))
      .returning();
    return updatedAddress;
  }

  /**
   * Soft delete a company address
   */
  async deleteCompanyAddress(id: string): Promise<void> {
    await db
      .update(companyAddresses)
      .set({ isActive: false })
      .where(eq(companyAddresses.id, id));
  }

  // Company Contacts

  /**
   * Get all contacts for a company profile
   */
  async getCompanyContacts(
    companyProfileId: string
  ): Promise<CompanyContact[]> {
    return await db
      .select()
      .from(companyContacts)
      .where(
        and(
          eq(companyContacts.companyProfileId, companyProfileId),
          eq(companyContacts.isActive, true)
        )
      )
      .orderBy(asc(companyContacts.name));
  }

  /**
   * Create a new company contact
   */
  async createCompanyContact(
    contact: InsertCompanyContact
  ): Promise<CompanyContact> {
    const [newContact] = await db
      .insert(companyContacts)
      .values(contact)
      .returning();
    return newContact;
  }

  /**
   * Update a company contact
   */
  async updateCompanyContact(
    id: string,
    updates: Partial<CompanyContact>
  ): Promise<CompanyContact> {
    const [updatedContact] = await db
      .update(companyContacts)
      .set(updates)
      .where(eq(companyContacts.id, id))
      .returning();
    return updatedContact;
  }

  /**
   * Soft delete a company contact
   */
  async deleteCompanyContact(id: string): Promise<void> {
    await db
      .update(companyContacts)
      .set({ isActive: false })
      .where(eq(companyContacts.id, id));
  }

  // Company Identifiers

  /**
   * Get all identifiers for a company profile
   */
  async getCompanyIdentifiers(
    companyProfileId: string
  ): Promise<CompanyIdentifier[]> {
    return await db
      .select()
      .from(companyIdentifiers)
      .where(
        and(
          eq(companyIdentifiers.companyProfileId, companyProfileId),
          eq(companyIdentifiers.isActive, true)
        )
      )
      .orderBy(asc(companyIdentifiers.identifierType));
  }

  /**
   * Create a new company identifier
   */
  async createCompanyIdentifier(
    identifier: InsertCompanyIdentifier
  ): Promise<CompanyIdentifier> {
    const [newIdentifier] = await db
      .insert(companyIdentifiers)
      .values(identifier)
      .returning();
    return newIdentifier;
  }

  /**
   * Update a company identifier
   */
  async updateCompanyIdentifier(
    id: string,
    updates: Partial<CompanyIdentifier>
  ): Promise<CompanyIdentifier> {
    const [updatedIdentifier] = await db
      .update(companyIdentifiers)
      .set(updates)
      .where(eq(companyIdentifiers.id, id))
      .returning();
    return updatedIdentifier;
  }

  /**
   * Soft delete a company identifier
   */
  async deleteCompanyIdentifier(id: string): Promise<void> {
    await db
      .update(companyIdentifiers)
      .set({ isActive: false })
      .where(eq(companyIdentifiers.id, id));
  }

  // Company Certifications

  /**
   * Get all certifications for a company profile
   */
  async getCompanyCertifications(
    companyProfileId: string
  ): Promise<CompanyCertification[]> {
    return await db
      .select()
      .from(companyCertifications)
      .where(eq(companyCertifications.companyProfileId, companyProfileId))
      .orderBy(asc(companyCertifications.certificationType));
  }

  /**
   * Get certifications expiring within a number of days
   */
  async getExpiringCertifications(
    days: number
  ): Promise<CompanyCertification[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await db
      .select()
      .from(companyCertifications)
      .where(
        and(
          eq(companyCertifications.status, 'active'),
          gte(companyCertifications.expirationDate, new Date()),
          lte(companyCertifications.expirationDate, futureDate)
        )
      )
      .orderBy(asc(companyCertifications.expirationDate));
  }

  /**
   * Create a new company certification
   */
  async createCompanyCertification(
    certification: InsertCompanyCertification
  ): Promise<CompanyCertification> {
    const [newCertification] = await db
      .insert(companyCertifications)
      .values(certification)
      .returning();
    return newCertification;
  }

  /**
   * Update a company certification
   */
  async updateCompanyCertification(
    id: string,
    updates: Partial<CompanyCertification>
  ): Promise<CompanyCertification> {
    const [updatedCertification] = await db
      .update(companyCertifications)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(companyCertifications.id, id))
      .returning();
    return updatedCertification;
  }

  /**
   * Delete a company certification
   */
  async deleteCompanyCertification(id: string): Promise<void> {
    await db
      .delete(companyCertifications)
      .where(eq(companyCertifications.id, id));
  }

  // Company Insurance

  /**
   * Get all insurance policies for a company profile
   */
  async getCompanyInsurance(
    companyProfileId: string
  ): Promise<CompanyInsurance[]> {
    return await db
      .select()
      .from(companyInsurance)
      .where(
        and(
          eq(companyInsurance.companyProfileId, companyProfileId),
          eq(companyInsurance.isActive, true)
        )
      )
      .orderBy(asc(companyInsurance.insuranceType));
  }

  /**
   * Get insurance policies expiring within a number of days
   */
  async getExpiringInsurance(days: number): Promise<CompanyInsurance[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await db
      .select()
      .from(companyInsurance)
      .where(
        and(
          eq(companyInsurance.isActive, true),
          gte(companyInsurance.expirationDate, new Date()),
          lte(companyInsurance.expirationDate, futureDate)
        )
      )
      .orderBy(asc(companyInsurance.expirationDate));
  }

  /**
   * Create a new company insurance policy
   */
  async createCompanyInsurance(
    insurance: InsertCompanyInsurance
  ): Promise<CompanyInsurance> {
    const [newInsurance] = await db
      .insert(companyInsurance)
      .values(insurance)
      .returning();
    return newInsurance;
  }

  /**
   * Update a company insurance policy
   */
  async updateCompanyInsurance(
    id: string,
    updates: Partial<CompanyInsurance>
  ): Promise<CompanyInsurance> {
    const [updatedInsurance] = await db
      .update(companyInsurance)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(companyInsurance.id, id))
      .returning();
    return updatedInsurance;
  }

  /**
   * Soft delete a company insurance policy
   */
  async deleteCompanyInsurance(id: string): Promise<void> {
    await db
      .update(companyInsurance)
      .set({ isActive: false })
      .where(eq(companyInsurance.id, id));
  }
}

export const companyRepository = new CompanyRepository();
