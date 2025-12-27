# GitHub Pages 部署配置说明

## ✅ 已完成的配置

1. **Vite 配置更新**
   - 已配置 `base: '/exam/'` 路径
   - 文件：`vite.config.ts`

2. **GitHub Actions 工作流**
   - 已创建自动部署工作流
   - 文件：`.github/workflows/deploy.yml`
   - 触发条件：每次推送到 `main` 分支时自动构建和部署

## 📋 需要在 GitHub 上完成的配置

### 第一步：启用 GitHub Pages

1. **访问仓库设置**
   - 打开：https://github.com/gqcjx/exam/settings/pages

2. **配置 Pages 源**
   - Source: 选择 **"GitHub Actions"**
   - 不要选择 "Deploy from a branch"

3. **保存设置**
   - 点击 "Save" 保存配置

### 第二步：配置环境变量（Secrets）

如果项目需要 Supabase 环境变量，需要配置 Secrets：

1. **访问 Secrets 设置**
   - 打开：https://github.com/gqcjx/exam/settings/secrets/actions

2. **添加 Repository secrets**
   - 点击 "New repository secret"
   - 添加以下 secrets（如果构建时需要）：
     - `VITE_SUPABASE_URL`: 你的 Supabase 项目 URL
     - `VITE_SUPABASE_ANON_KEY`: 你的 Supabase anon key

   **注意**：如果不需要在构建时注入环境变量，可以跳过此步骤。前端代码会在运行时从浏览器环境读取。

### 第三步：触发首次部署

有两种方式：

#### 方式 1：自动触发（推荐）
- 推送代码到 `main` 分支后，GitHub Actions 会自动运行
- 查看 Actions：https://github.com/gqcjx/exam/actions

#### 方式 2：手动触发
1. 访问：https://github.com/gqcjx/exam/actions
2. 选择 "Deploy to GitHub Pages" 工作流
3. 点击 "Run workflow" → "Run workflow"

### 第四步：等待部署完成

1. **查看部署状态**
   - 访问：https://github.com/gqcjx/exam/actions
   - 查看最新的工作流运行状态

2. **部署成功后访问**
   - 网站地址：https://gqcjx.github.io/exam/
   - 首次部署可能需要几分钟

## 🔍 验证部署

部署成功后，访问：
- **主页面**：https://gqcjx.github.io/exam/
- **登录页面**：https://gqcjx.github.io/exam/login

## ⚠️ 注意事项

### 1. 路径配置
- 所有路由和资源路径会自动添加 `/exam/` 前缀
- 如果将来要使用自定义域名，需要修改 `vite.config.ts` 中的 `base` 为 `/`

### 2. 环境变量
- GitHub Pages 是静态托管，无法在构建时注入环境变量
- 如果需要在生产环境使用 Supabase，需要：
  - 在构建时注入（通过 GitHub Secrets）
  - 或者在运行时从配置的 URL 加载环境变量

### 3. 路由配置
- React Router 使用 `createBrowserRouter`，需要确保所有路由都能正常工作
- 如果遇到 404 错误，可能需要配置 GitHub Pages 的 404 重定向

## 🔧 故障排查

### 问题 1：部署失败
- **检查**：GitHub Actions 日志
- **常见原因**：
  - 构建错误（TypeScript 错误、依赖问题）
  - 环境变量缺失
  - 权限问题

### 问题 2：页面显示 404
- **检查**：`vite.config.ts` 中的 `base` 路径是否正确
- **检查**：GitHub Pages 设置中是否选择了 "GitHub Actions"

### 问题 3：资源加载失败
- **检查**：浏览器控制台的网络请求
- **检查**：所有资源路径是否包含 `/exam/` 前缀

## 📝 相关文件

- `vite.config.ts` - Vite 构建配置（包含 base 路径）
- `.github/workflows/deploy.yml` - GitHub Actions 部署工作流
- `package.json` - 构建脚本配置

## 🎯 下一步

1. ✅ 代码已推送
2. ⏳ 在 GitHub 上启用 Pages（选择 "GitHub Actions"）
3. ⏳ 等待首次部署完成
4. ⏳ 访问 https://gqcjx.github.io/exam/ 验证

---

**配置完成后，每次推送到 `main` 分支都会自动触发部署！**


