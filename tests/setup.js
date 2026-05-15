import { config } from '@vue/test-utils'

// Stub Quasar directives that are not resolved in jsdom
config.global.directives = {
  'close-popup': () => {},
  'ripple': () => {},
}
