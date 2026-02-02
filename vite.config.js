import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        admin: resolve(__dirname, 'admin.html'),
        admin_settings: resolve(__dirname, 'admin_settings.html'),
        forgot_password: resolve(__dirname, 'forgot_password.html'),
        register: resolve(__dirname, 'register.html'),
        shop: resolve(__dirname, 'shop.html'), // [MỚI] Thêm dòng này
      }
    }
  }
})