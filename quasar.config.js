// Quasar CLI Vite-mode config — Sinpapel Designer
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

import { defineConfig } from '#q-app/wrappers'

export default defineConfig(() => ({
  boot: ['vue-flow'],

  css: ['app.scss'],

  extras: ['roboto-font', 'material-icons'],

  build: {
    target: {
      browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
      node: 'node20',
    },
    vueRouterMode: 'history',
    vitePlugins: [
      [
        'vite-plugin-checker',
        {
          eslint: {
            lintCommand: 'eslint "./src/**/*.{js,mjs,cjs,vue}"',
            useFlatConfig: true,
          },
        },
        { server: false },
      ],
    ],
  },

  devServer: {
    open: false,
    port: 5173,
  },

  framework: {
    config: {},
    plugins: ['Notify'],
  },

  animations: [],
  sourceFiles: {},
  bin: {},
  htmlVariables: {},
}))
