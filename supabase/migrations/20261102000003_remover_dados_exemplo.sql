-- Remove os cadastros de exemplo (fictícios) do seed inicial.
-- Marca como cancelados (em vez de apagar) para que os celulares que já
-- baixaram esses registros também os removam na próxima sincronização.
-- Só atinge os nomes exatos do exemplo e só se não tiverem lançamentos.

update public.fornecedores f set cancelado_em = now(), atualizado_em = now()
where cancelado_em is null and nome in (
  'José Aparecido da Silva', 'Maria das Graças Souza', 'Antônio Ferreira Lima', 'Sebastião Rodrigues',
  'Sítio Boa Esperança (Joaquim e Rita)', 'Polpas Norte Minas Ltda', 'Box 42 CEASA - Frutas Gerais')
  and not exists (select 1 from public.compras c where c.fornecedor_id = f.id);

update public.clientes k set cancelado_em = now(), atualizado_em = now()
where cancelado_em is null and nome in (
  'Sacolão Bom Preço', 'Mercado Central Frutas', 'Box 17 CEASA - Hortifruti Minas',
  'Box 88 CEASA - Silva & Filhos', 'Quitanda da Praça', 'Supermercado Serra Azul')
  and not exists (select 1 from public.vendas v where v.cliente_id = k.id);

update public.produtos p set cancelado_em = now(), atualizado_em = now()
where cancelado_em is null and nome in (
  'Morango', 'Morango (caixa)', 'Maracujá', 'Maracujá (caixa)', 'Tomate',
  'Polpa de cajá', 'Polpa de goiaba', 'Banana prata', 'Abacaxi')
  and not exists (select 1 from public.movimentos_estoque m where m.produto_id = p.id)
  and not exists (select 1 from public.ciclos c where c.produto_id = p.id);

update public.veiculos v set cancelado_em = now(), atualizado_em = now()
where cancelado_em is null and placa in ('ABC1D23', 'XYZ9F87')
  and not exists (select 1 from public.viagens x where x.veiculo_id = v.id);

update public.motoristas m set cancelado_em = now(), atualizado_em = now()
where cancelado_em is null and nome in ('João Batista Pereira', 'Wellington Santos')
  and not exists (select 1 from public.viagens x where x.motorista_id = m.id)
  and not exists (select 1 from public.despesas d where d.motorista_id = m.id);

update public.areas a set cancelado_em = now(), atualizado_em = now()
where cancelado_em is null and nome in ('Talhão 1 - Morango', 'Talhão 2 - Maracujá')
  and not exists (select 1 from public.ciclos c where c.area_id = a.id);
