// Contract test for signUp (US3)
import { describe, expect, it } from 'vitest'
import { signUpSchema } from '~/shared/validation/user'

describe('signUp validation', () => {
  it('accepts a valid registration', () => {
    const result = signUpSchema.safeParse({
      email: 'TEST@example.com',
      username: 'Alice',
      password: 'Password123!',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // Email and username are lowercased
      expect(result.data.email).toBe('test@example.com')
      expect(result.data.username).toBe('alice')
    }
  })

  it('rejects invalid email', () => {
    const result = signUpSchema.safeParse({
      email: 'not-an-email',
      username: 'alice',
      password: 'Password123!',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short username', () => {
    const result = signUpSchema.safeParse({
      email: 'a@b.com',
      username: 'ab',
      password: 'Password123!',
    })
    expect(result.success).toBe(false)
  })

  it('rejects usernames with invalid characters', () => {
    const result = signUpSchema.safeParse({
      email: 'a@b.com',
      username: 'alice@bob',
      password: 'Password123!',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = signUpSchema.safeParse({
      email: 'a@b.com',
      username: 'alice',
      password: 'short',
    })
    expect(result.success).toBe(false)
  })
})
