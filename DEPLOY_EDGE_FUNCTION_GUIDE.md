# Edge Function 部署详细指南

## 问题说明

已修复 Edge Function 中的重复键错误，现在需要重新部署更新后的代码。

## 方法 1：通过 Supabase Dashboard 部署（推荐）

### 步骤 1：登录 Supabase Dashboard

1. 打开浏览器，访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. 使用你的账号登录
3. 选择你的项目（project ref: `mejrbcxhbgctiwsquqaj`）

### 步骤 2：进入 Edge Functions 页面

1. 在左侧导航栏中，找到并点击 **"Edge Functions"**（或 **"Functions"**）
2. 你应该能看到现有的 `create-student` 函数

### 步骤 3：编辑并部署函数

有两种方式：

#### 方式 A：直接编辑代码（如果 Dashboard 支持）

1. 点击 `create-student` 函数
2. 点击 **"Edit"** 或 **"Code"** 按钮
3. 将以下完整代码复制并替换现有代码：

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
      console.error("Service role key not configured");
      return new Response(JSON.stringify({ error: "Service role key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 验证 SUPABASE_URL
    if (!SUPABASE_URL) {
      console.error("SUPABASE_URL not configured");
      return new Response(JSON.stringify({ error: "SUPABASE_URL not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 验证用户权限（如果 verify_jwt 为 false，需要手动验证）
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "未提供认证信息，请先登录" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 创建 Supabase 客户端（使用 anon key 来验证用户）
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!anonKey) {
      console.error("SUPABASE_ANON_KEY not configured");
      return new Response(JSON.stringify({ error: "SUPABASE_ANON_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      console.error("User authentication failed:", userError);
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
      console.error("Failed to get user profile:", profileError);
      return new Response(JSON.stringify({ error: "无法获取用户信息" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.role !== "admin" && profile.role !== "teacher") {
      console.error("User role not allowed:", profile.role);
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

    let payload: any;
    try {
      payload = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    console.log("Received payload:", { email, name, hasPassword: !!password, phone, school_id, grade_id, class_id });

    if (!email || !password || !name) {
      const missingFields = [];
      if (!email) missingFields.push("email");
      if (!password) missingFields.push("password");
      if (!name) missingFields.push("name");
      console.error("Missing required fields:", missingFields);
      return new Response(JSON.stringify({ error: `Missing required fields: ${missingFields.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 创建用户
    const phoneFormatted = phone ? `+86${phone.replace(/\D/g, "")}` : undefined;
    console.log("Creating user with:", { email, hasPassword: !!password, phone: phoneFormatted });
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      phone: phoneFormatted,
    });

    if (authError || !authData.user) {
      console.error("Failed to create user:", {
        error: authError,
        message: authError?.message,
        status: authError?.status,
        email: email,
      });
      return new Response(
        JSON.stringify({
          error: authError?.message || "Failed to create user",
          details: authError?.status || authError?.code || undefined,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("User created successfully:", { user_id: authData.user.id, email: authData.user.email });

    // 创建或更新用户档案（使用 upsert 处理已存在的情况）
    const profileData = {
      user_id: authData.user.id,
      name: name.trim(),
      nickname: nickname?.trim() || null,
      role: "student",
      school_id: school_id || null,
      grade_id: grade_id || null,
      class_id: class_id || null,
    };
    
    console.log("Creating/updating profile with:", profileData);
    
    // 使用 upsert：如果 profile 已存在（可能由触发器自动创建），则更新；否则插入
    const { error: profileError2 } = await supabase
      .from("profiles")
      .upsert(profileData, {
        onConflict: "user_id",
      });

    if (profileError2) {
      console.error("Failed to create/update profile:", {
        error: profileError2,
        message: profileError2.message,
        code: profileError2.code,
        hint: profileError2.hint,
        details: profileError2.details,
        profileData: profileData,
      });
      // 如果档案创建失败，删除已创建的用户
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({
          error: profileError2.message,
          details: profileError2.code || profileError2.hint || profileError2.details || undefined,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Profile created/updated successfully for user:", authData.user.id);

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
  } catch (e: any) {
    console.error("Edge Function error:", e);
    return new Response(
      JSON.stringify({
        error: e?.message || "Unknown error",
        details: e?.stack || undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

4. 点击 **"Deploy"** 或 **"Save"** 按钮
5. 等待部署完成（通常几秒钟）

#### 方式 B：删除并重新创建（如果 Dashboard 不支持编辑）

1. 点击 `create-student` 函数
2. 点击 **"Delete"** 或 **"Remove"** 按钮，确认删除
3. 点击 **"New Function"** 或 **"Create Function"** 按钮
4. 函数名称填写：`create-student`
5. 将上面的完整代码粘贴到代码编辑器中
6. **重要**：确保 **"Verify JWT"** 设置为 **"OFF"** 或 **"false"**
7. 点击 **"Deploy"** 按钮

### 步骤 4：配置环境变量（如果尚未配置）

1. 在 Edge Function 页面，找到 `create-student` 函数
2. 点击函数名称进入详情页
3. 找到 **"Secrets"** 或 **"Environment Variables"** 部分
4. 确保以下三个环境变量已配置：
   - `SUPABASE_URL`: `https://mejrbcxhbgctiwsquqaj.supabase.co`
   - `SUPABASE_ANON_KEY`: 你的 anon key（在 Settings → API 中可以找到）
   - `SUPABASE_SERVICE_ROLE_KEY`: 你的 service_role key（在 Settings → API 中可以找到，**注意保密**）

5. 如果缺少某个变量，点击 **"Add Secret"** 或 **"Add Variable"** 添加

### 步骤 5：验证部署

1. 部署完成后，你应该看到函数状态为 **"Active"**
2. 可以点击 **"Logs"** 标签查看日志
3. 尝试在前端批量导入学生，应该可以正常工作了

## 方法 2：通过 Supabase CLI 部署

### 前置条件

1. 安装 Supabase CLI：
   ```bash
   npm install -g supabase
   ```

2. 登录 Supabase：
   ```bash
   npx supabase login
   ```

3. 链接项目：
   ```bash
   npx supabase link --project-ref mejrbcxhbgctiwsquqaj
   ```

### 部署步骤

1. 打开终端，进入项目目录：
   ```bash
   cd d:\PythonDemo\exam
   ```

2. 部署 Edge Function：
   ```bash
   npx supabase functions deploy create-student --no-verify-jwt
   ```

3. 如果提示需要设置环境变量，使用：
   ```bash
   npx supabase secrets set SUPABASE_URL=https://mejrbcxhbgctiwsquqaj.supabase.co
   npx supabase secrets set SUPABASE_ANON_KEY=你的anon_key
   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=你的service_role_key
   ```

## 关键修改说明

本次修复的关键改动：

**之前（会报错）：**
```typescript
const { error: profileError } = await supabase.from("profiles").insert(profileData);
```

**现在（已修复）：**
```typescript
const { error: profileError2 } = await supabase
  .from("profiles")
  .upsert(profileData, {
    onConflict: "user_id",
  });
```

这个改动解决了当数据库触发器自动创建 profile 时出现的重复键错误。

## 验证部署是否成功

部署完成后，可以：

1. 在前端尝试批量导入学生
2. 查看 Edge Function 的日志，确认没有错误
3. 如果导入成功，说明部署成功

## 常见问题

### Q: 部署后仍然报错怎么办？

A: 
1. 检查环境变量是否正确配置
2. 检查 "Verify JWT" 是否设置为 false
3. 查看 Edge Function 的日志，找到具体错误信息

### Q: 如何查看 Edge Function 的日志？

A: 
1. 在 Supabase Dashboard 中进入 Edge Functions
2. 点击 `create-student` 函数
3. 点击 **"Logs"** 标签
4. 查看最新的日志条目

### Q: 如何确认代码已更新？

A: 
1. 在 Edge Function 详情页，查看代码
2. 搜索 `upsert` 关键字，应该能找到 `upsert(profileData, { onConflict: "user_id" })`
3. 如果找到，说明代码已更新

## 需要帮助？

如果遇到问题，请提供：
1. Edge Function 日志中的错误信息
2. 部署时的错误提示
3. 浏览器控制台的错误信息

我会根据这些信息帮你进一步排查问题。
