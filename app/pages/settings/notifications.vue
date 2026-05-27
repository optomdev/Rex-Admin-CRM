<script setup lang="ts">
const state = reactive<{ [key: string]: boolean }>({
  email: true,
  desktop: false,
  product_updates: true,
  weekly_digest: false,
  important_updates: true
})

const sections = [{
  title: 'Notification channels',
  description: 'Where can we notify you?',
  fields: [{
    name: 'email',
    label: 'Email',
    description: 'Receive a daily email digest.'
  }, {
    name: 'desktop',
    label: 'Desktop',
    description: 'Receive desktop notifications.'
  }]
}, {
  title: 'Account updates',
  description: 'Choose which CRM events should reach the admin inbox.',
  fields: [{
    name: 'weekly_digest',
    label: 'Weekly digest',
    description: 'Receive a weekly summary of tickets, charges, and onboarding blockers.'
  }, {
    name: 'product_updates',
    label: 'Release updates',
    description: 'Receive updates when GitHub releases are imported or marked for rollout.'
  }, {
    name: 'important_updates',
    label: 'Important updates',
    description: 'Receive urgent ticket, overdue charge, and webhook failure alerts.'
  }]
}]
</script>

<template>
  <div v-for="(section, index) in sections" :key="index">
    <UPageCard
      :title="section.title"
      :description="section.description"
      variant="naked"
      class="mb-4"
    />

    <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }">
      <UFormField
        v-for="field in section.fields"
        :key="field.name"
        :name="field.name"
        :label="field.label"
        :description="field.description"
        class="flex items-center justify-between not-last:pb-4 gap-2"
      >
        <USwitch
          v-model="state[field.name]"
        />
      </UFormField>
    </UPageCard>
  </div>
</template>
