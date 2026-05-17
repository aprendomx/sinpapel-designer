import { config } from '@vue/test-utils'

// Stub Quasar directives that are not resolved in jsdom
config.global.directives = {
  'close-popup': () => {},
  'ripple': () => {},
}

// Stub Quasar layout components that don't need real behavior in unit tests
config.global.stubs = {
  ...(config.global.stubs || {}),
  QSpace: true,
}
