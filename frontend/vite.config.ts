import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /catalogo\.json/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'catalogo-cache',
                expiration: {
                  maxEntries: 5,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        manifest: {
          name: 'Catálogo de Estoque Comercial',
          short_name: 'Estoque',
          description: 'Catálogo de equipamentos validados para a equipe comercial',
          theme_color: '#ffffff',
          background_color: '#f3f4f6',
          display: 'standalone',
          icons: [
            {
              src: '/favicon.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: '/favicon.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        }
      }),

      // Sentry: faz upload dos source maps para o dashboard após o build.
      // Só ativa em produção E quando SENTRY_AUTH_TOKEN estiver definido.
      // Isso permite que o Sentry mostre o código TypeScript original nos erros.
      isProd && process.env.SENTRY_AUTH_TOKEN
        ? sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            // Remove os source maps do bundle final (fica só no Sentry)
            sourcemaps: {
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
            release: {
              name: process.env.VITE_APP_VERSION,
            },
            telemetry: false,
          })
        : null,
    ].filter(Boolean),

    build: {
      // Gera source maps — necessário para o Sentry mostrar o TS original
      sourcemap: true,
    },
  }
})
