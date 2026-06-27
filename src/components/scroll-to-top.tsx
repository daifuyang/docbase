'use client'

import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'

const SHOW_THRESHOLD_PX = 400

/**
 * Floating "back to top" button. Fixed bottom-right, fades in once the page
 * is scrolled past `SHOW_THRESHOLD_PX`, smooth-scrolls to top on click.
 *
 * Renders nothing during SSR — the visibility state is purely client-side.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_THRESHOLD_PX)
    }
    onScroll() // sync initial state (in case page was loaded mid-scroll)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="回到顶部"
      title="回到顶部"
      className={
        'fixed right-6 bottom-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-md transition-all duration-200 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
        (visible ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2')
      }
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  )
}
