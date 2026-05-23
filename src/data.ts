import { DocumentInfo, MappingRule } from './types';

export const mockDocuments: DocumentInfo[] = [
  {
    id: '1',
    name: 'invoice_Q3_tech_corp_final.pdf',
    category: 'Finance',
    mappedCode: 'FIN-INV-01',
    requester: 'Sarah Jenkins',
    status: 'Classified',
    size: '2.4 MB',
    time: '1h ago',
  },
  {
    id: '2',
    name: 'employee_handbook_2023_v2.pdf',
    category: 'Analyzing...',
    mappedCode: '--',
    requester: 'System Auth',
    status: 'Processing',
    size: '8.4 MB',
    time: '12m ago',
    confidence: 0,
  },
  {
    id: '3',
    name: 'NDA_global_partners_signed.pdf',
    category: 'Legal',
    mappedCode: 'LGL-NDA-99',
    requester: 'Legal Dept',
    status: 'Classified',
    size: '1.1 MB',
    time: '2h ago',
  },
  {
    id: '4',
    name: 'corrupted_scan_001.pdf',
    category: 'Unreadable',
    mappedCode: 'ERR-001',
    requester: 'Scanner Bot',
    status: 'Failed',
    size: '0.5 MB',
    time: '3h ago',
  },
  {
    id: '5',
    name: 'q2_marketing_strategy_draft.pdf',
    category: 'Analyzing...',
    mappedCode: '--',
    requester: 'M. Roberts',
    status: 'Processing',
    size: '4.2 MB',
    time: '4h ago',
  },
  // For dashboard recent activity
  {
    id: '6',
    name: 'Q3_Financial_Report_draft.pdf',
    category: '--',
    mappedCode: '--',
    requester: 'Finance Team',
    status: 'Processing',
    size: '4.2 MB',
    time: 'Just now',
  },
  {
    id: '7',
    name: 'Vendor_Agreement_Sign_v2.pdf',
    category: '--',
    mappedCode: '--',
    requester: 'Procurement',
    status: 'Ready for Review',
    size: '1.1 MB',
    time: '5m ago',
  },
  {
    id: '8', // The one to be reviewed in screenshot 3
    name: 'BA_HALO_001 - John Doe.pdf',
    category: 'BA_HALO',
    mappedCode: 'ICTBAK',
    requester: 'System',
    status: 'Ready for Review',
    size: '1.5 MB',
    time: '10m ago',
    confidence: 98,
    extractedFields: {
      'Client Name': 'John Doe',
      'Document ID': 'HALO-001-A',
      'Date': '2023-10-27'
    },
    imageUrl: 'https://images.unsplash.com/photo-1586282391129-76a6df230234?auto=format&fit=crop&q=80&w=1600'
  }
];

export const mockMappings: MappingRule[] = [
  { id: 'm1', source: 'BA_HALO', target: 'ICTBAK' },
  { id: 'm2', source: 'BA_KKB', target: 'ICTBKK' },
  { id: 'm3', source: 'LEGAL_DOC', target: 'LGL_V1' },
  { id: 'm4', source: 'FIN_STMT', target: 'FN_QTR' },
];
