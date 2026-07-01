import { createFileRoute } from '@tanstack/react-router'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'DocBase API',
    version: '1.0.0',
    description: 'DocBase API Documentation',
  },
  servers: [
    {
      url: '/',
      description: 'Current server',
    },
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    version: { type: 'string' },
                    db: { type: 'string' },
                    redis: { type: 'string' },
                    ts: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/install/state': {
      get: {
        summary: 'Get install state',
        tags: ['Install'],
        responses: {
          '200': {
            description: 'Install state',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      },
    },
    '/api/install/config': {
      post: {
        summary: 'Test install configuration',
        tags: ['Install'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  databaseUrl: { type: 'string', description: 'PostgreSQL connection URL' },
                  redisUrl: { type: 'string', description: 'Redis connection URL' },
                  appUrl: { type: 'string', description: 'Application URL' },
                },
                required: ['databaseUrl', 'redisUrl', 'appUrl'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Configuration test result',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      },
    },
    '/api/install/run': {
      post: {
        summary: 'Run installation',
        tags: ['Install'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  databaseUrl: { type: 'string' },
                  redisUrl: { type: 'string' },
                  appUrl: { type: 'string' },
                  admin: {
                    type: 'object',
                    properties: {
                      email: { type: 'string' },
                      username: { type: 'string' },
                      displayName: { type: 'string' },
                      password: { type: 'string' },
                      confirmPassword: { type: 'string' },
                    },
                    required: ['email', 'username', 'displayName', 'password', 'confirmPassword'],
                  },
                },
                required: ['databaseUrl', 'redisUrl', 'appUrl', 'admin'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Installation successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

export const Route = createFileRoute('/swagger')({
  component: SwaggerPage,
  head: () => ({ meta: [{ title: 'API Docs - DocBase' }] }),
})

function SwaggerPage() {
  return (
    <div style={{ padding: '20px', height: '100vh' }}>
      <SwaggerUI spec={spec} />
    </div>
  )
}
