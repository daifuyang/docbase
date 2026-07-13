import { signUpService } from './src/server/services/auth.ts'

async function main() {
  try {
    const r = await signUpService({
      username: 'admin',
      email: 'admin@docbase.local',
      password: 'Admin12345!',
      displayName: '管理员',
    })
    console.log('signup ok:', JSON.stringify(r, null, 2))
  } catch (e) {
    console.error('signup fail:', e)
  }
}
main()
