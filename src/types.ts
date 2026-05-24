export type ViewState = 'login' | 'dashboard' | 'files' | 'newBatch' | 'settings' | 'aiConfiguration' | 'manageUsers' | 'review';

export interface DocumentInfo {
  id: string;
  name: string;
  category?: string;
  mappedCode?: string;
  requester: string;
  status: 'Classified' | 'Processing' | 'Failed' | 'Ready for Review';
  size: string;
  time: string;
  confidence?: number;
  extractedFields?: Record<string, string>;
  imageUrl?: string;
}

export interface MappingRule {
  id: string;
  source: string;
  target: string;
}
