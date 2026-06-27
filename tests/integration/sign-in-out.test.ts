// Contract test for signIn + signOut (US4)
import { describe, expect, it } from 'vitest'
import { signInSchema } from '~/shared/validation/user'

describe('signIn validation', () => {
  it('accepts valid input', () => {
    const result = signInSchema.safeParse({
      account: 'admin',
      password: 'admin123',
    })
    expect(result.success).toBe(true)
  })
  it('rejects empty password', () => {
    const result = signInSchema.safeParse({
      account: 'admin',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})
