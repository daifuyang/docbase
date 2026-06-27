// Unit tests for user validation schemas
import { describe, expect, it } from 'vitest'
import { emailSchema, passwordSchema, usernameSchema } from '~/shared/validation/user'

describe('emailSchema', () => {
  it('validates and lowercases', () => {
    expect(emailSchema.parse('FOO@Bar.COM')).toBe('foo@bar.com')
  })
  it('rejects invalid', () => {
    expect(() => emailSchema.parse('not-email')).toThrow()
  })
})

describe('usernameSchema', () => {
  it('accepts valid', () => {
    expect(usernameSchema.parse('alice_123')).toBe('alice_123')
    expect(usernameSchema.parse('Alice')).toBe('alice')
  })
  it('rejects short', () => {
    expect(() => usernameSchema.parse('ab')).toThrow()
  })
  it('rejects invalid chars', () => {
    expect(() => usernameSchema.parse('alice@bob')).toThrow()
    expect(() => usernameSchema.parse('alice bob')).toThrow()
  })
})

describe('passwordSchema', () => {
  it('accepts >= 8 chars', () => {
    expect(passwordSchema.parse('Password123!')).toBe('Password123!')
  })
  it('rejects < 8', () => {
    expect(() => passwordSchema.parse('short')).toThrow()
  })
})
