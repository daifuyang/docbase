'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { QuickNoteDialog } from './quick-note-dialog'

type QuickNoteContextValue = {
  open: () => void
  close: () => void
  isOpen: boolean
}

const QuickNoteContext = createContext<QuickNoteContextValue | null>(null)

export function QuickNoteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  // Cmd/Ctrl + Shift + N opens the dialog from anywhere. We attach to
  // window because the navbar may not be mounted on /auth/login.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.altKey) return
      if (event.key.toLowerCase() !== 'n') return
      const target = event.target as HTMLElement | null
      if (target && isEditable(target)) return
      event.preventDefault()
      setIsOpen((prev) => !prev)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo<QuickNoteContextValue>(
    () => ({ open, close, isOpen }),
    [open, close, isOpen],
  )

  return (
    <QuickNoteContext.Provider value={value}>
      {children}
      <QuickNoteDialog open={isOpen} onOpenChange={setIsOpen} />
    </QuickNoteContext.Provider>
  )
}

export function useQuickNote(): QuickNoteContextValue {
  const ctx = useContext(QuickNoteContext)
  if (!ctx) {
    throw new Error('useQuickNote must be used within QuickNoteProvider')
  }
  return ctx
}

// `isEditable` lets the global hotkey stay out of the way of typing —
// Cmd/Ctrl+Shift+N is also a common "new window" chord in some browsers,
// but we want the shortcut to feel like capture, not navigation.
function isEditable(target: HTMLElement): boolean {
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return false
}

// Kept around for the /notes page — calls into the provider when the user
// presses the inline "新建" button there.
export function useQuickNoteRef() {
  const ctx = useContext(QuickNoteContext)
  const ref = useRef(ctx)
  ref.current = ctx
  return ref
}
