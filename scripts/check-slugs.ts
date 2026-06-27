import 'dotenv/config'
import { db } from '../db'
import * as schema from '../db/schema'

const rows = await db.select({ name: schema.space.name, slug: schema.space.slug }).from(schema.space)
console.log(JSON.stringify(rows, null, 2))
process.exit(0)