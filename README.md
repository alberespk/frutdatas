# FrutDatas

Sistema de gestão da FrutDatas (hortifrúti, Datas/MG): compras de produtores, produção própria,
estoque, vendas com romaneio, viagens e financeiro. Feito para o celular e para funcionar **sem internet**.

- **Interface:** Next.js (exportação estática) + Tailwind, instalável como app (PWA).
- **Banco na nuvem:** Supabase (Postgres + login + regras de acesso por perfil).
- **Banco no celular:** IndexedDB (Dexie). Tudo é gravado primeiro no aparelho e sobe quando houver sinal.

## Etapas

| Etapa | Conteúdo | Situação |
| --- | --- | --- |
| 1 | Base offline, login, banco completo, cadastros | ✅ |
| 2 | Compras, produção própria (ciclos, despesas, colheitas) e despesas | ✅ |
| 3 | Estoque (saldo, custo médio, parados, perdas, ajuste de contagem) | ✅ |
| 4 | Vendas e romaneio | |
| 5 | Viagens/fretes | |
| 6 | Financeiro | |
| 7 | Painel | |

## Como rodar

```bash
cp .env.example .env.local   # preencha com URL e chave pública do Supabase
npm install
npm run dev                  # http://localhost:3000 (sem modo offline)
npm run build && npm start   # versão final, com modo offline
npm test                     # testes do banco, da sincronização e dos formatos
```

### Banco de dados

As migrações ficam em `supabase/migrations/` e os dados de exemplo (fictícios) em `supabase/seed.sql`.
Num projeto Supabase novo, rode as migrações em ordem no SQL Editor e depois o `seed.sql`.

### Usuários

1. No Supabase: **Authentication → Users → Add user → Create new user**, com e-mail, senha e “Auto Confirm User”.
2. O **primeiro** usuário criado vira **sócio** (letra de romaneio A). Os seguintes entram como **campo** (B, C…).
3. Um sócio muda nome, perfil e letra em **Mais → Usuários**.

### Publicar (AWS Amplify)

O repositório já traz `amplify.yml` (build estático na pasta `out`, Node 22) e `customHttp.yml`
(o service worker nunca fica preso em cache).

1. No console do Amplify: **Create new app → GitHub →** repositório `frutdatas`, branch `main`.
2. Em **Advanced settings → Environment variables**, crie `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
3. Salve e faça o deploy. Se o Amplify detectar Next.js com servidor (SSR), troque em
   **App settings → General → Platform** para **Web** (site estático).
4. Cada merge na `main` publica uma versão nova sozinho.

## Como funciona o modo offline

1. Cada registro nasce no celular com um código único (UUID) e entra numa fila local.
2. Com internet, o app envia a fila (na ordem em que foi lançada) e baixa o que mudou desde a última vez,
   usando o carimbo `sincronizado_em` que o servidor coloca em cada gravação.
3. Se o mesmo registro for alterado em dois aparelhos, vale a alteração mais recente (`atualizado_em`).
4. Nada é apagado: cancelar marca `cancelado_em`; cadastros são desativados (`ativo = false`).
5. Saldos (estoque, caixa) serão sempre calculados a partir dos movimentos.

O primeiro login precisa de internet. Depois, o perfil fica guardado e o app abre sem sinal.

## Perfis

| Ação | Sócio | Campo |
| --- | --- | --- |
| Lançar compra, colheita, perda, despesa de viagem | Sim | Sim (vê só o que lançou) |
| Vendas, financeiro, painel | Sim | Não |
| Cadastros e usuários | Sim | Só consulta produtores e produtos |

As regras valem no banco (RLS), não só na tela.
