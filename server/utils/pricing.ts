import type { PricingItem } from '~/types'

export const defaultPricingItems: PricingItem[] = [{
  id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2001',
  code: 'rex-main-license',
  name: 'Rex main license fee',
  category: 'license',
  charge_type: 'monthly',
  amount: 300,
  currency: 'GBP',
  unit_label: 'month',
  notes: 'Core Rex practice management subscription.',
  is_active: true,
  sort_order: 10,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, {
  id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2002',
  code: 'hearing-module',
  name: 'Hearing module',
  category: 'module',
  charge_type: 'monthly',
  amount: 150,
  currency: 'GBP',
  unit_label: 'month',
  notes: 'Optional hearing/audiology module.',
  is_active: true,
  sort_order: 20,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, {
  id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2003',
  code: 'hr-full-module',
  name: 'HR full module',
  category: 'module',
  charge_type: 'monthly',
  amount: 200,
  currency: 'GBP',
  unit_label: 'month',
  notes: 'Full HR module access.',
  is_active: true,
  sort_order: 30,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, {
  id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2004',
  code: 'postcode-lookups',
  name: 'Postcode look ups',
  category: 'usage',
  charge_type: 'ad_hoc',
  amount: 0,
  currency: 'GBP',
  unit_label: 'lookup',
  notes: 'Usage charge. Set the amount when billing the usage period.',
  is_active: true,
  sort_order: 40,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, {
  id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2005',
  code: 'sms-charges',
  name: 'SMS charges',
  category: 'usage',
  charge_type: 'ad_hoc',
  amount: 0,
  currency: 'GBP',
  unit_label: 'SMS',
  notes: 'Usage charge. Set the amount when billing the usage period.',
  is_active: true,
  sort_order: 50,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, {
  id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2006',
  code: 'email-charges',
  name: 'Email charges',
  category: 'usage',
  charge_type: 'ad_hoc',
  amount: 0,
  currency: 'GBP',
  unit_label: 'email',
  notes: 'Usage charge. Set the amount when billing the usage period.',
  is_active: true,
  sort_order: 60,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, {
  id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2007',
  code: 'imp-letter-charges',
  name: 'IMP letter charges',
  category: 'usage',
  charge_type: 'ad_hoc',
  amount: 0,
  currency: 'GBP',
  unit_label: 'letter',
  notes: 'Usage charge for IMP letters.',
  is_active: true,
  sort_order: 70,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}, {
  id: 'f6407ef0-6f7b-4977-a02f-6c6fce3c2008',
  code: 'misc-item',
  name: 'Misc item',
  category: 'misc',
  charge_type: 'ad_hoc',
  amount: 0,
  currency: 'GBP',
  unit_label: 'item',
  notes: 'Use notes to explain the misc charge.',
  is_active: true,
  sort_order: 80,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}]

export function pricingSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
