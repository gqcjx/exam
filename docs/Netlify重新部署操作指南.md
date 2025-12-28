# Netlify 重新部署操作指南

## 为什么需要重新部署？

当你修改了以下内容后，需要重新部署站点才能生效：
- ✅ 环境变量（Environment variables）
- ✅ 构建配置（netlify.toml）
- ✅ 代码更改（如果通过手动上传部署）

## 方法一：通过 Netlify 控制台（最简单）

### 步骤 1：访问 Deploys 页面

1. 打开浏览器，访问：https://app.netlify.com/sites/qfce/deploys
2. 或者：
   - 访问 https://app.netlify.com
   - 点击你的站点 "qfce"
   - 点击顶部菜单的 **"Deploys"** 标签

### 步骤 2：触发重新部署

在 Deploys 页面右上角，你会看到一个 **"Trigger deploy"** 按钮：

1. 点击 **"Trigger deploy"** 按钮
2. 在下拉菜单中选择 **"Deploy site"**
3. 等待部署完成（通常需要 1-3 分钟）

### 步骤 3：查看部署状态

部署过程中，你可以：
- 查看实时构建日志
- 查看部署进度
- 部署完成后会显示 "Published" 状态

## 方法二：通过 Site settings

### 步骤 1：访问 Site settings

1. 访问：https://app.netlify.com/sites/qfce/configuration/general
2. 或者：
   - Netlify 控制台 → 你的站点 → **Site settings** → **General**

### 步骤 2：找到 Build & deploy 部分

在页面中找到 **"Build & deploy"** 部分，你会看到：
- Build settings
- Deploy settings
- **Trigger deploy** 按钮

### 步骤 3：触发部署

1. 点击 **"Trigger deploy"** 按钮
2. 选择 **"Deploy site"**
3. 等待部署完成

## 方法三：使用 Netlify CLI（命令行）

### 前提条件

确保已安装 Netlify CLI：
```bash
npm install -g netlify-cli
```

### 部署步骤

#### Windows 系统

1. 打开命令提示符（CMD）或 PowerShell
2. 进入项目目录：
   ```bash
   cd D:\PythonDemo\exam
   ```
3. 运行部署脚本：
   ```bash
   deploy.bat
   ```

#### Linux/Mac 系统

1. 打开终端
2. 进入项目目录：
   ```bash
   cd /path/to/exam
   ```
3. 运行部署脚本：
   ```bash
   ./deploy.sh
   ```

#### 直接使用命令

或者直接使用 Netlify CLI 命令：

```bash
# 部署到生产环境
netlify deploy --prod

# 或者先构建再部署
npm run build && netlify deploy --prod
```

## 方法四：通过 Git 推送（如果已连接 GitHub）

如果你的 Netlify 站点已连接到 GitHub 仓库：

1. 推送代码到 GitHub：
   ```bash
   git add .
   git commit -m "Update configuration"
   git push origin main
   ```

2. Netlify 会自动检测到代码更改并触发部署

## 部署状态说明

### 部署进行中
- 状态显示：**"Building"** 或 **"Deploying"**
- 可以查看实时构建日志

### 部署成功
- 状态显示：**"Published"**
- 站点已更新，可以访问

### 部署失败
- 状态显示：**"Failed"**
- 点击查看错误日志，修复问题后重新部署

## 验证部署

### 1. 检查部署状态

在 Deploys 页面，确认最新部署显示 **"Published"** 状态。

### 2. 访问站点

访问你的站点 URL：https://qfce.netlify.app

### 3. 检查环境变量（如果修改了环境变量）

1. 查看 Functions 日志：
   - Netlify 控制台 → Functions → supabase-proxy → Logs
2. 应该看到环境变量检查日志：
   ```
   Environment check: {
     hasSupabaseUrl: true,
     hasSupabaseAnonKey: true,
     ...
   }
   ```

## 常见问题

### Q: 点击 "Trigger deploy" 后没有反应？

**A**: 
1. 刷新页面重试
2. 检查浏览器控制台是否有错误
3. 尝试使用其他方法（CLI 或 Git 推送）

### Q: 部署一直显示 "Building" 状态？

**A**: 
1. 查看构建日志，检查是否有错误
2. 构建通常需要 1-3 分钟，请耐心等待
3. 如果超过 10 分钟，可能是构建失败，查看日志

### Q: 部署失败怎么办？

**A**: 
1. 点击失败的部署，查看详细错误日志
2. 根据错误信息修复问题
3. 常见问题：
   - 环境变量未配置
   - 构建命令失败
   - 依赖安装失败

### Q: 环境变量修改后需要重新部署吗？

**A**: **是的，必须重新部署！** 环境变量修改后不会自动触发部署，需要手动触发。

### Q: 如何查看部署历史？

**A**: 
1. 访问 Deploys 页面
2. 可以看到所有历史部署记录
3. 点击任意部署可以查看详细日志

## 快速链接

- **Deploys 页面**: https://app.netlify.com/sites/qfce/deploys
- **Site settings**: https://app.netlify.com/sites/qfce/configuration/general
- **环境变量设置**: https://app.netlify.com/sites/qfce/configuration/env
- **Functions 日志**: https://app.netlify.com/projects/qfce/logs/functions

## 提示

- ✅ 部署前确保环境变量已正确配置
- ✅ 部署过程中不要关闭浏览器标签页
- ✅ 部署完成后验证站点功能是否正常
- ✅ 保留部署日志以便排查问题
