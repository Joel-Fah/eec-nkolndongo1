// SVGO for illustrations: keep ids (GSAP targets) and CSS variables (theme/season colours).
export default {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false,
          convertColors: false,
          collapseGroups: false,
          mergePaths: false,
        },
      },
    },
  ],
}
