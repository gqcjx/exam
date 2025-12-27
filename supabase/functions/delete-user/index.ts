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
      return new Response(JSON.stringify({ error: "只有管理员或教师可以删除学生账号" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 创建 Supabase 客户端（使用 service role key）用于删除用户
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const payload = await req.json();
    const { user_id } = payload;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing required field: user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 检查要删除的用户是否是学生
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user_id)
      .single();

    if (targetProfileError || !targetProfile) {
      return new Response(JSON.stringify({ error: "用户不存在" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetProfile.role !== "student") {
      return new Response(JSON.stringify({ error: "只能删除学生账号" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 删除 profile（会触发级联删除）
    const { error: deleteProfileError } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", user_id);

    if (deleteProfileError) {
      console.error("Failed to delete profile:", deleteProfileError);
      return new Response(
        JSON.stringify({
          error: deleteProfileError.message,
          details: deleteProfileError.code || deleteProfileError.hint || undefined,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 删除 auth user
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user_id);

    if (deleteAuthError) {
      console.error("Failed to delete auth user:", deleteAuthError);
      // 即使 auth user 删除失败，profile 已经删除，返回成功但记录警告
      return new Response(
        JSON.stringify({
          success: true,
          warning: "用户档案已删除，但认证用户删除失败，可能需要手动清理",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("User deleted successfully:", user_id);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: user_id,
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
