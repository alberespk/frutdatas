-- A função do gatilho de novo usuário não deve ser chamada pela API.
revoke execute on function public.fd_novo_usuario() from public, anon, authenticated;
-- eh_socio() é usada nas regras de acesso; só usuários logados precisam dela.
revoke execute on function public.eh_socio() from public, anon;
grant execute on function public.eh_socio() to authenticated;
