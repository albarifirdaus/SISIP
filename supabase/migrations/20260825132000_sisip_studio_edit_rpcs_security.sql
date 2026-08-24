-- The edit RPCs use the authenticated caller's existing admin RLS policies.
-- This avoids extending privileges beyond the already-authorized SISIP admin.

alter function public.update_sisip_look(uuid, text, text, text[], text, uuid[], text)
  security invoker;

alter function public.update_sisip_product(uuid, text, text, integer, text[], text[], text, text, jsonb)
  security invoker;
