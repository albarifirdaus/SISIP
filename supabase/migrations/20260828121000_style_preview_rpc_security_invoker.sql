-- The admin RLS policy and table grants already authorize this update, so the
-- preview RPC does not need elevated privileges.

alter function public.set_comootd_style_previews(jsonb)
  security invoker;

