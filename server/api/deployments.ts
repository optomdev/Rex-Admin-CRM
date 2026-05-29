import { sampleCustomers } from '../utils/crmSeed'
import { isSupabaseConfigured, serverSupabase } from '../utils/supabase'

export default eventHandler(async () => {
  if (!isSupabaseConfigured()) {
    return sampleCustomers
      .filter(customer => customer.rex_project_ref || customer.rex_supabase_url || customer.customer_identifier)
      .map(customer => ({
        id: `${customer.id}-deployment`,
        customer_id: customer.id,
        name: 'Primary Rex deployment',
        environment: customer.name.toLowerCase().includes('stag') ? 'staging' : 'production',
        status: customer.status === 'paused' || customer.status === 'churned' ? 'paused' : 'active',
        health_status: 'unknown',
        customer_identifier: customer.customer_identifier,
        rex_project_ref: customer.rex_project_ref,
        supabase_url: customer.rex_supabase_url,
        app_url: customer.primary_domain ? `https://${customer.primary_domain}` : null,
        region: 'eu-west-2',
        deployed_release_id: null,
        deployed_version: null,
        app_provider: null,
        app_provider_project: null,
        git_repo: null,
        git_branch: null,
        git_tag: null,
        git_commit: null,
        latest_migration_version: null,
        latest_migration_name: null,
        edge_functions_commit: null,
        deploy_status: 'unknown',
        last_deployed_at: null,
        last_smoke_tested_at: null,
        last_seen_at: null,
        is_primary: true,
        notes: null,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        customer,
        release: null
      }))
  }

  const { data, error } = await serverSupabase()
    .from('customer_deployments')
    .select('*, customer:customers(id,name,account_type,status,health_score), release:releases(id,version,title)')
    .order('is_primary', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data ?? []
})
