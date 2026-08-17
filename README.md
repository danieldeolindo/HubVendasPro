# HubVendasPro

Sistema de gestão comercial para pequenos negócios, com cadastro de produtos, clientes, controle de vendas, dashboard, relatórios e personalização da identidade visual da loja.

O projeto foi pensado para funcionar como uma aplicação web estática com autenticação e armazenamento em Supabase, sem necessidade de backend tradicional ou ferramenta de build.

## Visão geral

O HubVendasPro permite:

- cadastrar e gerenciar produtos
- registrar clientes
- criar vendas com múltiplas formas de pagamento
- aplicar descontos por percentual ou valor fixo
- acompanhar histórico de transações
- visualizar KPIs e relatórios do negócio
- exportar comprovantes e relatórios em PDF/CSV
- personalizar nome da loja, tema, cor e ordem do menu
- autenticar usuários por email e senha

## Stack

- HTML5
- CSS3
- JavaScript puro
- Supabase Auth
- Supabase Database
- Supabase Storage (opcional para fotos)
- Hospedagem estática em Netlify, Vercel, Firebase Hosting ou GitHub Pages

## Estrutura do repositório

- [index.html](index.html): estrutura principal da interface
- [style.css](style.css): estilos visuais do sistema
- [script.js](script.js): lógica da aplicação, autenticação, regras de negócio e integração com Supabase
- [schema.sql](schema.sql): schema de banco de dados do Supabase
- [favicon/logo.png](favicon/logo.png): ícone do sistema
- [LICENSE](LICENSE): licença do projeto
- [README.md](README.md): documentação do projeto

## Requisitos

Antes de executar a aplicação, você precisará de:

1. uma conta no Supabase
2. um projeto Supabase novo
3. acesso ao SQL Editor do projeto
4. uma hospedagem estática para servir o front-end

## Configuração inicial

### 1) Clone o projeto

```bash
git clone https://github.com/seu-usuario/HubVendasPro.git
cd HubVendasPro
```

### 2) Crie o projeto no Supabase

- acesse https://supabase.com
- crie um novo projeto
- copie a URL do projeto e a chave anônima

### 3) Atualize a configuração do Supabase

No arquivo [script.js](script.js), ajuste os valores abaixo:

```js
const SUPABASE_URL = "https://SEU_PROJETO.supabase.co";
const SUPABASE_KEY = "SUA_ANON_KEY_AQUI";
```

> Importante: nunca comite credenciais reais em repositórios públicos. Use apenas valores do seu projeto e mantenha esse arquivo fora de ambientes compartilhados.

### 4) Crie as tabelas no banco

Execute o conteúdo do arquivo [schema.sql](schema.sql) no SQL Editor do Supabase.

Esse script cria as tabelas:

- produtos
- clientes
- historico
- config

Também habilita políticas de segurança para que cada usuário veja apenas os seus dados.

## Funcionalidades principais

### Autenticação

- cadastro de usuários
- login com email e senha
- logout
- recuperação de sessão automaticamente

### Gestão comercial

- cadastro de produtos com nome, preço, categoria e imagem
- edição e exclusão de itens
- busca por categoria e nome
- gerenciamento de clientes com dados opcionais

### Vendas

- carrinho de compras dinâmico
- cálculo de subtotal, desconto e total final
- formas de pagamento: dinheiro, cartão e pix
- divisão do pagamento por parcela ou valor
- cliente opcional por venda

### Dashboard e relatórios

- KPIs por período
- gráfico de receitas por semana
- comparação de formas de pagamento
- produtos mais vendidos
- exportação em CSV e PDF

### Personalização

- nome da loja
- cor principal da identidade visual
- tema claro/escuro
- ordem do menu lateral
- avatar da loja

## Publicação em produção

### Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```

### Netlify

1. acesse https://app.netlify.com
2. arraste a pasta do projeto para a área de upload
3. aguarde a publicação

### Vercel

```bash
npm install -g vercel
vercel
```

## Segurança e boas práticas

- nunca exponha a chave secreta do Supabase em código público
- mantenha políticas RLS ativas no banco
- valide dados no front-end, mas também no banco
- faça backups periódicos das informações importantes
- revise as permissões de acesso antes de publicar em produção

## Observações importantes

Este projeto é um front-end estático e depende de um banco externo para persistência. A autenticação e os dados do negócio vivem no Supabase, enquanto o HTML/CSS/JavaScript apenas montam a interface e a experiência do usuário.

Por isso, o processamento principal do sistema ocorre no navegador, mas a fonte de verdade fica no banco de dados.

## Licença

Este projeto está licenciado sob a licença [LICENSE](LICENSE).

## Autor

Desenvolvido para uso comercial e gestão de pequenos negócios.

Se quiser, também posso criar uma versão com:

- README em inglês
- documentação técnica mais aprofundada
- guia de deploy em produção
- checklist de segurança para GitHub
- estrutura de arquivos separada por módulos
