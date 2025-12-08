import React from 'react';
import {
  FileText,
  Search,
  FileCheck,
  Upload,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export interface HelpTopic {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export const helpTopics: HelpTopic[] = [
  {
    id: 'rfp-discovery',
    title: 'RFP Discovery',
    icon: <Search className="h-4 w-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>
          The RFP Discovery feature automatically scans government portals for
          new opportunities.
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Configure portal credentials in Settings → Portals</li>
          <li>Set up automated scan schedules</li>
          <li>Use filters to find relevant RFPs</li>
          <li>Manually submit RFP URLs for processing</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'proposal-generation',
    title: 'Proposal Generation',
    icon: <FileText className="h-4 w-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>Generate AI-powered proposals tailored to each RFP.</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Select an RFP from the list</li>
          <li>Choose a company profile</li>
          <li>Click "Generate Proposal"</li>
          <li>Review and edit the generated content</li>
          <li>Export as PDF when ready</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'compliance',
    title: 'Compliance Checking',
    icon: <FileCheck className="h-4 w-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>Ensure your proposals meet all RFP requirements.</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Automatic requirement extraction from RFP documents</li>
          <li>Compliance matrix generation</li>
          <li>Section-by-section validation</li>
          <li>Missing requirement alerts</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'submissions',
    title: 'Submissions',
    icon: <Upload className="h-4 w-4" />,
    content: (
      <div className="space-y-2 text-sm">
        <p>Track and manage proposal submissions.</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>View submission deadlines</li>
          <li>Track submission status</li>
          <li>Upload required documents</li>
          <li>Receive confirmation notifications</li>
        </ul>
      </div>
    ),
  },
];

export const faqItems: FAQItem[] = [
  {
    question: 'How long does proposal generation take?',
    answer:
      'Proposal generation typically takes 2-5 minutes depending on the complexity of the RFP and the number of sections requested.',
  },
  {
    question: 'Can I edit generated proposals?',
    answer:
      'Yes! All generated proposals can be edited before export. Use the Preview & Edit step in the proposal wizard to make changes.',
  },
  {
    question: 'What file formats are supported for RFP documents?',
    answer:
      'We support PDF and Microsoft Word (.docx) documents. The system automatically extracts text and requirements from these formats.',
  },
  {
    question: 'How do I set up portal credentials?',
    answer:
      'Go to Settings → Portals, select the portal you want to configure, and enter your login credentials. We support 2FA for secure portals.',
  },
  {
    question: 'What happens if generation fails?',
    answer:
      'If generation fails, you can retry from where it stopped. The system automatically saves progress and can resume from the last successful step.',
  },
];

export const supportLinks = {
  documentation: 'https://docs.rfpagent.io',
  email: 'support@rfpagent.io',
  status: 'https://status.rfpagent.io',
};
