'use client'

import { type KeyboardEvent, useState } from 'react'
import { cn } from '~/lib/utils'

type Props = {
  value: string[]
  onChange: (value: string[]) => void
  max?: number
  placeholder?: string
}

export function TagInput({ value, onChange, max = 10, placeholder = '添加标签后回车' }: Props) {
  const [input, setInput] = useState('')

  const add = (raw: string) => {
    const name = raw.toLowerCase().trim()
    if (!name) return
    if (value.includes(name)) return
    if (value.length >= max) return
    if (name.length > 30) return
    onChange([...value, name])
    setInput('')
  }

  const remove = (name: string) => onChange(value.filter((v) => v !== name))

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add(input)
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      const last = value[value.length - 1]
      if (last !== undefined) remove(last)
    }
  }

  return (
    <div className="rounded-md border border-input bg-background p-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            #{tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              className="ml-0.5 text-muted-foreground hover:text-destructive"
              aria-label={`移除 ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => input && add(input)}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={value.length >= max}
          className={cn(
            'flex-1 min-w-[120px] bg-transparent text-sm outline-none',
            value.length >= max && 'opacity-50',
          )}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {value.length} / {max} 个标签
      </p>
    </div>
  )
}
