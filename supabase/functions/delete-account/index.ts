import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Metode tidak didukung." });

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Sesi akun tidak ditemukan." });

  let payload: { confirmation?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Permintaan belum valid." });
  }
  if (String(payload.confirmation || "").trim().toUpperCase() !== "HAPUS AKUN") {
    return json(400, { error: "Ketik HAPUS AKUN untuk mengonfirmasi." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(500, { error: "Layanan penghapusan akun belum dikonfigurasi." });

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json(401, { error: "Sesi akun sudah tidak berlaku. Silakan masuk kembali." });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminEmail = (Deno.env.get("COMOOTD_ADMIN_EMAIL") || "albarifirdaus209@gmail.com").trim().toLowerCase();
  if (String(user.email || "").trim().toLowerCase() === adminEmail) {
    return json(409, { code: "MANAGED_ACCOUNT", error: "Akun admin harus diproses manual agar operasional COMOOTD tetap aman." });
  }

  const [{ data: curator }, { count: ownedLooks, error: lookCheckError }] = await Promise.all([
    admin.from("curator_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
    admin.from("looks").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
  ]);
  if (lookCheckError) return json(500, { error: "Status kepemilikan konten belum dapat diperiksa." });
  if (curator || Number(ownedLooks || 0) > 0) {
    return json(409, {
      code: "MANAGED_ACCOUNT",
      error: "Akun Curator memiliki konten publik. Hubungi comootd@gmail.com agar konten dan link affiliate diproses dengan aman.",
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("COMOOTD account deletion failed", { userId: user.id, message: deleteError.message });
    return json(500, { error: "Akun belum dapat dihapus otomatis. Hubungi comootd@gmail.com untuk bantuan." });
  }

  return json(200, { deleted: true });
});
