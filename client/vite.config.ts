import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  server:{
    host:true
  },
  preview:{
    port: parseInt(process.env.PORT ?? '') || 3000
  }
})
