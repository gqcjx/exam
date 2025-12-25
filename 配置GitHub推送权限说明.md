# 配置 GitHub Personal Access Token 推送权限

## 📋 步骤说明

### 第一步：创建 Personal Access Token

1. **访问 GitHub Token 设置页面**
   - 打开浏览器，访问：https://github.com/settings/tokens
   - 或者：GitHub 头像 → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **生成新 Token**
   - 点击 "Generate new token" → "Generate new token (classic)"
   - 填写 Token 描述（例如：`exam项目推送权限`）
   - 选择过期时间（建议选择较长时间，如 90 天或自定义）

3. **选择权限范围**
   - ✅ 必须勾选：`repo`（完整仓库权限）
   - 其他权限根据需求选择

4. **生成并复制 Token**
   - 点击 "Generate token"
   - **重要**：立即复制 token（只显示一次，关闭页面后无法再次查看）
   - 格式类似：`ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 第二步：配置 Git 使用 Token

有两种方式配置：

#### 方式 1：临时使用（推荐，更安全）

在推送时直接使用 token：

```bash
git push https://<YOUR_TOKEN>@github.com/gqcjx/exam.git main
```

#### 方式 2：永久配置（方便但需注意安全）

```bash
# 配置远程仓库 URL，将 token 嵌入 URL
git remote set-url origin https://<YOUR_TOKEN>@github.com/gqcjx/exam.git

# 然后正常推送
git push origin main
```

**注意**：如果使用方式 2，token 会保存在 git 配置中，请确保不要将 `.git/config` 文件提交到仓库。

### 第三步：推送代码

配置完成后，执行：

```bash
cd D:\PythonDemo\exam
git push origin main
```

## 🔒 安全建议

1. **不要将 token 提交到代码仓库**
2. **定期更新 token**（建议每 90 天更新一次）
3. **使用最小权限原则**（只授予必要的权限）
4. **如果 token 泄露，立即撤销并重新生成**

## ❓ 常见问题

### Q: Token 在哪里查看？
A: 创建后只显示一次，如果忘记，需要重新生成。

### Q: 如何撤销 Token？
A: 访问 https://github.com/settings/tokens，找到对应的 token，点击 "Revoke"。

### Q: 推送时仍然提示权限错误？
A: 检查：
- Token 是否已过期
- Token 是否具有 `repo` 权限
- 远程仓库 URL 是否正确

## 📝 快速命令参考

```bash
# 查看当前远程仓库配置
git remote -v

# 设置远程仓库 URL（使用 token）
git remote set-url origin https://<YOUR_TOKEN>@github.com/gqcjx/exam.git

# 推送代码
git push origin main

# 查看推送状态
git status
```

