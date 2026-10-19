<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface Usage {
  id: string
  orderId: string
  customerName: string
  customerEmail: string
  discountApplied: string
  status: 'active' | 'refunded'
  createdAt: string
}

const props = defineProps<{ voucherId: string, voucherCode: string }>()
const open = defineModel<boolean>('open', { default: false })

const list = usePaginatedList<Usage>(() => `/vouchers/${props.voucherId}/usages`, { immediate: false })
watch([open, () => props.voucherId], ([isOpen]) => {
  if (!isOpen) return
  if (list.page.value !== 1) list.page.value = 1
  else list.refresh()
})

const columns: TableColumn<Usage>[] = [
  { accessorKey: 'customerName', header: 'Pelanggan' },
  { accessorKey: 'orderId', header: 'Pesanan' },
  { accessorKey: 'discountApplied', header: () => h('span', { class: 'block text-right' }, 'Potongan') },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'createdAt', header: 'Waktu' }
]
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Pemakaian ${voucherCode}`"
    :description="list.totalCount.value ? `${formatNumber(list.totalCount.value)} transaksi` : undefined"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <UAlert
        v-if="list.error.value"
        color="error"
        variant="subtle"
        :title="list.error.value"
        class="mb-3"
      />
      <UTable
        :data="list.items.value"
        :columns="columns"
        :loading="list.loading.value"
        :ui="{ th: 'text-xs font-medium text-muted' }"
      >
        <template #customerName-cell="{ row }">
          <p class="text-highlighted">
            {{ row.original.customerName }}
          </p>
          <p class="text-xs text-muted">
            {{ row.original.customerEmail }}
          </p>
        </template>
        <template #orderId-cell="{ row }">
          <span class="font-mono text-xs">#{{ row.original.orderId.slice(0, 8).toUpperCase() }}</span>
        </template>
        <template #discountApplied-cell="{ row }">
          <span class="block text-right tabular-nums">{{ formatIDR(row.original.discountApplied) }}</span>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :status="row.original.status" />
        </template>
        <template #createdAt-cell="{ row }">
          <span class="whitespace-nowrap text-muted">{{ formatDateTime(row.original.createdAt) }}</span>
        </template>
        <template #empty>
          <div
            v-if="list.loading.value"
            class="space-y-3 p-4"
          >
            <USkeleton
              v-for="i in 5"
              :key="i"
              class="h-9 w-full"
            />
          </div>
          <UEmpty
            v-else
            icon="i-lucide-ticket-percent"
            title="Belum pernah dipakai"
            variant="naked"
            size="sm"
          />
        </template>
      </UTable>
      <div
        v-if="list.totalPages.value > 1"
        class="mt-3 flex justify-end"
      >
        <UPagination
          v-model:page="list.page.value"
          :total="list.totalCount.value"
          :items-per-page="list.limit"
        />
      </div>
    </template>
  </UModal>
</template>
