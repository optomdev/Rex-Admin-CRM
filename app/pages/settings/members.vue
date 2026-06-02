<script setup lang="ts">
import type { Member } from '~/types'

const { data: members } = await useFetch<Member[]>('/api/members', { default: () => [] })

const q = ref('')

const filteredMembers = computed(() => {
  return members.value.filter((member) => {
    return member.name.search(new RegExp(q.value, 'i')) !== -1 || member.username.search(new RegExp(q.value, 'i')) !== -1
  })
})
</script>

<template>
  <div>
    <UPageCard
      title="User Management"
      description="Billing access can be marked as admin or viewer while V1 remains locked to one Supabase Auth admin user."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UBadge
        label="Billing roles"
        color="success"
        variant="subtle"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch', header: 'p-4 mb-0 border-b border-default' }">
      <template #header>
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Search members"
          autofocus
          class="w-full"
        />
      </template>

      <SettingsMembersList :members="filteredMembers" />
    </UPageCard>
  </div>
</template>
