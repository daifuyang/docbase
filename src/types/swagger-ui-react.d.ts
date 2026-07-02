declare module 'swagger-ui-react' {
  import type { ComponentType } from 'react'

  type SwaggerUIProps = {
    spec?: unknown
    url?: string
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>
  export default SwaggerUI
}
