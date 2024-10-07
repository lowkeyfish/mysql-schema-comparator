import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import ElementPlus from 'unplugin-element-plus/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  let base = mode === 'production' ? '/mysql-schema-comparator/' : '/'
  return {
    base,
    plugins: [
      vue(),
      vueDevTools(),
      AutoImport({
        resolvers: [ElementPlusResolver()]
      }),
      Components({
        resolvers: [
          ElementPlusResolver({
            importStyle: 'sass'
          })
        ]
      }),
      // 不使用 ElementPlush() 的话发现 ElMessage 的样式没有
      ElementPlus({
        useSource: true
      })
    ],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/assets/elementplus/index.scss" as *;`
        }
      }
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      // fs.cachedChecks 创建项目时没有，是自己手动设置上的
      //
      // 原因：
      // 不加这个，解决问题时的 vite 版本 "vite": "^5.2.8"，会出现多页场景下，pages 下的组件如果使用了 page 外
      // 的组件，例如 @/pages/main/views/test/TestView.vue 中使用 @/components/test/ 下的组件提示
      // [vite] Internal server error: Failed to resolve import "@/components/test/HelloWorld3.vue" from "src/pages/main/views/test/TestView.vue". Does the file exist?
      // 而且这个问题只在 npm run dev 后，新增加了文件后再使用时会出现，首次启动是正常的
      //
      // 解决：
      // https://github.com/vitejs/vite/issues/15784
      fs: {
        cachedChecks: false
      },
      port: 5001
    }
  }
})
