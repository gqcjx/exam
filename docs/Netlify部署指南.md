# Netlify 部署指南

## 方式一：使用 Netlify CLI 部署（推荐）

### 前提条件
1. 已安装 Node.js 和 npm
2. 已安装 Netlify CLI：`npm install -g netlify-cli`
3. 已登录 Netlify：`netlify login`

### 部署步骤

1. **构建项目**
   ```bash
   npm run build
   ```

2. **部署到生产环境**
   ```bash
   netlify deploy --prod
   ```

   如果是第一次部署，CLI 会提示你：
   - 选择或创建站点
   - 输入站点名称（如果创建新站点）

3. **或者使用部署脚本**
   - Windows: 运行 `deploy.bat`
   - Linux/Mac: 运行 `./deploy.sh`

### 注意事项
- 确保环境变量已在 Netlify 控制台配置（见下方）
- 部署会自动包含 `netlify/functions/` 目录中的 Functions

## 方式二：手动上传部署

### 步骤

1. **构建项目**
   ```bash
   npm run build
   ```

2. **准备上传文件**
   - 需要上传的目录：
     - `dist/` - 构建后的前端文件
     - `netlify/functions/` - Netlify Functions（代理功能）

3. **在 Netlify 控制台上传**
   - 访问 https://app.netlify.com
   - 进入你的站点
   - 点击 "Deploys" 标签
   - 将 `dist` 目录拖拽到部署区域
   - **重要**：还需要上传 `netlify/functions/` 目录

4. **配置 Functions**
   - 在 Netlify 控制台 → Functions
   - 确保 `supabase-proxy` 函数已部署
   - 如果未自动部署，需要手动上传 `netlify/functions/supabase-proxy.js`

### 手动上传 Functions（如果需要）

如果手动上传，需要：
1. 在 Netlify 控制台 → Functions
2. 上传 `netlify/functions/supabase-proxy.js` 文件
3. 确保函数名称为 `supabase-proxy`

## 环境变量配置

在 Netlify 控制台配置以下环境变量：

1. **访问环境变量设置**
   - Netlify 控制台 → Site settings → Build & deploy → Environment variables

2. **添加以下变量**
   - `VITE_SUPABASE_URL`: 你的 Supabase 项目 URL
   - `VITE_SUPABASE_ANON_KEY`: 你的 Supabase anon public key
   - `SUPABASE_URL`: （可选）如果 `VITE_SUPABASE_URL` 未设置，Functions 会使用此变量

3. **保存并重新部署**
   - 保存环境变量后，触发重新部署

## 验证部署

部署完成后，验证以下内容：

1. **检查站点是否正常访问**
   - 访问你的 Netlify 站点 URL

2. **检查代理功能**
   - 打开浏览器开发者工具（F12）→ Network 标签
   - 尝试登录
   - 查看网络请求，应该看到请求发送到 `/.netlify/functions/supabase-proxy/`

3. **检查 Functions**
   - Netlify 控制台 → Functions
   - 确认 `supabase-proxy` 函数存在且已部署

## 故障排查

### 部署失败

1. **检查构建日志**
   - Netlify 控制台 → Deploys → 查看构建日志

2. **检查环境变量**
   - 确认所有必需的环境变量已配置

3. **检查 Functions**
   - 确认 `netlify/functions/supabase-proxy.js` 已上传

### 代理功能不工作

1. **检查域名**
   - 确认站点域名包含 `netlify.app` 或 `netlify.com`

2. **检查 Functions 日志**
   - Netlify 控制台 → Functions → supabase-proxy → Logs
   - 查看是否有错误信息

3. **检查环境变量**
   - 确认 `VITE_SUPABASE_URL` 或 `SUPABASE_URL` 已配置

## 快速部署命令

如果已配置好所有内容，可以使用以下命令快速部署：

```bash
# Windows
deploy.bat

# Linux/Mac
./deploy.sh
```

或者：

```bash
npm run build && netlify deploy --prod
```
