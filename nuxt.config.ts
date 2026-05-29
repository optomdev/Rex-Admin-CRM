// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxtjs/supabase',
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    supabaseSecretKey: '',
    rexWebhookSecret: '',
    crmWebhookSecret: '',
    rexCallbackUrl: '',
    resendApiKey: '',
    supportFromEmail: '',
    supportFromName: 'Rex Support',
    supportReplyToEmail: '',
    githubToken: '',
    githubOwner: '',
    githubRepo: '',
    public: {
      supabaseUrl: '',
      supabasePublishableKey: '',
      siteUrl: ''
    }
  },

  routeRules: {
    '/api/**': {
      cors: true
    }
  },

  compatibilityDate: '2026-05-26',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  supabase: {
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secretKey: process.env.NUXT_SUPABASE_SECRET_KEY,
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/api/webhooks/rex'],
      saveRedirectToCookie: true
    },
    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    },
    types: false
  }
})
