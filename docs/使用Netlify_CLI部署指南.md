# 使用 Netlify CLI 部署指南

## ✅ 是的，可以使用 Netlify CLI 将本地项目部署到 Netlify！

当 GitHub 集成有问题时，使用 Netlify CLI 是一个很好的替代方案。

## 📋 部署步骤

### 第一步：安装 Netlify CLI

```bash
# 使用 npm 全局安装
npm install -g netlify-cli

# 或者使用 npx（不需要全局安装）
# npx netlify-cli
```

### 第二步：登录 Netlify

```bash
netlify login
```

这会打开浏览器，让你登录 Netlify 账户并授权 CLI 访问。

### 第三步：初始化项目（首次部署）

```bash
# 在项目根目录执行
netlify init
```

CLI 会询问：
1. **Create & configure a new site**（创建新站点）或 **Link this directory to an existing site**（链接到现有站点）
   - 如果已有站点 `qfce`，选择 "Link to existing site"
   - 如果创建新站点，选择 "Create & configure a new site"

2. **Team**：选择你的团队

3. **Site name**：如果创建新站点，输入站点名称（例如：`qfce`）

4. **Build command**：输入 `npm run build`

5. **Directory to deploy**：输入 `dist`

### 第四步：配置环境变量

在部署前，需要在 Netlify 控制台配置环境变量：

1. **访问环境变量设置**
   - https://app.netlify.com/sites/qfce/configuration/env

2. **添加环境变量**
   - `VITE_SUPABASE_URL`：你的 Supabase 项目 URL
   - `VITE_SUPABASE_ANON_KEY`：你的 Supabase anon public key

### 第五步：构建并部署

#### 方式 1：预览部署（测试）

```bash
# 构建并部署到预览环境
netlify deploy
```

这会：
- 运行 `npm run build`
- 将 `dist` 目录部署到预览 URL
- 返回一个预览链接（例如：`https://deploy-preview-123--qfce.netlify.app`）

#### 方式 2：生产部署

```bash
# 部署到生产环境
netlify deploy --prod
```

这会：
- 运行 `npm run build`
- 将 `dist` 目录部署到生产 URL（例如：`https://qfce.netlify.app`）

## 🔧 完整部署流程示例

```bash
# 1. 安装 CLI（如果还没安装）
npm install -g netlify-cli

# 2. 登录
netlify login

# 3. 链接到现有站点（如果还没初始化）
netlify link

# 4. 构建项目
npm run build

# 5. 部署到生产环境
netlify deploy --prod
```

## 📝 常用命令

### 查看站点信息

```bash
# 查看当前链接的站点
netlify status

# 查看站点详细信息
netlify sites:list
```

### 查看部署历史

```bash
# 查看部署列表
netlify deploy:list
```

### 打开站点

```bash
# 在浏览器中打开站点
netlify open
```

### 查看日志

```bash
# 查看实时日志
netlify logs
```

## ⚙️ 配置说明

### 自动检测配置

Netlify CLI 会自动检测以下文件：
- `netlify.toml` - Netlify 配置文件（已创建）
- `package.json` - 构建脚本配置

### 手动指定配置

如果不想使用 `netlify.toml`，可以在命令中指定：

```bash
netlify deploy --prod \
  --dir=dist \
  --build="npm run build"
```

## 🔍 链接到现有站点

如果站点 `qfce` 已经存在，可以链接到它：

```bash
# 链接到现有站点
netlify link

# CLI 会显示站点列表，选择 qfce
```

或者直接指定站点 ID：

```bash
netlify link --id qfce
```

## 📋 环境变量管理

### 方式 1：在 Netlify 控制台配置（推荐）

1. 访问：https://app.netlify.com/sites/qfce/configuration/env
2. 添加环境变量
3. 部署时会自动使用

### 方式 2：使用 CLI 设置

```bash
# 设置环境变量
netlify env:set VITE_SUPABASE_URL "https://your-project.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "your-anon-key"

# 查看环境变量
netlify env:list

# 删除环境变量
netlify env:unset VITE_SUPABASE_URL
```

## 🎯 快速部署脚本

可以创建一个部署脚本 `deploy.sh` 或 `deploy.bat`：

### Windows (deploy.bat)

```batch
@echo off
echo Building project...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b %errorlevel%
)

echo Deploying to Netlify...
call netlify deploy --prod
```

### Linux/Mac (deploy.sh)

```bash
#!/bin/bash
echo "Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo "Deploying to Netlify..."
netlify deploy --prod
```

使用：
```bash
# Windows
deploy.bat

# Linux/Mac
chmod +x deploy.sh
./deploy.sh
```

## ⚠️ 注意事项

### 1. 环境变量

- 环境变量需要在 Netlify 控制台配置，或者在部署时使用 `netlify env:set` 设置
- 构建时环境变量会自动注入

### 2. 构建输出

- 确保 `dist` 目录包含构建后的文件
- 如果构建失败，部署也会失败

### 3. 站点链接

- 首次部署需要 `netlify init` 或 `netlify link`
- 之后可以直接使用 `netlify deploy --prod`

### 4. 认证

- 使用 `netlify login` 登录后，认证信息会保存在本地
- 如果认证过期，需要重新登录

## 🔄 与 GitHub 集成的区别

### GitHub 集成（自动部署）
- ✅ 每次推送代码自动部署
- ✅ 无需手动操作
- ❌ 依赖 GitHub 连接

### Netlify CLI（手动部署）
- ✅ 不依赖 GitHub 连接
- ✅ 可以控制部署时机
- ✅ 可以预览部署
- ❌ 需要手动执行命令

## 🎯 推荐工作流

### 开发阶段
```bash
# 本地预览
npm run dev

# 预览部署
netlify deploy
```

### 生产部署
```bash
# 构建并部署到生产
npm run build
netlify deploy --prod
```

### 自动化（可选）
可以结合 Git hooks 或 CI/CD 脚本自动部署。

## 📝 故障排查

### 问题 1：未登录

**错误**：`Error: You must be logged in to run this command`

**解决**：
```bash
netlify login
```

### 问题 2：未链接站点

**错误**：`Error: No site id found`

**解决**：
```bash
netlify link
```

### 问题 3：构建失败

**错误**：构建过程中出现错误

**解决**：
1. 先本地测试构建：`npm run build`
2. 修复构建错误
3. 重新部署

### 问题 4：环境变量未生效

**解决**：
1. 检查环境变量是否配置：`netlify env:list`
2. 确认环境变量名称正确（必须以 `VITE_` 开头）
3. 重新部署

---

**使用 Netlify CLI 可以完全绕过 GitHub 集成问题，直接从本地部署！**

