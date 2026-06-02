import { sampleBillingGroups } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleBillingGroups
  }

  const supabase = serverSupabase()
  const [groups, accounts, pricingItems] = await Promise.all([
    supabase
      .from('billing_groups')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('billing_group_accounts')
      .select('*, customer:customers(id,name,account_type,status,primary_domain)')
      .order('is_primary', { ascending: false }),
    supabase
      .from('billing_group_pricing_items')
      .select('*, pricing_item:pricing_items(id,name,code,category,charge_type,amount,currency,unit_label)')
      .order('is_active', { ascending: false })
      .order('starts_on', { ascending: true })
  ])

  const firstError = [groups, accounts, pricingItems].find(result => result.error)?.error
  if (firstError) {
    throw createError({ statusCode: 500, statusMessage: firstError.message })
  }

  return (groups.data ?? []).map(group => ({
    ...group,
    accounts: (accounts.data ?? []).filter(account => account.billing_group_id === group.id),
    pricing_items: (pricingItems.data ?? []).filter(item => item.billing_group_id === group.id)
  }))
})
