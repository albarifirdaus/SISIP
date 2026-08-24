-- Correct a temporary typo in the deployed product-edit RPC: Shopee Affiliate
-- short links use shope.ee, not shopee.ee.

do $$
declare
  v_definition text;
  v_wrong_condition text := $condition$if v_affiliate_url !~ E'^https://([a-z0-9-]+\\.)*shopee\\.co\\.id(/|$)'
    and v_affiliate_url !~ E'^https://shopee\\.ee(/|$)' then$condition$;
  v_correct_condition text := $condition$if v_affiliate_url !~ E'^https://([a-z0-9-]+\\.)*shopee\\.co\\.id(/|$)'
    and v_affiliate_url !~ E'^https://shope\\.ee(/|$)' then$condition$;
begin
  select pg_get_functiondef('public.update_sisip_product(uuid,text,text,integer,text[],text[],text,text,jsonb)'::regprocedure)
  into v_definition;

  if position(v_correct_condition in v_definition) = 0 then
    v_definition := replace(v_definition, v_wrong_condition, v_correct_condition);
    if position(v_correct_condition in v_definition) = 0 then
      raise exception 'Tidak dapat memperbaiki validasi short link Shopee.';
    end if;
    execute v_definition;
  end if;
end;
$$;
