export type PurchaseTemplateConfig = {
  template: 'saas' | 'cloud_gpu';
  name: string;
  defaultMerchant: string;
  allowedMerchants: string[];
  allowedMcc: string[];
  allowedCurrencies: string[];
  maxPerTransactionCapMinor: number;
  maxTotalCapMinor: number;
  defaultMaxTransactions: number;
  validityDays: number;
};

export const saasTemplate: PurchaseTemplateConfig = {
  template: 'saas',
  name: 'SaaS Subscription Plan',
  defaultMerchant: 'PixelForge Design',
  allowedMerchants: [
    'PixelForge Design',
    'PixelForge',
    'Northstar Design',
    'Figma',
    'Linear',
    'GitHub',
    'Slack',
    'Notion',
  ],
  allowedMcc: ['5734', '7372'],
  allowedCurrencies: ['USD'],
  maxPerTransactionCapMinor: 100000, // $1,000 cap
  maxTotalCapMinor: 250000,          // $2,500 all-time cap
  defaultMaxTransactions: 1,
  validityDays: 14,
};

export const cloudGpuTemplate: PurchaseTemplateConfig = {
  template: 'cloud_gpu',
  name: 'Cloud GPU Compute Capacity',
  defaultMerchant: 'Lambda GPU Cloud',
  allowedMerchants: [
    'Lambda GPU Cloud',
    'Lambda Labs',
    'RunPod',
    'Together AI',
    'CoreWeave',
    'Nebius AI',
    'Crusoe Cloud',
  ],
  allowedMcc: ['7379', '7372'],
  allowedCurrencies: ['USD'],
  maxPerTransactionCapMinor: 200000, // $2,000 cap
  maxTotalCapMinor: 500000,          // $5,000 all-time cap
  defaultMaxTransactions: 1,
  validityDays: 7,
};

export const templates: Record<'saas' | 'cloud_gpu', PurchaseTemplateConfig> = {
  saas: saasTemplate,
  cloud_gpu: cloudGpuTemplate,
};

export function getTemplateConfig(template: 'saas' | 'cloud_gpu'): PurchaseTemplateConfig {
  return templates[template] ?? saasTemplate;
}
