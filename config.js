/*
 * Safe browser configuration for SISIP.
 * The publishable key is designed to be visible in a browser; RLS in Supabase
 * protects the database. Never put the service_role key or database password here.
 */
window.SISIP_CONFIG = {
  supabaseUrl: "https://rbvrlfmsvmwjkisbwuim.supabase.co",
  supabasePublishableKey: "sb_publishable_TmjlzoV6t2vaWCcju1e5-g_53w_Tlvj",
  siteUrl: "https://sisip-fashion.pages.dev",
  adminEmail: "albarifirdaus209@gmail.com"
};
