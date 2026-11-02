-- Dados de exemplo (fictícios) para testes do FrutDatas.
-- Rode depois da migração, no SQL Editor do Supabase.

insert into public.classificacoes (nome, ordem) values
  ('Tipo 1', 1), ('Tipo 2', 2), ('Extra', 0), ('Única', 3);

insert into public.produtos (nome, categoria, unidade, kg_por_unidade, dias_alerta) values
  ('Morango', 'in_natura', 'bandeja', 0.250, 3),
  ('Morango (caixa)', 'in_natura', 'caixa', 4.000, 3),
  ('Maracujá', 'in_natura', 'saca', 12.000, 7),
  ('Maracujá (caixa)', 'in_natura', 'caixa', 8.000, 7),
  ('Tomate', 'in_natura', 'caixa', 20.000, 5),
  ('Polpa de cajá', 'polpa', 'kg', 1.000, 30),
  ('Polpa de goiaba', 'polpa', 'kg', 1.000, 30),
  ('Banana prata', 'in_natura', 'caixa', 20.000, 5),
  ('Abacaxi', 'in_natura', 'unidade', 1.500, 7);

insert into public.fornecedores (nome, tipo, cpf_cnpj, telefone, chave_pix, localidade, cidade) values
  ('José Aparecido da Silva', 'produtor', '123.456.789-00', '(38) 99901-0001', '(38) 99901-0001', 'Comunidade do Tombo', 'Datas'),
  ('Maria das Graças Souza', 'produtor', '234.567.890-11', '(38) 99901-0002', 'maria.gracas@exemplo.com', 'Córrego do Batista', 'Datas'),
  ('Antônio Ferreira Lima', 'produtor', '345.678.901-22', '(38) 99901-0003', '345.678.901-22', 'Vau', 'Datas'),
  ('Sebastião Rodrigues', 'produtor', null, '(38) 99901-0004', null, 'Palmital', 'Datas'),
  ('Sítio Boa Esperança (Joaquim e Rita)', 'produtor', '456.789.012-33', '(38) 99901-0005', '(38) 99901-0005', 'Mendanha', 'Diamantina'),
  ('Polpas Norte Minas Ltda', 'fornecedor_destino', '12.345.678/0001-90', '(38) 3221-0000', '12.345.678/0001-90', null, 'Montes Claros'),
  ('Box 42 CEASA - Frutas Gerais', 'fornecedor_destino', '23.456.789/0001-01', '(31) 3399-0000', '23.456.789/0001-01', 'CEASA Contagem', 'Contagem');

insert into public.clientes (nome, cidade, contato, telefone, prazo_dias) values
  ('Sacolão Bom Preço', 'Montes Claros', 'Carlos', '(38) 99902-0001', 7),
  ('Mercado Central Frutas', 'Montes Claros', 'Fernanda', '(38) 99902-0002', 14),
  ('Box 17 CEASA - Hortifruti Minas', 'Contagem', 'Roberto', '(31) 99902-0003', 10),
  ('Box 88 CEASA - Silva & Filhos', 'Contagem', 'Paulo', '(31) 99902-0004', 7),
  ('Quitanda da Praça', 'Diamantina', 'Lúcia', '(38) 99902-0005', 0),
  ('Supermercado Serra Azul', 'Curvelo', 'Márcio', '(38) 99902-0006', 21);

insert into public.veiculos (placa, descricao, capacidade) values
  ('ABC1D23', 'Caminhão baú 3/4', '4 toneladas'),
  ('XYZ9F87', 'Caminhonete', '1 tonelada');

insert into public.motoristas (nome, telefone, forma_pagamento, valor_diaria) values
  ('João Batista Pereira', '(38) 99903-0001', 'diaria', 150.00),
  ('Wellington Santos', '(38) 99903-0002', 'mensal', null);

insert into public.categorias_despesa (nome, grupo) values
  ('Combustível', 'viagem'), ('Pedágio', 'viagem'), ('Alimentação', 'viagem'), ('Diária motorista', 'viagem'),
  ('Mudas', 'producao'), ('Adubo', 'producao'), ('Defensivos', 'producao'), ('Mão de obra', 'producao'),
  ('Embalagens', 'geral'), ('Manutenção veículo', 'geral'), ('Outras despesas', 'geral'),
  ('Retirada de sócio', 'retirada');

insert into public.motivos_perda (nome) values
  ('Estragou'), ('Amassou / machucou'), ('Sobra sem venda'), ('Devolução sem condição'), ('Outro');

insert into public.areas (nome, tamanho_ha, observacao) values
  ('Talhão 1 - Morango', 0.50, 'Estufa perto da casa'),
  ('Talhão 2 - Maracujá', 1.20, 'Espaldeira');
