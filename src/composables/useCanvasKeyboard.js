import { onMounted, onUnmounted } from 'vue'

/**
 * Composable for canvas keyboard shortcuts.
 * Supports: Ctrl+S (save), Ctrl+Z (undo), Ctrl+Shift+Z (redo),
 *           Delete (remove selected edge), Escape (exit edit mode / close panel)
 */
export function useCanvasKeyboard({
  editMode,
  selectedEdge,
  onSave,
  onUndo,
  onRedo,
  onDeleteEdge,
  onEscape,
}) {
  function handleKeyDown(event) {
    const isMeta = event.ctrlKey || event.metaKey

    // Save: Ctrl/Cmd + S
    if (isMeta && event.key === 's') {
      event.preventDefault()
      if (editMode.value) onSave()
      return
    }

    // Undo: Ctrl/Cmd + Z
    if (isMeta && event.key === 'z' && !event.shiftKey) {
      event.preventDefault()
      onUndo()
      return
    }

    // Redo: Ctrl/Cmd + Shift + Z
    if (isMeta && event.shiftKey && event.key === 'z') {
      event.preventDefault()
      onRedo()
      return
    }

    // Redo alternative: Ctrl/Cmd + Y
    if (isMeta && event.key === 'y') {
      event.preventDefault()
      onRedo()
      return
    }

    // Delete selected edge
    if ((event.key === 'Delete' || event.key === 'Backspace') && editMode.value && selectedEdge.value) {
      event.preventDefault()
      onDeleteEdge(selectedEdge.value)
      return
    }

    // Escape: close panel or exit edit mode
    if (event.key === 'Escape') {
      if (selectedEdge.value) {
        onEscape('close-panel')
      } else if (editMode.value) {
        onEscape('exit-edit')
      }
      return
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })
}
