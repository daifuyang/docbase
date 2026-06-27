// Vitest setup — runs before each test file
import 'dotenv/config'
import { afterEach, vi } from 'vitest'

// Make sure NODE_ENV is set for tests
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test'

afterEach(() => {
  vi.clearAllMocks()
})
