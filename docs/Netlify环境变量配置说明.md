# Netlify 环境变量配置说明

## 重要提示

**Netlify Functions 运行时无法访问 `VITE_` 前缀的环境变量！**

这是因为 `VITE_` 前缀的变量只在构建时（build time）可用，而 Netlify Functions 在运行时（runtime）执行，无法访问这些变量。

## 必须配置的环境变量

为了确保前端和 Functions 都能正常工作，需要配置以下 **4 个环境变量**：

### 1. 前端构建时使用的变量（带 `VITE_` 前缀）

- `VITE_SUPABASE_URL`: 你的 Supabase 项目 URL
- `VITE_SUPABASE_ANON_KEY`: 你的 Supabase anon public key

### 2. Functions 运行时使用的变量（不带 `VITE_` 前缀）

- `SUPABASE_URL`: 你的 Supabase 项目 URL（与 `VITE_SUPABASE_URL` 的值相同）
- `SUPABASE_ANON_KEY`: 你的 Supabase anon public key（与 `VITE_SUPABASE_ANON_KEY` 的值相同）

## 配置步骤

### 方法 1：通过 Netlify 控制台配置（推荐）

1. **访问环境变量设置页面**
   - 打开 https://app.netlify.com/sites/qfce/configuration/env
   - 或者：Netlify 控制台 → 你的站点 → Site settings → Build & deploy → Environment variables

2. **添加环境变量**
   点击 "Add a variable" 按钮，依次添加以下 4 个变量：

   ```
   变量名: VITE_SUPABASE_URL
   值: https://your-project.supabase.co
   ```

   ```
   变量名: VITE_SUPABASE_ANON_KEY
   值: your-anon-key-here
   ```

   ```
   变量名: SUPABASE_URL
   值: https://your-project.supabase.co
   （与 VITE_SUPABASE_URL 的值相同）
   ```

   ```
   变量名: SUPABASE_ANON_KEY
   值: your-anon-key-here
   （与 VITE_SUPABASE_ANON_KEY 的值相同）
   ```

3. **保存并重新部署**
   - 点击 "Save" 保存所有变量
   - 在 Deploys 页面触发重新部署，或推送代码到 GitHub（如果已连接）

### 方法 2：通过 Netlify CLI 配置

```bash
# 设置前端构建时变量
netlify env:set VITE_SUPABASE_URL "https://your-project.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "your-anon-key-here"

# 设置 Functions 运行时变量
netlify env:set SUPABASE_URL "https://your-project.supabase.co"
netlify env:set SUPABASE_ANON_KEY "your-anon-key-here"

# 触发重新部署
netlify deploy --prod
```

## 验证配置

### 1. 检查环境变量是否已配置

在 Netlify 控制台的环境变量页面，确认以下 4 个变量都已存在：
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`

### 2. 查看 Functions 日志

部署后，查看 Functions 日志确认环境变量是否正确：

1. 访问 Netlify 控制台 → Functions → supabase-proxy → Logs
2. 查看最近的请求日志
3. 应该看到类似以下内容：
   ```
   Environment check: {
     hasSupabaseUrl: true,
     hasSupabaseAnonKey: true,
     urlSource: 'SUPABASE_URL',
     keySource: 'SUPABASE_ANON_KEY'
   }
   ```

### 3. 测试登录功能

1. 访问 https://qfce.netlify.app/login
2. 尝试登录
3. 如果仍然失败，查看浏览器控制台和 Functions 日志

## 常见问题

### Q: 为什么需要配置两套变量？

**A**: 
- `VITE_` 前缀的变量只在构建时可用，用于前端代码编译
- 不带 `VITE_` 前缀的变量在运行时可用，用于 Netlify Functions
- 两者都需要配置才能确保前端和 Functions 都能正常工作

### Q: 我只配置了 `VITE_` 前缀的变量，为什么 Functions 不工作？

**A**: 因为 Netlify Functions 在运行时执行，无法访问 `VITE_` 前缀的变量。必须同时配置不带 `VITE_` 前缀的变量。

### Q: 环境变量配置后仍然不工作？

**A**: 
1. 确认环境变量已保存
2. **必须重新部署**站点（环境变量更改后需要重新部署才能生效）
3. 检查 Functions 日志，查看环境变量是否正确读取
4. 确认变量值没有多余的空格或引号

### Q: 如何获取 Supabase 的 URL 和 Key？

**A**: 
1. 访问 Supabase 控制台：https://app.supabase.com
2. 选择你的项目
3. 进入 Settings → API
4. 复制：
   - **Project URL** → 用作 `VITE_SUPABASE_URL` 和 `SUPABASE_URL` 的值
   - **anon public** key → 用作 `VITE_SUPABASE_ANON_KEY` 和 `SUPABASE_ANON_KEY` 的值

## 环境变量优先级

代理函数会按以下顺序查找环境变量：

1. `SUPABASE_URL` / `SUPABASE_ANON_KEY`（优先，因为运行时可用）
2. `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（回退，但运行时可能不可用）

**建议**：始终配置不带 `VITE_` 前缀的变量，以确保 Functions 正常工作。

## 安全提示

- ✅ 使用 `anon/public` key（可以公开）
- ❌ 不要使用 `service_role` key（有完整权限，必须保密）
- ✅ 环境变量在 Netlify 控制台中是加密存储的
- ✅ 不要在代码中硬编码这些值

## 更新日志

- **2024-01-XX**: 修复环境变量访问问题，添加不带 `VITE_` 前缀的变量支持
