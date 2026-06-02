<script setup lang="ts">
import type { Member } from '~/types'

defineProps<{
  members: Member[]
}>()
</script>

<template>
  <ul role="list" class="divide-y divide-default">
    <li
      v-for="(member, index) in members"
      :key="index"
      class="flex items-center justify-between gap-3 py-3 px-4 sm:px-6"
    >
      <div class="flex items-center gap-3 min-w-0">
        <UAvatar
          v-bind="member.avatar"
          size="md"
        />

        <div class="text-sm min-w-0">
          <p class="text-highlighted font-medium truncate">
            {{ member.name }}
          </p>
          <p class="text-muted truncate">
            {{ member.username }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <UBadge
          :label="member.role"
          :color="member.role === 'owner' ? 'success' : 'neutral'"
          variant="subtle"
        />
        <UBadge
          v-if="member.billing_role"
          :label="member.billing_role.replace('_', ' ')"
          :color="member.billing_role === 'billing_admin' ? 'primary' : 'neutral'"
          variant="subtle"
        />
      </div>
    </li>
  </ul>
</template>
