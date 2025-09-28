import { Router } from 'express';
import { ZodError } from 'zod';
import {
  insertCompanyProfileSchema,
  insertCompanyAddressSchema,
  insertCompanyContactSchema,
  insertCompanyIdentifierSchema,
  insertCompanyCertificationSchema,
  insertCompanyInsuranceSchema,
} from '@shared/schema';
import { storage } from '../storage';

const router = Router();

// ============ COMPANY PROFILES ============

/**
 * Get all company profiles
 */
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await storage.getAllCompanyProfiles();
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching company profiles:', error);
    res.status(500).json({ error: 'Failed to fetch company profiles' });
  }
});

/**
 * Get a specific company profile
 */
router.get('/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await storage.getCompanyProfile(id);
    if (!profile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching company profile:', error);
    res.status(500).json({ error: 'Failed to fetch company profile' });
  }
});

/**
 * Get detailed company profile with all related data
 */
router.get('/profiles/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await storage.getCompanyProfileWithDetails(id);
    if (!profile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching company profile details:', error);
    res.status(500).json({ error: 'Failed to fetch company profile details' });
  }
});

/**
 * Create a new company profile
 */
router.post('/profiles', async (req, res) => {
  try {
    console.log('POST /api/company/profiles - Request body:', req.body);
    const profileData = insertCompanyProfileSchema.parse(req.body);
    console.log('Parsed profile data:', profileData);
    const profile = await storage.createCompanyProfile(profileData);
    console.log('Created profile:', profile);
    res.status(201).json(profile);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Validation error creating company profile:', error.errors);
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error creating company profile:', error);
    res.status(500).json({ error: 'Failed to create company profile' });
  }
});

/**
 * Update a company profile
 */
router.put('/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Validate updates using partial schema
    const updateSchema = insertCompanyProfileSchema.partial();
    const updates = updateSchema.parse(req.body);
    const profile = await storage.updateCompanyProfile(id, updates);
    if (!profile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }
    res.json(profile);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error updating company profile:', error);
    res.status(500).json({ error: 'Failed to update company profile' });
  }
});

/**
 * Delete a company profile
 */
router.delete('/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await storage.getCompanyProfile(id);
    if (!profile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }
    await storage.deleteCompanyProfile(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting company profile:', error);
    res.status(500).json({ error: 'Failed to delete company profile' });
  }
});

// ============ COMPANY ADDRESSES ============

/**
 * Get addresses for a company profile
 */
router.get('/profiles/:companyProfileId/addresses', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const addresses = await storage.getCompanyAddresses(companyProfileId);
    res.json(addresses);
  } catch (error) {
    console.error('Error fetching company addresses:', error);
    res.status(500).json({ error: 'Failed to fetch company addresses' });
  }
});

/**
 * Create a new address for a company profile
 */
router.post('/profiles/:companyProfileId/addresses', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const addressData = insertCompanyAddressSchema.parse({
      ...req.body,
      companyProfileId,
    });
    const address = await storage.createCompanyAddress(addressData);
    res.status(201).json(address);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error creating company address:', error);
    res.status(500).json({ error: 'Failed to create company address' });
  }
});

/**
 * Update a company address
 */
router.put('/addresses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateSchema = insertCompanyAddressSchema.partial();
    const updates = updateSchema.parse(req.body);
    const address = await storage.updateCompanyAddress(id, updates);
    if (!address) {
      return res.status(404).json({ error: 'Company address not found' });
    }
    res.json(address);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error updating company address:', error);
    res.status(500).json({ error: 'Failed to update company address' });
  }
});

/**
 * Delete a company address
 */
router.delete('/addresses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteCompanyAddress(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting company address:', error);
    res.status(500).json({ error: 'Failed to delete company address' });
  }
});

// ============ COMPANY CONTACTS ============

/**
 * Get contacts for a company profile
 */
router.get('/profiles/:companyProfileId/contacts', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const contacts = await storage.getCompanyContacts(companyProfileId);
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching company contacts:', error);
    res.status(500).json({ error: 'Failed to fetch company contacts' });
  }
});

/**
 * Create a new contact for a company profile
 */
router.post('/profiles/:companyProfileId/contacts', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const contactData = insertCompanyContactSchema.parse({
      ...req.body,
      companyProfileId,
    });
    const contact = await storage.createCompanyContact(contactData);
    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error creating company contact:', error);
    res.status(500).json({ error: 'Failed to create company contact' });
  }
});

/**
 * Update a company contact
 */
router.put('/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateSchema = insertCompanyContactSchema.partial();
    const updates = updateSchema.parse(req.body);
    const contact = await storage.updateCompanyContact(id, updates);
    if (!contact) {
      return res.status(404).json({ error: 'Company contact not found' });
    }
    res.json(contact);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error updating company contact:', error);
    res.status(500).json({ error: 'Failed to update company contact' });
  }
});

/**
 * Delete a company contact
 */
router.delete('/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteCompanyContact(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting company contact:', error);
    res.status(500).json({ error: 'Failed to delete company contact' });
  }
});

// ============ COMPANY IDENTIFIERS ============

/**
 * Get identifiers for a company profile
 */
