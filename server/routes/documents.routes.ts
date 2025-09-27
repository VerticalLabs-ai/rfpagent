import { Router } from 'express';
import { documentIntelligenceService } from '../services/documentIntelligenceService';

const router = Router();

/**
 * Analyze documents for an RFP using document intelligence
 */
router.post('/analyze/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;

    console.log(`📊 Analyzing documents for RFP: ${rfpId}`);
    const analysis = await documentIntelligenceService.analyzeRFPDocuments(rfpId);

    res.json({
      message: "Document analysis completed",
      analysis
    });
  } catch (error) {
    console.error("Error analyzing RFP documents:", error);
    res.status(500).json({
      error: "Failed to analyze documents",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Auto-fill form fields using document intelligence
 */
router.post('/autofill/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;
    const { formFields, companyProfileId } = req.body;

    if (!formFields || !Array.isArray(formFields)) {
      return res.status(400).json({ error: "Form fields array is required" });
    }

    console.log(`🏢 Auto-filling ${formFields.length} form fields for RFP: ${rfpId}`);
    const filledFields = await documentIntelligenceService.autoFillFormFields(
      rfpId,
      formFields,
      companyProfileId
    );

    res.json({
      message: "Form fields auto-filled",
      filledFields
    });
  } catch (error) {
    console.error("Error auto-filling form fields:", error);
    res.status(500).json({
      error: "Failed to auto-fill form fields",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;