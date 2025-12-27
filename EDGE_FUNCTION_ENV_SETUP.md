# Edge Function 环境变量配置说明

## 问题

如果批量导入学生时出现 "Edge Function returned a non-2xx status code" 错误，通常是因为 Edge Function 的环境变量（Secrets）没有正确配置。

## 解决步骤

### 1. 登录 Supabase Dashboard

访问：https://supabase.com/dashboard
选择你的项目（mejrbcxhbgctiwsquqaj）

### 2. 配置 Edge Function Secrets

1. **进入 Edge Functions 设置**
   - 左侧菜单 → `Edge Functions`
   - 点击 `create-student` 函数

2. **添加 Secrets（环境变量）**
   - 找到 `Secrets` 或 `Environment Variables` 部分
   - 点击 `Add Secret` 或 `Add Variable`

3. **添加以下三个环境变量：**

   **Secret 1:**
   - **Name**: `SUPABASE_URL`
   - **Value**: `https://mejrbcxhbgctiwsquqaj.supabase.co`
   - 点击 `Save`

   **Secret 2:**
   - **Name**: `SUPABASE_ANON_KEY`
   - **Value**: 你的 anon/public key
     - 获取方式：Settings → API → `anon` `public` key
   - 点击 `Save`

   **Secret 3:**
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: 你的 service_role key
     - 获取方式：Settings → API → `service_role` `secret` key
     - ⚠️ **注意**：这是敏感密钥，不要泄露
   - 点击 `Save`

### 3. 验证配置

配置完成后，Edge Function 会自动重新部署。等待几秒钟后，再次尝试批量导入学生。

## 如何获取 API Keys

1. 在 Supabase Dashboard 中，点击左侧菜单的 `Settings`（设置）
2. 选择 `API`
3. 在 `Project API keys` 部分找到：
   - **anon public**: 这是 `SUPABASE_ANON_KEY`
   - **service_role secret**: 这是 `SUPABASE_SERVICE_ROLE_KEY`（点击 `Reveal` 显示）

## 验证 Edge Function 是否正常工作

配置完成后，可以查看 Edge Function 的日志：

1. 在 Edge Functions 页面，点击 `create-student`
2. 查看 `Logs` 标签
3. 尝试导入学生，查看日志中是否有错误信息

## 常见错误

### 错误 1: "Service role key not configured"
- **原因**: `SUPABASE_SERVICE_ROLE_KEY` 未配置
- **解决**: 按照上述步骤添加该 Secret

### 错误 2: "Missing required fields: email, password, name"
- **原因**: 传入的数据缺少必需字段
- **解决**: 检查 Excel 文件，确保包含"姓名"列

### 错误 3: "Failed to create user"
- **原因**: 可能是邮箱格式错误或已存在
- **解决**: 检查导入数据，确保邮箱格式正确且唯一

## 注意事项

- ⚠️ **不要**将 `SUPABASE_SERVICE_ROLE_KEY` 提交到代码仓库
- ⚠️ **不要**在前端代码中使用 `SUPABASE_SERVICE_ROLE_KEY`
- ✅ Edge Function 的 Secrets 是安全的，只有服务器端可以访问
- ✅ 每次修改 Secrets 后，Edge Function 会自动重新部署
