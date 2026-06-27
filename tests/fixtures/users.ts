import type { PublicUser } from '~/shared/types'

export const aliceUser: PublicUser = {
  id: 'user_alice_test',
  username: 'alice',
  displayName: 'Alice',
  bio: 'Test bio for Alice',
  createdAt: new Date('2026-01-01').toISOString(),
}

export const bobUser: PublicUser = {
  id: 'user_bob_test',
  username: 'bob',
  displayName: 'Bob',
  bio: 'Test bio for Bob',
  createdAt: new Date('2026-01-01').toISOString(),
}
