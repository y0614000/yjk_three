import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base:"yjk_three/",
  server: {
    port: 5500
  }
})

