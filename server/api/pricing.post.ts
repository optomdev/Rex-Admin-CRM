import { z } from 'zod'
import { defaultPricingItems, pricingSlug } from '../utils/pricing'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

const pricingSchema = z.object({
  code: z.string().trim().min(2).optional(),
  name: z.string().trim().min(2),
  category: z.enum(['license', 'module', 'usage', 'misc']),
  charge_type: z.enum(['monthly', 'onboarding', 'ad_hoc', 'credit']).default('ad_hoc'),
  amount: z.coerce.number().min(0),
  currency: z.string().trim().min(3).max(3).default('GBP'),
  unit_label: z.string().trim().min(2).default('item'),
  notes: z.string().trim().optional().nullable(),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(100)
})

export default eventHandler(async (event) => {
  const body = pricingSchema.parse(await readBody(event))
  const code = pricingSlug(body.code || body.name)

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Pricing code could not be generated' })
  }

  const pricingItem = {
    code,
    name: body.name,
    category: body.category,
    charge_type: body.charge_type,
    amount: body.amount,
    currency: body.currency.toUpperCase(),
    unit_label: body.unit_label,
    notes: body.notes || null,
    is_active: body.is_active,
    sort_order: body.sort_order
  }

  if (!isSupabaseConfigured()) {
    return {
      id: crypto.randomUUID(),
      ...pricingItem,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  const { data, error } = await serverSupabase()
    .from('pricing_items')
    .insert(pricingItem)
    .select('*')
    .single()

  if (error) {
    const fallback = defaultPricingItems.find(item => item.code === code)

    if (fallback) {
      throw createError({ statusCode: 409, statusMessage: 'A pricing item with this code already exists.' })
    }

    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
})
