-- FrutDatas: esquema inicial
-- Todas as tabelas seguem o mesmo padrão para funcionar offline:
--   id gerado no celular (UUID), atualizado_em definido pelo aparelho,
--   sincronizado_em definido pelo servidor (cursor da sincronização),
--   cancelado_em em vez de apagar de verdade.


-- ---------------------------------------------------------------
-- Funções de apoio
-- ---------------------------------------------------------------

-- Última gravação vence: se chegar uma versão mais antiga que a do banco,
-- a do banco é mantida. O servidor carimba sincronizado_em.
create or replace function public.fd_controle_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.atualizado_em < old.atualizado_em then
      return old;
    end if;
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
  end if;
  new.sincronizado_em := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Usuários
-- ---------------------------------------------------------------
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text,
  papel text not null default 'campo' check (papel in ('socio', 'campo')),
  letra text unique,
  ativo boolean not null default true,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create or replace function public.eh_socio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and papel = 'socio' and ativo and cancelado_em is null
  );
$$;

-- Ao criar um login no Supabase, cria o usuário do sistema.
-- O primeiro usuário vira sócio; os demais entram como "campo".
create or replace function public.fd_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total int;
begin
  select count(*) into total from public.usuarios;
  insert into public.usuarios (id, nome, email, papel, letra)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    case when total = 0 then 'socio' else 'campo' end,
    chr(65 + total)
  );
  return new;
end;
$$;

create trigger fd_auth_novo_usuario
after insert on auth.users
for each row execute function public.fd_novo_usuario();

