// Every form control defaults to the same compact size so mixed fields line up.
const sm = { defaultVariants: { size: 'sm' as const } }

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      neutral: 'zinc'
    },
    button: sm,
    input: sm,
    inputNumber: sm,
    inputTags: sm,
    textarea: sm,
    select: sm,
    selectMenu: sm,
    // Content sits on a floating sheet above the muted app canvas.
    dashboardPanel: {
      slots: {
        root: 'lg:my-2 lg:me-2 lg:rounded-lg lg:ring lg:ring-default lg:shadow-sm bg-default lg:min-h-0 lg:h-[calc(100svh-1rem)] overflow-hidden'
      }
    },
    dashboardSidebar: {
      variants: { side: { left: { root: 'border-e-0' } } }
    },
    dashboardNavbar: {
      slots: { title: 'text-[15px] font-semibold tracking-tight' }
    },
    card: {
      slots: {
        root: 'rounded-lg shadow-xs',
        header: 'px-5 py-4 sm:px-5',
        body: 'p-5 sm:p-5',
        footer: 'px-5 sm:px-5'
      }
    },
    table: {
      slots: {
        th: 'bg-elevated/60 py-2.5 text-xs font-medium text-muted first:ps-5 last:pe-5',
        td: 'text-sm first:ps-5 last:pe-5',
        tr: 'hover:bg-elevated/40 transition-colors'
      }
    },
    badge: {
      slots: { base: 'font-medium' }
    }
  }
})
