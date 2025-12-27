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
      console.error("Failed to create user:", authError);
      return new Response(
        JSON.stringify({
          error: authError?.message || "Failed to create user",
          details: authError?.status || undefined,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 创建用户档案
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: authData.user.id,
      name,
      nickname: nickname || null,
      role: "student",
      school_id: school_id || null,
      grade_id: grade_id || null,
      class_id: class_id || null,
    });

    if (profileError) {
      console.error("Failed to create profile:", profileError);
      // 如果档案创建失败，删除已创建的用户
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({
          error: profileError.message,
          details: profileError.code || profileError.hint || undefined,
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