-- ---------------------------------------------------------------
-- Cadastros
-- ---------------------------------------------------------------
create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'produtor' check (tipo in ('produtor', 'fornecedor_destino')),
  cpf_cnpj text,
  telefone text,
  chave_pix text,
  localidade text,
  cidade text,
  observacao text,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  contato text,
  telefone text,
  prazo_dias int not null default 0 check (prazo_dias >= 0),
  observacao text,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'in_natura' check (categoria in ('in_natura', 'polpa', 'outros')),
  unidade text not null default 'caixa' check (unidade in ('caixa', 'bandeja', 'kg', 'saca', 'unidade')),
  kg_por_unidade numeric(10, 3) check (kg_por_unidade is null or kg_por_unidade > 0),
  dias_alerta int not null default 3 check (dias_alerta > 0),
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.classificacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  descricao text,
  capacidade text,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.motoristas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  forma_pagamento text not null default 'diaria' check (forma_pagamento in ('diaria', 'mensal')),
  valor_diaria numeric(12, 2) check (valor_diaria is null or valor_diaria >= 0),
  usuario_id uuid references public.usuarios (id),
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.categorias_despesa (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  grupo text not null default 'geral' check (grupo in ('viagem', 'producao', 'geral', 'retirada')),
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.motivos_perda (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

-- ---------------------------------------------------------------
-- Produção própria
-- ---------------------------------------------------------------
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tamanho_ha numeric(10, 2),
  observacao text,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.ciclos (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id),
  produto_id uuid not null references public.produtos (id),
  data_plantio date not null,
  data_encerramento date,
  situacao text not null default 'ativo' check (situacao in ('ativo', 'encerrado')),
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.colheitas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  ciclo_id uuid not null references public.ciclos (id),
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.colheita_itens (
  id uuid primary key default gen_random_uuid(),
  colheita_id uuid not null references public.colheitas (id),
  produto_id uuid not null references public.produtos (id),
  classificacao_id uuid references public.classificacoes (id),
  quantidade numeric(12, 3) not null check (quantidade > 0),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

-- ---------------------------------------------------------------
-- Viagens
-- ---------------------------------------------------------------
create table public.viagens (
  id uuid primary key default gen_random_uuid(),
  data_saida date not null,
  data_volta date,
  veiculo_id uuid references public.veiculos (id),
  motorista_id uuid references public.motoristas (id),
  destino text not null,
  km_inicial int,
  km_final int,
  situacao text not null default 'planejada' check (situacao in ('planejada', 'em_viagem', 'encerrada')),
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

-- ---------------------------------------------------------------
-- Compras
-- ---------------------------------------------------------------
create table public.compras (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  fornecedor_id uuid not null references public.fornecedores (id),
  origem text not null default 'regional' check (origem in ('regional', 'retorno')),
  viagem_id uuid references public.viagens (id),
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz,
  check (origem = 'regional' or viagem_id is not null)
);

create table public.compra_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras (id),
  produto_id uuid not null references public.produtos (id),
  classificacao_id uuid references public.classificacoes (id),
  quantidade numeric(12, 3) not null check (quantidade > 0),
  preco_unitario numeric(12, 2) not null check (preco_unitario >= 0),
  total numeric(12, 2) not null check (total >= 0),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

-- ---------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------
create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  data date not null,
  cliente_id uuid not null references public.clientes (id),
  viagem_id uuid references public.viagens (id),
  prazo_dias int not null default 0,
  vencimento date not null,
  situacao text not null default 'aberta' check (situacao in ('aberta', 'acertada')),
  data_acerto date,
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas (id),
  produto_id uuid not null references public.produtos (id),
  classificacao_id uuid references public.classificacoes (id),
  quantidade numeric(12, 3) not null check (quantidade > 0),
  preco_unitario numeric(12, 2) not null check (preco_unitario >= 0),
  quantidade_acerto numeric(12, 3),
  preco_acerto numeric(12, 2),
  quantidade_devolvida numeric(12, 3) not null default 0,
  destino_devolucao text check (destino_devolucao in ('estoque', 'perda')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

-- ---------------------------------------------------------------
-- Estoque
-- ---------------------------------------------------------------
create table public.movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  produto_id uuid not null references public.produtos (id),
  classificacao_id uuid references public.classificacoes (id),
  tipo text not null check (tipo in ('compra', 'colheita', 'retorno', 'venda', 'devolucao', 'perda', 'ajuste')),
  quantidade numeric(12, 3) not null, -- positivo = entrada, negativo = saída
  custo_unitario numeric(12, 4),
  origem_tabela text,
  origem_id uuid,
  motivo_perda_id uuid references public.motivos_perda (id),
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

-- ---------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------
create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  categoria_id uuid not null references public.categorias_despesa (id),
  descricao text,
  valor numeric(12, 2) not null check (valor >= 0),
  favorecido text,
  motorista_id uuid references public.motoristas (id),
  viagem_id uuid references public.viagens (id),
  ciclo_id uuid references public.ciclos (id),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.titulos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('pagar', 'receber')),
  origem_tabela text,
  origem_id uuid,
  fornecedor_id uuid references public.fornecedores (id),
  cliente_id uuid references public.clientes (id),
  motorista_id uuid references public.motoristas (id),
  favorecido text,
  descricao text,
  emissao date not null,
  vencimento date not null,
  valor numeric(12, 2) not null check (valor >= 0),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.movimentos_caixa (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  natureza text not null default 'baixa' check (natureza in ('baixa', 'saldo_inicial', 'retirada', 'aporte', 'ajuste')),
  valor numeric(12, 2) not null check (valor > 0),
  forma text not null default 'pix' check (forma in ('pix', 'dinheiro', 'outro')),
  descricao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create table public.baixas (
  id uuid primary key default gen_random_uuid(),
  titulo_id uuid not null references public.titulos (id),
  movimento_id uuid not null references public.movimentos_caixa (id),
  valor numeric(12, 2) not null check (valor > 0),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

-- ---------------------------------------------------------------
-- Gatilhos de sincronização, índices e segurança (RLS)
-- ---------------------------------------------------------------
do $$
declare
  t text;
  todas text[] := array[
    'usuarios', 'fornecedores', 'clientes', 'produtos', 'classificacoes', 'veiculos',
    'motoristas', 'categorias_despesa', 'motivos_perda', 'areas', 'ciclos', 'colheitas',
    'colheita_itens', 'viagens', 'compras', 'compra_itens', 'vendas', 'venda_itens',
    'movimentos_estoque', 'despesas', 'titulos', 'movimentos_caixa', 'baixas'
  ];
  -- Cadastros que todo usuário logado pode ver; só sócio altera.
  cadastros text[] := array[
    'fornecedores', 'produtos', 'classificacoes', 'veiculos', 'motoristas',
    'categorias_despesa', 'motivos_perda', 'areas', 'ciclos', 'viagens'
  ];
  -- Lançamentos que o perfil "campo" pode fazer: vê e corrige só o que lançou (até 24 h).
  lancamentos text[] := array[
    'compras', 'compra_itens', 'colheitas', 'colheita_itens', 'movimentos_estoque',
    'despesas', 'titulos', 'movimentos_caixa', 'baixas'
  ];
  -- Só sócios.
  restritas text[] := array['clientes', 'vendas', 'venda_itens'];
begin
  foreach t in array todas loop
    execute format('create trigger fd_sync before insert or update on public.%I for each row execute function public.fd_controle_sync()', t);
    execute format('create index on public.%I (sincronizado_em)', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array cadastros loop
    execute format('create policy ler on public.%I for select to authenticated using (true)', t);
    execute format('create policy incluir on public.%I for insert to authenticated with check (public.eh_socio())', t);
    execute format('create policy alterar on public.%I for update to authenticated using (public.eh_socio()) with check (public.eh_socio())', t);
  end loop;

  foreach t in array lancamentos loop
    execute format('create policy ler on public.%I for select to authenticated using (public.eh_socio() or criado_por = auth.uid())', t);
    execute format('create policy incluir on public.%I for insert to authenticated with check (criado_por = auth.uid())', t);
    execute format($p$create policy alterar on public.%I for update to authenticated
      using (public.eh_socio() or (criado_por = auth.uid() and criado_em > now() - interval '1 day'))
      with check (public.eh_socio() or criado_por = auth.uid())$p$, t);
  end loop;

  foreach t in array restritas loop
    execute format('create policy ler on public.%I for select to authenticated using (public.eh_socio())', t);
    execute format('create policy incluir on public.%I for insert to authenticated with check (public.eh_socio())', t);
    execute format('create policy alterar on public.%I for update to authenticated using (public.eh_socio()) with check (public.eh_socio())', t);
  end loop;
end;
$$;

-- O campo pode cadastrar um produtor novo na hora da compra.
create policy incluir_campo on public.fornecedores
  for insert to authenticated with check (criado_por = auth.uid() and tipo = 'produtor');

-- Usuários: cada um vê o próprio cadastro; sócio vê e altera todos.
create policy ler on public.usuarios
  for select to authenticated using (id = auth.uid() or public.eh_socio());
create policy alterar on public.usuarios
  for update to authenticated using (public.eh_socio()) with check (public.eh_socio());

-- Índices das chaves estrangeiras mais consultadas
create index on public.compras (fornecedor_id, data);
create index on public.compra_itens (compra_id);
create index on public.vendas (cliente_id, data);
create index on public.venda_itens (venda_id);
create index on public.colheita_itens (colheita_id);
create index on public.movimentos_estoque (produto_id, classificacao_id, data);
create index on public.movimentos_estoque (origem_tabela, origem_id);
create index on public.titulos (tipo, vencimento);
create index on public.titulos (origem_tabela, origem_id);
create index on public.baixas (titulo_id);
create index on public.baixas (movimento_id);
create index on public.despesas (viagem_id);
create index on public.despesas (ciclo_id);
