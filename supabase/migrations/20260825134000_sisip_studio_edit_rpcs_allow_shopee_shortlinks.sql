-- Keep the deployed edit RPC aligned with the product constraint and client:
-- standard Shopee Indonesia URLs and Shopee Affiliate short links are valid.
-- Earlier migrations define the final intended body for new environments. This
-- compact repair updates the already-deployed function definition in place.

do $$
declare
  v_definition text;
  v_old_condition text := $condition$if v_affiliate_url !~ E'^https://([a-z0-9-]+\\.)*shopee\\.co\\.id(/|$)' then$condition$;
  v_new_condition text := $condition$if v_affiliate_url !~ E'^https://([a-z0-9-]+\\.)*shopee\\.co\\.id(/|$)'
    and v_affiliate_url !~ E'^https://shope\\.ee(/|$)' then$condition$;
begin
  select pg_get_functiondef('public.update_sisip_product(uuid,text,text,integer,text[],text[],text,text,jsonb)'::regprocedure)
  into v_definition;

  if position(v_new_condition in v_definition) = 0 then
    v_definition := replace(v_definition, v_old_condition, v_new_condition);
    if position(v_new_condition in v_definition) = 0 then
      raise exception 'Tidak dapat memperbarui validasi link affiliate produk.';
    end if;
    execute v_definition;
  end if;
end;
$$;
