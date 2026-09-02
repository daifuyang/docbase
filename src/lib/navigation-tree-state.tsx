'use client'

import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { updateNavigationTreeState } from '~/server/spaces'

/**
 * Single source of truth for which navigation-tree nodes are expanded.
 *
 * Why a shared store rather than per-component state: the same `expandedKeys`
 * snapshot is rendered by two independent `SidebarContent` instances (the
 * desktop sidebar and the mobile drawer). When each owned its own `useState`
 * and each persisted the *whole* set, the two copies fought: whichever toggled
 * last overwrote the other's view of the tree.
 *
 * Why the persisted list is not simply merged in on every render: route loaders
 * revalidate on each navigation and return a snapshot that can predate the
 * collapse the user just made. Unioning that back in can only ever *add* keys,
 * so a collapse could never survive a navigation.
 */

type NavigationTreeState = {
  isOpen: (key: string) => boolean
  toggle: (key: string) => void
}

const NavigationTreeContext = createContext<NavigationTreeState | null>(null)

export function NavigationTreeProvider({
  expandedKeys = [],
  children,
}: {
  expandedKeys?: string[]
  children: ReactNode
}) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set(expandedKeys))

  // Number of writes we have issued whose effect may not be reflected in the
  // server snapshot yet. While this is non-zero, incoming loader data is
  // considered stale-by-construction and must not clobber local intent. This
  // is what closes the race that a string comparison alone could not: the
  // loader may revalidate *before* our write lands, returning a value that
  // differs from what we just wrote yet is still older than it.
  const pendingWrites = useRef(0)
  const persistedKeys = useMemo(() => serializeKeys(expandedKeys), [expandedKeys])
  const lastSyncedKeys = useRef(persistedKeys)

  useEffect(() => {
    if (pendingWrites.current > 0) return
    if (lastSyncedKeys.current === persistedKeys) return
    // Genuine external change (another tab or device rewrote the preference).
    lastSyncedKeys.current = persistedKeys
    setOpenKeys(deserializeKeys(persistedKeys))
  }, [persistedKeys])

  const toggle = useCallback((key: string) => {
    setOpenKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)

      const serialized = serializeKeys([...next])
      lastSyncedKeys.current = serialized
      pendingWrites.current += 1

      void updateNavigationTreeState({ data: { expandedKeys: [...next] } })
        .catch(() => {
          // Persistence is a convenience; a failure must not fight the user's
          // current, visible expansion state.
        })
        .finally(() => {
          pendingWrites.current = Math.max(0, pendingWrites.current - 1)
        })

      return next
    })
  }, [])

  const value = useMemo<NavigationTreeState>(
    () => ({ isOpen: (key: string) => openKeys.has(key), toggle }),
    [openKeys, toggle],
  )

  return <NavigationTreeContext.Provider value={value}>{children}</NavigationTreeContext.Provider>
}

export function useNavigationTree(): NavigationTreeState {
  const ctx = useContext(NavigationTreeContext)
  if (!ctx) {
    throw new Error('useNavigationTree must be used within a NavigationTreeProvider')
  }
  return ctx
}

// Order-insensitive identity for a set of expanded keys, so a loader returning
// the same keys in a different order is not mistaken for an external change.
export function serializeKeys(keys: string[]): string {
  return [...new Set(keys)].sort().join('\u0000')
}

function deserializeKeys(serialized: string): Set<string> {
  return new Set(serialized ? serialized.split('\u0000') : [])
}