router.get('/profiles/:companyProfileId/identifiers', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const identifiers = await storage.getCompanyIdentifiers(companyProfileId);
    res.json(identifiers);
  } catch (error) {
    console.error('Error fetching company identifiers:', error);
    res.status(500).json({ error: 'Failed to fetch company identifiers' });
  }
});

/**
 * Create a new identifier for a company profile
 */
router.post('/profiles/:companyProfileId/identifiers', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const identifierData = insertCompanyIdentifierSchema.parse({
      ...req.body,
      companyProfileId,
    });
    const identifier = await storage.createCompanyIdentifier(identifierData);
    res.status(201).json(identifier);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error creating company identifier:', error);
    res.status(500).json({ error: 'Failed to create company identifier' });
  }
});

/**
 * Update a company identifier
 */
router.put('/identifiers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateSchema = insertCompanyIdentifierSchema.partial();
    const updates = updateSchema.parse(req.body);
    const identifier = await storage.updateCompanyIdentifier(id, updates);
    if (!identifier) {
      return res.status(404).json({ error: 'Company identifier not found' });
    }
    res.json(identifier);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error updating company identifier:', error);
    res.status(500).json({ error: 'Failed to update company identifier' });
  }
});

/**
 * Delete a company identifier
 */
router.delete('/identifiers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteCompanyIdentifier(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting company identifier:', error);
    res.status(500).json({ error: 'Failed to delete company identifier' });
  }
});

// ============ COMPANY CERTIFICATIONS ============

/**
 * Get certifications for a company profile
 */
router.get('/profiles/:companyProfileId/certifications', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const certifications =
      await storage.getCompanyCertifications(companyProfileId);
    res.json(certifications);
  } catch (error) {
    console.error('Error fetching company certifications:', error);
    res.status(500).json({ error: 'Failed to fetch company certifications' });
  }
});

/**
 * Get expiring certifications
 */
router.get('/certifications/expiring', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const expiringCertifications = await storage.getExpiringCertifications(
      parseInt(days as string)
    );
    res.json(expiringCertifications);
  } catch (error) {
    console.error('Error fetching expiring certifications:', error);
    res.status(500).json({ error: 'Failed to fetch expiring certifications' });
  }
});

/**
 * Create a new certification for a company profile
 */
router.post('/profiles/:companyProfileId/certifications', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const certificationData = insertCompanyCertificationSchema.parse({
      ...req.body,
      companyProfileId,
    });
    const certification =
      await storage.createCompanyCertification(certificationData);
    res.status(201).json(certification);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error creating company certification:', error);
    res.status(500).json({ error: 'Failed to create company certification' });
  }
});

/**
 * Update a company certification
 */
router.put('/certifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateSchema = insertCompanyCertificationSchema.partial();
    const updates = updateSchema.parse(req.body);
    const certification = await storage.updateCompanyCertification(id, updates);
    if (!certification) {
      return res.status(404).json({ error: 'Company certification not found' });
    }
    res.json(certification);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error updating company certification:', error);
    res.status(500).json({ error: 'Failed to update company certification' });
  }
});

/**
 * Delete a company certification
 */
router.delete('/certifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteCompanyCertification(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting company certification:', error);
    res.status(500).json({ error: 'Failed to delete company certification' });
  }
});

// ============ COMPANY INSURANCE ============

/**
 * Get insurance for a company profile
 */
router.get('/profiles/:companyProfileId/insurance', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const insurance = await storage.getCompanyInsurance(companyProfileId);
    res.json(insurance);
  } catch (error) {
    console.error('Error fetching company insurance:', error);
    res.status(500).json({ error: 'Failed to fetch company insurance' });
  }
});

/**
 * Get expiring insurance
 */
router.get('/insurance/expiring', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const expiringInsurance = await storage.getExpiringInsurance(
      parseInt(days as string)
    );
    res.json(expiringInsurance);
  } catch (error) {
    console.error('Error fetching expiring insurance:', error);
    res.status(500).json({ error: 'Failed to fetch expiring insurance' });
  }
});

/**
 * Create new insurance for a company profile
 */
router.post('/profiles/:companyProfileId/insurance', async (req, res) => {
  try {
    const { companyProfileId } = req.params;
    const insuranceData = insertCompanyInsuranceSchema.parse({
      ...req.body,
      companyProfileId,
    });
    const insurance = await storage.createCompanyInsurance(insuranceData);
    res.status(201).json(insurance);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error creating company insurance:', error);
    res.status(500).json({ error: 'Failed to create company insurance' });
  }
});

/**
 * Update company insurance
 */
router.put('/insurance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateSchema = insertCompanyInsuranceSchema.partial();
    const updates = updateSchema.parse(req.body);
    const insurance = await storage.updateCompanyInsurance(id, updates);
    if (!insurance) {
      return res.status(404).json({ error: 'Company insurance not found' });
    }
    res.json(insurance);
  } catch (error) {
    if (error instanceof ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error updating company insurance:', error);
    res.status(500).json({ error: 'Failed to update company insurance' });
  }
});

/**
 * Delete company insurance
 */
router.delete('/insurance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteCompanyInsurance(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting company insurance:', error);
    res.status(500).json({ error: 'Failed to delete company insurance' });
  }
});

export default router;
