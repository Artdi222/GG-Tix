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
    selectMenu: sm
  }
})
