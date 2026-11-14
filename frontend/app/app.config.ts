// Every form control defaults to the same size so mixed fields line up.
const md = { defaultVariants: { size: 'md' as const } }

// Visual system shared with ems-project: dark ink sidebar, light canvas,
// high-contrast slate text, gold (#f5a524) primary, flat (non-gradient) surfaces.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'gold',
      neutral: 'slate',
      success: 'green',
      warning: 'amber',
      error: 'red',
      info: 'blue'
    },
    button: {
      ...md,
      // Solid hover darkens (700→800) instead of fading, keeping white text >=4.5:1.
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'text-ink hover:bg-(--ui-color-primary-400) active:bg-(--ui-color-primary-600) disabled:bg-(--ui-color-primary-500) aria-disabled:bg-(--ui-color-primary-500)' },
        { color: 'success', variant: 'solid', class: 'hover:bg-(--ui-color-success-800) active:bg-(--ui-color-success-900)' },
        { color: 'warning', variant: 'solid', class: 'hover:bg-(--ui-color-warning-800) active:bg-(--ui-color-warning-900)' },
        { color: 'error', variant: 'solid', class: 'hover:bg-(--ui-color-error-800) active:bg-(--ui-color-error-900)' }
      ]
    },
    input: md,
    inputNumber: md,
    inputTags: md,
    textarea: md,
    select: md,
    selectMenu: md,
    // Pages sit directly on the canvas, like the ems admin shell.
    dashboardPanel: {
      slots: {
        root: 'bg-canvas lg:min-h-0 lg:h-svh overflow-hidden',
        // The body scrolls; its sections must keep their natural height instead of
        // flex-shrinking into the fixed-height panel (which clipped tables and pagination).
        body: 'min-h-0 *:shrink-0 gap-5 sm:gap-6 p-4 sm:p-6 lg:px-8'
      }
    },
    dashboardNavbar: {
      slots: {
        root: 'bg-white/85 backdrop-blur border-default h-(--ui-header-height) sm:px-6 lg:px-8',
        title: 'font-display text-xl font-bold tracking-tight text-highlighted'
      }
    },
    // On phones the toolbar wraps: search takes a full row and filters share the next one.
    dashboardToolbar: {
      slots: {
        root: 'bg-white/85 border-default sm:px-6 lg:px-8 max-sm:flex-wrap max-sm:py-2 gap-2',
        left: 'min-w-0 max-sm:w-full max-sm:overflow-x-auto max-sm:*:flex-1 max-sm:*:min-w-0',
        right: 'max-sm:w-full max-sm:*:flex-1 max-sm:*:min-w-0'
      }
    },
    dashboardSidebar: {
      slots: {
        root: 'bg-ink border-e-0',
        header: 'h-auto px-4 pt-5 pb-4',
        body: 'px-3 gap-5',
        footer: 'border-t border-white/10 p-3',
        content: 'bg-ink'
      },
      variants: { side: { left: { root: 'border-e-0' } } }
    },
    card: {
      slots: {
        root: 'rounded-xl bg-default ring ring-default shadow-(--shadow-card) divide-default',
        header: 'px-5 py-4 sm:px-6',
        body: 'p-5 sm:p-6',
        footer: 'px-5 sm:px-6'
      }
    },
    table: {
      slots: {
        root: 'rounded-xl border border-default bg-white shadow-(--shadow-card)',
        thead: 'bg-slate-100',
        th: 'py-3 text-xs font-semibold uppercase tracking-wide text-toned first:ps-5 last:pe-5',
        tbody: 'divide-y divide-default',
        tr: 'transition-colors even:bg-slate-50/70 hover:bg-gold-50',
        td: 'py-3.5 text-sm text-default first:ps-5 last:pe-5'
      }
    },
    badge: {
      slots: { base: 'font-semibold' }
    },
    tabs: {
      slots: { trigger: 'font-semibold' }
    }
  }
})
