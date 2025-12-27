# Netlify 部署配置说明

## 🔍 问题诊断

当前配置是为 GitHub Pages 设计的（使用 `/exam/` 子路径），但 Netlify 通常部署在根路径，导致路径不匹配。

## ✅ 已修复的配置

### 1. Vite 配置更新

已修改 `vite.config.ts`，根据环境变量自动选择 base 路径：
- **Netlify**：使用根路径 `/`
- **GitHub Pages**：使用子路径 `/exam/`

### 2. React Router basename 更新

已修改 `src/routes.tsx`，根据域名自动选择 basename：
- **Netlify**：使用空字符串（根路径）
- **GitHub Pages**：使用 `/exam`

### 3. Netlify 配置文件

已创建 `netlify.toml` 配置文件，包含：
- 构建命令和发布目录
- SPA 路由重定向规则
- 环境变量配置说明

## 📋 需要在 Netlify 控制台完成的配置

### 第一步：配置环境变量

1. **访问 Netlify 环境变量设置**
   - 打开：https://app.netlify.com/sites/qfce/configuration/env
   - 或者：Netlify Dashboard → 你的站点 → `Site settings` → `Build & deploy` → `Environment variables`

2. **添加环境变量**
   - 点击 `Add a variable`
   - 添加第一个：
     - **Key**：`VITE_SUPABASE_URL`
     - **Value**：你的 Supabase 项目 URL（例如：`https://xxxxx.supabase.co`）
     - 点击 `Save`
   - 再次点击 `Add a variable`
   - 添加第二个：
     - **Key**：`VITE_SUPABASE_ANON_KEY`
     - **Value**：你的 Supabase anon public key
     - 点击 `Save`

### 第二步：检查构建设置

1. **访问构建设置**
   - 打开：https://app.netlify.com/sites/qfce/configuration/deploys
   - 或者：Netlify Dashboard → 你的站点 → `Site settings` → `Build & deploy`

2. **确认构建配置**
   - **Build command**：应该显示 `NETLIFY=true npm run build`（由 `netlify.toml` 自动配置）
   - **Publish directory**：应该显示 `dist`
   - 如果不同，可以手动设置或确保 `netlify.toml` 文件已提交到仓库

### 第三步：触发重新部署

配置完环境变量后，需要触发一次新的部署：

**方式 1：手动触发（推荐）**
1. 访问：https://app.netlify.com/sites/qfce/deploys
2. 点击 `Trigger deploy` → `Deploy site`
3. 等待部署完成（通常 2-5 分钟）

**方式 2：推送代码触发**
```bash
git commit --allow-empty -m "trigger: rebuild for Netlify"
git push origin main
```

## 🔍 验证部署

### 检查部署状态

1. **访问部署页面**
   - https://app.netlify.com/sites/qfce/deploys
   - 查看最新的部署状态

2. **检查构建日志**
   - 点击最新的部署
   - 查看构建日志，确认：
     - ✅ 构建成功
     - ✅ 没有环境变量相关的错误
     - ✅ 所有资源路径正确

### 测试网站功能

部署完成后，访问你的 Netlify 网站（通常是 `https://qfce.netlify.app` 或你的自定义域名）：

1. **首页**：应该正常显示
2. **登录页**：应该不再显示"环境变量未配置"的错误
3. **路由导航**：所有页面路由应该正常工作

## ⚠️ 常见问题

### 问题 1：构建失败

**可能原因**：
- 环境变量未配置
- Node.js 版本不兼容
- 依赖安装失败

**解决方法**：
1. 检查 Netlify 构建日志中的错误信息
2. 确认环境变量已正确配置
3. 确认 `netlify.toml` 中的 Node.js 版本（当前设置为 20）

### 问题 2：页面显示 404

**可能原因**：
- SPA 路由重定向未配置
- `netlify.toml` 中的重定向规则未生效

**解决方法**：
1. 确认 `netlify.toml` 文件已提交到仓库
2. 确认重定向规则正确：
   ```toml
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```
3. 触发重新部署

### 问题 3：资源加载失败

**可能原因**：
- base 路径配置错误
- 资源路径不匹配

**解决方法**：
1. 检查浏览器控制台的网络请求
2. 确认资源路径是否以 `/` 开头（Netlify 根路径）
3. 检查 `vite.config.ts` 中的 base 配置

### 问题 4：环境变量未生效

**可能原因**：
- 环境变量名称错误（应该是 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`）
- 环境变量作用域设置错误

**解决方法**：
1. 确认环境变量名称正确（必须以 `VITE_` 开头）
2. 确认环境变量作用域设置为 `All scopes` 或 `Production`
3. 触发重新部署（环境变量更改后需要重新构建）

## 📝 重要提示

### 1. 同时支持 GitHub Pages 和 Netlify

当前配置已支持同时部署到两个平台：
- **GitHub Pages**：使用 `/exam/` 子路径
- **Netlify**：使用根路径 `/`

### 2. 环境变量

- **Netlify**：在 Netlify 控制台配置环境变量
- **GitHub Pages**：在 GitHub Secrets 中配置环境变量

### 3. 自动部署

- **Netlify**：连接到 GitHub 仓库后，每次推送都会自动触发部署
- **GitHub Pages**：通过 GitHub Actions 自动部署

## 🎯 预期结果

配置完成后，应该能够：
- ✅ Netlify 构建成功
- ✅ 网站正常访问
- ✅ 所有路由正常工作
- ✅ 登录和注册功能正常
- ✅ Supabase 连接正常

---

**配置完成后，请等待 Netlify 部署完成（2-5 分钟），然后访问网站验证！**

