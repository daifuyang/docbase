/**
 * shadcn/ui-style Popover.
 *
 * Implementation note. The canonical shadcn Popover wraps
 * `@radix-ui/react-popover`, which this project does not depend on; the brief
 * for the sidebar work explicitly rules out adding a new UI package. Radix's
 * menu/popper internals are present only as pnpm-hoisted *transitive*
 * dependencies of `@radix-ui/react-dropdown-menu`, which are not importable
 * from application code (their `exports` maps expose only root entries, and
 * the packages are not linked into the project's node_modules).
 *
 * So this is a small, dependency-free implementation of the same public API:
 * `Popover` (controlled/uncontrolled open state), `PopoverTrigger` (anchors the
 * panel, supports `asChild`) and `PopoverContent` (portalled, viewport-aware,
 * closes on outside click and Escape).
 *
 * It deliberately covers only what the sidebar needs: a non-modal anchored
 * panel. Keyboard roving focus and typeahead are intentionally out of scope —
 * the panel hosts plain buttons and an inline text field, not a menu list.
 */
import * as React from 'react'
import { cn } from '~/lib/utils'

type PopoverContextValue = {
  open: boolean
  setOpen: (next: boolean) => void
  anchorRef: React.RefObject<HTMLElement | null>
  contentId: string
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopoverContext(): PopoverContextValue {
  const context = React.useContext(PopoverContext)
  if (!context) {
    throw new Error('Popover components must be rendered inside <Popover>')
  }
  return context
}

type PopoverProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
  children: React.ReactNode
}

export function Popover({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const anchorRef = React.useRef<HTMLElement | null>(null)
  const contentId = React.useId()

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const value = React.useMemo(
    () => ({ open, setOpen, anchorRef, contentId }),
    [open, setOpen, contentId],
  )

  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>
}

type PopoverTriggerProps = React.ComponentPropsWithoutRef<'button'> & {
  asChild?: boolean
}

export const PopoverTrigger = React.forwardRef<HTMLElement, PopoverTriggerProps>(
  ({ asChild = false, onClick, children, ...props }, forwardedRef) => {
    const { open, setOpen, anchorRef, contentId } = usePopoverContext()

    const setRefs = React.useCallback(
      (node: HTMLElement | null) => {
        anchorRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) {
          ;(forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node
        }
      },
      [anchorRef, forwardedRef],
    )

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        onClick?.(event as React.MouseEvent<HTMLButtonElement>)
        if (!event.defaultPrevented) setOpen(!open)
      },
      [onClick, open, setOpen],
    )

    const shared = {
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': open,
      'aria-controls': open ? contentId : undefined,
      onClick: handleClick,
    }

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>>
      return React.cloneElement(child, {
        ...shared,
        ...props,
        ref: setRefs,
      } as Record<string, unknown>)
    }

    return (
      <button type="button" ref={setRefs} {...shared} {...props}>
        {children}
      </button>
    )
  },
)
PopoverTrigger.displayName = 'PopoverTrigger'

type Align = 'start' | 'center' | 'end'
type Side = 'bottom' | 'top'

type PopoverContentProps = React.ComponentPropsWithoutRef<'div'> & {
  align?: Align
  side?: Side
  sideOffset?: number
  alignOffset?: number
}

/**
 * Positions the panel against the trigger rect and flips it above the trigger
 * when there is not enough room below. Repositioning runs on scroll and resize
 * so a panel inside the scrollable sidebar tracks its anchor.
 */
export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  (
    { className, align = 'start', side = 'bottom', sideOffset = 4, alignOffset = 0, ...props },
    forwardedRef,
  ) => {
    const { open, setOpen, anchorRef, contentId } = usePopoverContext()
    const contentRef = React.useRef<HTMLDivElement | null>(null)
    const [style, setStyle] = React.useState<React.CSSProperties>({
      position: 'fixed',
      top: 0,
      left: 0,
      visibility: 'hidden',
    })

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef],
    )

    const reposition = React.useCallback(() => {
      const anchor = anchorRef.current
      const content = contentRef.current
      if (!anchor || !content) return

      const anchorRect = anchor.getBoundingClientRect()
      const contentRect = content.getBoundingClientRect()
      const gap = sideOffset
      const viewportPadding = 8

      const roomBelow = window.innerHeight - anchorRect.bottom
      const flip = side === 'bottom' && roomBelow < contentRect.height + gap + viewportPadding
      const top = flip ? anchorRect.top - contentRect.height - gap : anchorRect.bottom + gap

      let left: number
      if (align === 'end') left = anchorRect.right - contentRect.width + alignOffset
      else if (align === 'center') {
        left = anchorRect.left + (anchorRect.width - contentRect.width) / 2 + alignOffset
      } else left = anchorRect.left + alignOffset

      const maxLeft = window.innerWidth - contentRect.width - viewportPadding
      left = Math.max(viewportPadding, Math.min(left, maxLeft))

      setStyle({
        position: 'fixed',
        top: Math.max(viewportPadding, top),
        left,
        visibility: 'visible',
      })
    }, [align, alignOffset, anchorRef, side, sideOffset])

    React.useEffect(() => {
      if (!open) {
        // Reset so the next open does not flash at the previous position.
        setStyle({ position: 'fixed', top: 0, left: 0, visibility: 'hidden' })
        return
      }
      reposition()
    }, [open, reposition])

    React.useEffect(() => {
      if (!open) return

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as Node
        if (contentRef.current?.contains(target)) return
        if (anchorRef.current?.contains(target)) return
        setOpen(false)
      }
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false)
      }

      document.addEventListener('pointerdown', handlePointerDown, true)
      document.addEventListener('keydown', handleKeyDown)
      window.addEventListener('resize', reposition)
      window.addEventListener('scroll', reposition, true)

      return () => {
        document.removeEventListener('pointerdown', handlePointerDown, true)
        document.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('resize', reposition)
        window.removeEventListener('scroll', reposition, true)
      }
    }, [open, reposition, setOpen, anchorRef])

    if (!open) return null

    return (
      <div
        ref={setRefs}
        id={contentId}
        role="dialog"
        style={style}
        className={cn(
          'z-50 rounded-md border border-border bg-surface text-foreground shadow-md outline-none',
          className,
        )}
        {...props}
      />
    )
  },
)
PopoverContent.displayName = 'PopoverContent'
