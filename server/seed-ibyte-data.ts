#!/usr/bin/env tsx

import { db } from './db.js';
import {
  companyProfiles,
  companyAddresses,
  companyContacts,
  companyIdentifiers,
  companyCertifications,
} from '../shared/schema.js';

/**
 * Seed iByte Enterprises LLC data into the database
 * Based on the JSON data provided by the user
 */
async function seedIByteData() {
  console.log('🌱 Starting iByte Enterprises LLC data seeding...');

  try {
    // 1. Create the main company profile
    console.log('📊 Creating company profile...');
    const [companyProfile] = await db
      .insert(companyProfiles)
      .values({
        companyName: 'IBYTE Enterprises, LLC',
        dba: null, // No DBA in the JSON
        website: 'https://www.ibyteent.com',
        primaryBusinessCategory:
          '(02) Building Construction, including General Contractors and Operative Builders',
        naicsPrimary: '541611',
        nigpCodes: '914-00; 914-57',
        employeesCount: '2',
        registrationState: 'Texas',
        county: 'Travis',
        isActive: true,
      })
      .returning();

    console.log(`✅ Company profile created with ID: ${companyProfile.id}`);

    // 2. Create addresses
    console.log('🏠 Creating company addresses...');
    const addresses = [
      {
        companyProfileId: companyProfile.id,
        addressType: 'primary_mailing',
        addressLine1: '1801 E 51st St. Ste 365-359',
        addressLine2: null,
        city: 'Austin',
        state: 'TX',
        zipCode: '78723',
        country: 'US',
        isActive: true,
      },
      {
        companyProfileId: companyProfile.id,
        addressType: 'physical',
        addressLine1: '5406 Waterbrook Dr',
        addressLine2: null,
        city: 'Austin',
        state: 'TX',
        zipCode: '78723',
        country: 'US',
        isActive: true,
      },
      {
        companyProfileId: companyProfile.id,
        addressType: 'former',
        addressLine1: '1315 Andrews St',
        addressLine2: null,
        city: 'San Juan',
        state: 'TX',
        zipCode: '78589',
        country: 'US',
        isActive: false,
      },
    ];

    await db.insert(companyAddresses).values(addresses);
    console.log(`✅ Created ${addresses.length} addresses`);

    // 3. Create contacts and decision makers
    console.log('👤 Creating contacts and decision makers...');
    const contacts = [
      {
        companyProfileId: companyProfile.id,
        contactType: 'owner',
        name: 'Valorie A. Rodriguez',
        role: 'CEO',
        email: 'vrodriguez@ibyteent.com',
        officePhone: '512-800-3890',
        mobilePhone: '737-600-5105',
        fax: '956-461-1033',
        decisionAreas: [
          'financial_contracts',
          'bids_proposals',
          'hiring_firing',
          'operations',
        ],
        ownershipPercent: '100',
        gender: 'Female',
        ethnicity: 'Hispanic American',
        citizenship: 'US',
        hoursPerWeek: '40',
        isActive: true,
      },
    ];

    await db.insert(companyContacts).values(contacts);
    console.log(`✅ Created ${contacts.length} contacts`);

    // 4. Create company identifiers
    console.log('🆔 Creating company identifiers...');
    const identifiers = [
      {
        companyProfileId: companyProfile.id,
        identifierType: 'duns',
        identifierValue: '132971889',
        issuingEntity: 'Dun & Bradstreet',
        description: 'DUNS Number',
        isActive: true,
      },
      {
        companyProfileId: companyProfile.id,
        identifierType: 'sam_uei',
        identifierValue: 'LF25E13Q29E6',
        issuingEntity: 'SAM.gov',
        description: 'SAM Unique Entity Identifier',
        isActive: true,
      },
      {
        companyProfileId: companyProfile.id,
        identifierType: 'ein',
        identifierValue: '994146395',
        issuingEntity: 'IRS',
        description: 'Employer Identification Number',
        isActive: true,
      },
      {
        companyProfileId: companyProfile.id,
        identifierType: 'tax_id',
        identifierValue: '3-20960-4238-0',
        issuingEntity: 'Texas',
        description: 'Texas Tax ID',
        isActive: true,
      },
      {
        companyProfileId: companyProfile.id,
        identifierType: 'vendor_id',
        identifierValue: 'V00000997058',
        issuingEntity: 'City of Austin',
        description: 'City of Austin Vendor ID',
        isActive: true,
      },
    ];

    await db.insert(companyIdentifiers).values(identifiers);
    console.log(`✅ Created ${identifiers.length} identifiers`);

    // 5. Create certifications with proper dates
    console.log('📜 Creating company certifications...');
    const certifications = [
      {
        companyProfileId: companyProfile.id,
        certificationType: 'hub',
        certificationNumber: null,
        certificationDate: null,
        expirationDate: null,
        recertificationDate: null,
        status: 'pending',
        applicationNumber: '3622417',
        applicationStarted: new Date('2024-11-09'),
        submittedDate: new Date('2024-11-14'),
        issuingEntity: 'Texas HUB Program',
        notes: 'Submitted, Pending Receipt',
        autoRenewal: false,
        alertDaysBefore: 30,
      },
      {
        companyProfileId: companyProfile.id,
        certificationType: 'dbe',
        certificationNumber: null,
        certificationDate: new Date('2025-03-04'),
        expirationDate: new Date('2026-03-04'),
        recertificationDate: null,
        status: 'active',
        applicationNumber: null,
        applicationStarted: null,
        submittedDate: null,
        issuingEntity: 'DBE Certification Authority',
        notes: 'Next review due 2026-03-04',
        autoRenewal: false,
        alertDaysBefore: 60,
      },
      {
        companyProfileId: companyProfile.id,
        certificationType: 'mbe',
        certificationNumber: null,
        certificationDate: new Date('2025-03-04'),
        expirationDate: new Date('2029-03-31'),
        recertificationDate: null,
        status: 'active',
        applicationNumber: null,
        applicationStarted: null,
        submittedDate: null,
        issuingEntity: 'MBE Certification Authority',
        notes: 'Recertification due by 2029-03-31',
        autoRenewal: false,
        alertDaysBefore: 90,
      },
      {
        companyProfileId: companyProfile.id,
        certificationType: 'wbe',
        certificationNumber: null,
        certificationDate: new Date('2025-03-04'),
        expirationDate: new Date('2029-03-31'),
        recertificationDate: null,
        status: 'active',
        applicationNumber: null,
        applicationStarted: null,
        submittedDate: null,
        issuingEntity: 'WBE Certification Authority',
        notes: 'Recertification due by 2029-03-31',
        autoRenewal: false,
        alertDaysBefore: 90,
      },
      {
        companyProfileId: companyProfile.id,
        certificationType: 'wbenc',
        certificationNumber: 'WBE2403586',
        certificationDate: new Date('2024-10-31'),
        expirationDate: new Date('2025-10-31'),
        recertificationDate: null,
        status: 'active',
        applicationNumber: null,
        applicationStarted: null,
        submittedDate: null,
        issuingEntity: 'WBENC',
        notes: "Women's Business Enterprise National Council certification",
        autoRenewal: false,
        alertDaysBefore: 45,
      },
      {
        companyProfileId: companyProfile.id,
        certificationType: 'small_business',
        certificationNumber: null,
        certificationDate: null,
        expirationDate: null,
        recertificationDate: null,
        status: 'active',
        applicationNumber: null,
        applicationStarted: null,
        submittedDate: null,
        issuingEntity: 'SBA',
        notes: 'Small Business certification',
        autoRenewal: false,
        alertDaysBefore: 30,
      },
      {
        companyProfileId: companyProfile.id,
        certificationType: 'woman_owned',
        certificationNumber: null,
        certificationDate: null,
        expirationDate: null,
        recertificationDate: null,
        status: 'active',
        applicationNumber: null,
        applicationStarted: null,
        submittedDate: null,
        issuingEntity: 'SBA',
        notes: 'Woman Owned Small Business',
        autoRenewal: false,
        alertDaysBefore: 30,
      },
    ];

    await db.insert(companyCertifications).values(certifications);
    console.log(`✅ Created ${certifications.length} certifications`);

    console.log(
      '\n🎉 iByte Enterprises LLC data seeding completed successfully!'
    );
    console.log(`
📋 Summary:
• Company Profile: IBYTE Enterprises, LLC
• Owner: Valorie A. Rodriguez (CEO, 100% ownership)
• Addresses: 3 (Primary Mailing, Physical, Former)
• Identifiers: 5 (DUNS, SAM UEI, EIN, Texas Tax ID, Austin Vendor ID)
• Certifications: 7 (HUB, DBE, MBE, WBE, WBENC, Small Business, Woman Owned)
• Primary Business: Building Construction (NAICS: 541611)
• Location: Austin, TX (Travis County)
    `);

    return companyProfile.id;
  } catch (error) {
    console.error('❌ Error seeding iByte data:', error);
    throw error;
  }
}

// Run the seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIByteData()
    .then(companyId => {
      console.log(`✅ Seeding complete. Company ID: ${companyId}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedIByteData };
