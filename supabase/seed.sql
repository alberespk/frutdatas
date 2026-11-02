-- Listas de configuração iniciais do FrutDatas (classificações, categorias de
-- despesa e motivos de perda). Produtores, clientes, produtos, veículos,
-- motoristas e áreas são cadastrados pelo próprio app.
-- Rode depois da migração, no SQL Editor do Supabase.

insert into public.classificacoes (nome, ordem) values
  ('Tipo 1', 1), ('Tipo 2', 2), ('Extra', 0), ('Única', 3);

insert into public.categorias_despesa (nome, grupo) values
  ('Combustível', 'viagem'), ('Pedágio', 'viagem'), ('Alimentação', 'viagem'), ('Diária motorista', 'viagem'),
  ('Mudas', 'producao'), ('Adubo', 'producao'), ('Defensivos', 'producao'), ('Mão de obra', 'producao'),
  ('Embalagens', 'geral'), ('Manutenção veículo', 'geral'), ('Outras despesas', 'geral'),
  ('Retirada de sócio', 'retirada');

insert into public.motivos_perda (nome) values
  ('Estragou'), ('Amassou / machucou'), ('Sobra sem venda'), ('Devolução sem condição'), ('Outro');
