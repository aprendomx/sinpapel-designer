import { boot } from 'quasar/wrappers'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

export default boot(() => {
  // Vue Flow CSS bundled at app boot time. No runtime registration needed —
  // each consumer imports VueFlow / Background / Controls / MiniMap directly.
})
