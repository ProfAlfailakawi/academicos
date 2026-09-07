import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
// @ts-ignore -- إضافة بلا أنواع: تحقن بصمة البناء وتطبعها في dist/build-id.json و sw.js
import { buildStamp } from './scripts/build-stamp.mjs';

export default defineConfig({
  plugins: [react(), tailwindcss(), buildStamp()],
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  build:{
    sourcemap:false,
    chunkSizeWarningLimit:550,
    rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules/firebase'))return'firebase';if(id.includes('node_modules/react')||id.includes('node_modules/scheduler'))return'react';if(id.includes('node_modules/lucide-react'))return'icons';}}},
  },
});
