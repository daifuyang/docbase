import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'docbase-theme'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeToggleState()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">切换主题</span>
    </Button>
  )
}

export function ThemeMenuItem() {
  const { theme, toggleTheme } = useThemeToggleState()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {theme === 'dark' ? '切换到浅色' : '切换到深色'}
    </button>
  )
}

function useThemeToggleState() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const initial = stored === 'dark' || stored === 'light' ? stored : 'light'
    setTheme(initial)
    applyTheme(initial)
  }, [])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  const toggleTheme = () => {
    setTheme(nextTheme)
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    applyTheme(nextTheme)
  }

  return { theme, nextTheme, toggleTheme }
}
