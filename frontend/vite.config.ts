import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwind()],build:{rollupOptions:{output:{manualChunks:{charts:['recharts'],vendor:['react','react-dom','react-router-dom']}}}},server:{proxy:{'/api':'http://localhost:4000'}},test:{environment:'jsdom',setupFiles:['./src/test-setup.ts']}});
