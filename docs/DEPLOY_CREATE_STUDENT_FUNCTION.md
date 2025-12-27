# 部署 create-student Edge Function

## 问题
批量导入学生时出现 403 Forbidden 错误，因为 `supabase.auth.admin.createUser` 需要 service_role 权限，但前端只配置了 anon key。

## 解决方案
创建一个 Edge Function 来处理用户创建，Edge Function 可以使用 service_role key。

## 部署步骤

### 方法 1：通过 Supabase Dashboard（推荐）

1. **登录 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择你的项目（mejrbcxhbgctiwsquqaj）

2. **创建 Edge Function**
   - 左侧菜单 → `Edge Functions`
   - 点击 `Create a new function`
   - 函数名称：`create-student`
   - 点击 `Create function`

3. **复制代码**
   - 打开 `exam/supabase/functions/create-student/index.ts`
   - 复制全部内容
   - 粘贴到 Supabase Dashboard 的代码编辑器中

4. **配置环境变量（重要！）**
   - 在 Edge Function 设置中找到 `Secrets` 或 `Environment Variables`
   - 添加以下环境变量：
     - `SUPABASE_URL`: 你的 Supabase 项目 URL（例如：`https://mejrbcxhbgctiwsquqaj.supabase.co`）
     - `SUPABASE_ANON_KEY`: 你的 anon/public key（在 Supabase Dashboard → Settings → API → anon public key）
     - `SUPABASE_SERVICE_ROLE_KEY`: 你的 service_role key（在 Supabase Dashboard → Settings → API → service_role key）

5. **设置 JWT 验证（重要！）**
   - 在 Edge Function 设置页面找到 **Verify JWT** 选项
   - **设置为 `false`**（这样我们的代码可以手动验证用户权限）
   - 如果设置为 `true`，Supabase 会在平台层面验证 JWT，可能导致 "User not allowed" 错误

6. **部署**
   - 点击 `Deploy` 按钮
   - 等待部署完成

### 方法 2：使用 Supabase CLI

如果你已经安装了 Supabase CLI：

```bash
# 1. 登录 Supabase CLI
npx supabase login

# 2. 链接到你的项目
npx supabase link --project-ref mejrbcxhbgctiwsquqaj

# 3. 部署 Edge Function
cd exam
npx supabase functions deploy create-student
```

**注意：** 使用 CLI 部署时，需要确保环境变量已通过 Supabase Dashboard 配置。

## 验证部署

部署完成后：

1. 刷新前端页面
2. 进入"用户管理"页面
3. 点击"批量导入学生"
4. 选择 Excel 文件并导入
5. 检查是否成功创建学生账号

## 如果仍有问题

如果部署后仍有错误：

1. **检查 Edge Function 日志**：
   - Supabase Dashboard → Edge Functions → create-student → Logs
   - 查看是否有错误信息

2. **验证环境变量**：
   - 确保 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` 都已正确设置
   - 注意：`SUPABASE_SERVICE_ROLE_KEY` 是 service_role key，不是 anon key
   - `SUPABASE_ANON_KEY` 用于验证用户身份和权限

3. **检查权限**：
   - 确保当前登录用户是管理员
   - 确保 Edge Function 有权限访问 `profiles` 表

## 关键说明

1. **Service Role Key**：
   - Edge Function 使用 service_role key 来创建用户
   - service_role key 有完整的数据库访问权限
   - **不要**在前端代码中使用 service_role key

2. **安全性**：
   - Edge Function 会验证输入数据
   - 只有通过 Edge Function 才能创建用户
   - 前端代码无法直接调用 admin API

3. **错误处理**：
   - 如果创建用户失败，Edge Function 会返回错误信息
   - 如果创建档案失败，会自动删除已创建的用户账号
