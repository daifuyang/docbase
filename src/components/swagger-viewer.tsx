'use client'

import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

type Props = {
  spec: Record<string, unknown>
}

export default function SwaggerViewer({ spec }: Props) {
  return <SwaggerUI spec={spec} />
}
