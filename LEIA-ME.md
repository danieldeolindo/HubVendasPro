# HubVendasPro v14 — Firebase Edition

## ⚠️ IMPORTANTE: Configure as Regras de Segurança

Antes de hospedar, você precisa aplicar as regras dos arquivos
`firestore.rules` e `storage.rules` no console do Firebase.

---

## 1. Regras do Firestore

1. Acesse: https://console.firebase.google.com
2. Seu projeto → Firestore Database → aba "Regras"
3. Apague o conteúdo atual e cole o conteúdo do arquivo `firestore.rules`
4. Clique em "Publicar"

## 2. Regras do Storage

1. Acesse: https://console.firebase.google.com
2. Seu projeto → Storage → aba "Regras"
3. Apague o conteúdo atual e cole o conteúdo do arquivo `storage.rules`
4. Clique em "Publicar"

---

## 3. Como hospedar (opções)

### Opção A — Firebase Hosting (recomendado, gratuito)

1. Instale o Firebase CLI:
   ```
   npm install -g firebase-tools
   ```
2. Faça login:
   ```
   firebase login
   ```
3. Na pasta do projeto, inicie:
   ```
   firebase init hosting
   ```
   - Selecione seu projeto `hubvendaspro`
   - Public directory: `.` (ponto, pasta atual)
   - Single-page app: `No`
   - Overwrite index.html: `No`

4. Faça o deploy:
   ```
   firebase deploy --only hosting
   ```

Pronto! Seu app estará em: `https://hubvendaspro.web.app`

### Opção B — Netlify (arrastar e soltar)

1. Acesse https://app.netlify.com
2. Arraste a pasta do projeto para a área de upload
3. Pronto, você recebe um link público na hora

### Opção C — Vercel

1. Instale: `npm install -g vercel`
2. Na pasta: `vercel`
3. Siga as instruções

---

## 4. Estrutura dos dados no Firestore

```
users/
  {uid}/
    config/
      geral → { lojaConfig, tema, menuOrdem }
    produtos/
      {id} → { id, skuId, nome, preco, categoria, fotoKey }
    historico/
      {id} → { id, itens, total, data, hora, ... }
    clientes/
      {id} → { id, nome, telefone, cpf, email, endereco }
```

---

## 5. O que sincroniza entre dispositivos

✅ Login / Conta
✅ Produtos
✅ Histórico de vendas
✅ Clientes
✅ Configurações (tema, nome da loja, cor, fonte, ordem do menu)
✅ Foto de perfil (avatar)

❌ Fotos de produtos (ficam no IndexedDB local por limitação de custo do Storage)
   → Para sincronizar fotos entre dispositivos, seria necessário Storage pago.
   → Na prática: cadastre produtos com foto no dispositivo principal.
