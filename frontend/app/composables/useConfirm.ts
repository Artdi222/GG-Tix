import ConfirmDialog from '~/components/ConfirmDialog.vue'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
}

/** Promise-based replacement for window.confirm(), rendered as an accessible modal. */
export function useConfirm() {
  const dialog = useOverlay().create(ConfirmDialog, { destroyOnClose: true })
  return async (options: ConfirmOptions) => Boolean(await dialog.open(options).result)
}
