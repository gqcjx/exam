# ⚠️ 紧急：部署 Edge Function 修复 CORS 错误

## 当前问题
CORS 错误：`Response to preflight request doesn't pass access control check: It does not have HTTP ok status.`

**这意味着 Edge Function 可能还没有部署，或者部署时有问题。**

## 立即执行以下步骤

### 步骤 1：登录 Supabase Dashboard
1. 访问 https://supabase.com/dashboard
2. 选择项目：`mejrbcxhbgctiwsquqaj`

### 步骤 2：检查 Edge Function 是否存在
1. 左侧菜单 → `Edge Functions`
2. 查看是否有 `create-student` 函数
3. **如果没有，立即创建它！**

### 步骤 3：创建/更新 Edge Function

#### 如果函数不存在：
1. 点击 `Create a new function`
2. 函数名称：**`create-student`**（必须完全一致）
3. 点击 `Create function`

#### 然后：
1. **复制以下完整代码**（从 `supabase/functions/create-student/index.ts`）：

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// CORS 头
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 验证 service role key
    if (!SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Service role key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 验证用户权限（如果 verify_jwt 为 false，需要手动验证）
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "未提供认证信息，请先登录" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 创建 Supabase 客户端（使用 anon key 来验证用户）
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userClient = createClient(SUPABASE_URL, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // 验证用户身份和权限
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "用户认证失败，请重新登录" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 检查用户角色（必须是管理员或教师）
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "无法获取用户信息" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.role !== "admin" && profile.role !== "teacher") {
      return new Response(JSON.stringify({ error: "只有管理员或教师可以创建学生账号" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 创建 Supabase 客户端（使用 service role key）用于创建用户
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const payload = await req.json();
    const {
      email,
      password,
      phone,
      name,
      nickname,
      school_id,
      grade_id,
      class_id,
    } = payload;

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, password, name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 创建用户
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone: phone ? `+86${phone.replace(/\D/g, "")}` : undefined,
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({
          error: authError?.message || "Failed to create user",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 创建用户档案
    const { error: profileError2 } = await supabase.from("profiles").insert({
      user_id: authData.user.id,
      name,
      nickname: nickname || null,
      role: "student",
      school_id: school_id || null,
      grade_id: grade_id || null,
      class_id: class_id || null,
    });

    if (profileError2) {
      // 如果档案创建失败，删除已创建的用户
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({
          error: profileError2.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        email: authData.user.email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e?.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

2. **粘贴到 Supabase Dashboard 的代码编辑器**
3. **保存代码**

### 步骤 4：配置环境变量（必须！）

在 Edge Function 设置页面找到 `Secrets` 或 `Environment Variables`：

1. **SUPABASE_URL**
   - 值：`https://mejrbcxhbgctiwsquqaj.supabase.co`

2. **SUPABASE_ANON_KEY**
   - 获取方式：Supabase Dashboard → Settings → API → anon public key
   - 复制完整的 key 值

3. **SUPABASE_SERVICE_ROLE_KEY**
   - 获取方式：Supabase Dashboard → Settings → API → service_role key
   - 复制完整的 key 值（注意保密）

### 步骤 5：设置 JWT 验证

在 Edge Function 设置页面：
1. 找到 **Verify JWT** 选项
2. **设置为 `false`**（重要！）

### 步骤 6：部署

1. 点击 **`Deploy`** 按钮
2. 等待部署完成（通常几秒钟）
3. 确保状态显示为 **"Active"** 或 **"Deployed"**

### 步骤 7：验证

1. 刷新前端页面（https://gqcjx.github.io）
2. 确保已登录（且是管理员或教师）
3. 进入"用户管理"页面
4. 点击"批量导入学生"
5. 选择 Excel 文件并导入
6. 应该可以成功！

## 如果仍然失败

### 检查 Edge Function 日志
1. Supabase Dashboard → Edge Functions → create-student → Logs
2. 查看是否有错误信息
3. 检查请求是否到达了 Edge Function

### 检查浏览器控制台
1. 按 F12 打开开发者工具
2. 进入 `Network` 标签
3. 尝试导入学生
4. 找到 `create-student` 请求
5. 查看请求和响应详情

### 常见问题

**Q: Edge Function 显示 "Inactive" 或 "Not Deployed"**
A: 需要点击 Deploy 按钮重新部署。

**Q: 环境变量在哪里设置？**
A: 在 Edge Function 的设置页面，通常有 "Secrets" 或 "Environment Variables" 部分。

**Q: 如何确认 Edge Function 已部署？**
A: 在 Supabase Dashboard → Edge Functions 页面，`create-student` 应该显示为 "Active" 或 "Deployed" 状态。

## 关键点

1. ✅ Edge Function 名称必须是 `create-student`（完全一致）
2. ✅ 必须设置三个环境变量（SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY）
3. ✅ Verify JWT 必须设置为 `false`
4. ✅ 必须点击 Deploy 按钮部署
5. ✅ 确保部署状态为 "Active"
