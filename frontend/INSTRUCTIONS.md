# CrossDome Frontend - Instruções de Instalação e Uso

**Autor:** Martiela Vaz de Freitas  
**Data:**  Last modified in February, 2026.

---
## Pré-requisitos

Antes de iniciar, certifique-se de ter os seguintes componentes instalados em seu sistema:

### Software Necessário

| Componente | Versão Mínima | Propósito |
|------------|---------------|-----------|
| Node.js | 18.0.0 ou superior | Runtime JavaScript para executar o frontend |
| pnpm | 8.0.0 ou superior | Gerenciador de pacotes (alternativa: npm ou yarn) |
| Python | 3.8 ou superior | Backend Flask para API CrossDome |
| pip | 20.0 ou superior | Gerenciador de pacotes Python |

### Backend CrossDome

A interface frontend requer que o **backend Flask** do CrossDome esteja em execução. O backend fornece os endpoints de API necessários para submissão de análises e recuperação de resultados.

---

## Estrutura do Projeto

O projeto frontend está organizado da seguinte forma:

```
crossdome-frontend/
├── client/
│   ├── public/              # Arquivos estáticos
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis (shadcn/ui)
│   │   ├── pages/           # Páginas da aplicação
│   │   │   ├── Home.tsx     # Página principal com formulário de análise
│   │   │   ├── Results.tsx  # Página de resultados
│   │   │   └── NotFound.tsx # Página 404
│   │   ├── contexts/        # Contextos React (tema, etc.)
│   │   ├── hooks/           # Hooks customizados
│   │   ├── lib/             # Utilitários
│   │   ├── App.tsx          # Componente raiz com rotas
│   │   ├── main.tsx         # Ponto de entrada React
│   │   └── index.css        # Estilos globais e tema
│   └── index.html           # Template HTML
├── server/                  # Servidor Express para servir arquivos estáticos
├── package.json             # Dependências e scripts
├── vite.config.ts           # Configuração do Vite
├── tailwind.config.ts       # Configuração do Tailwind CSS
└── INSTRUCTIONS.md          # Este documento
```

---

## Instalação

### Passo 1: Configurar o Backend CrossDome

Antes de executar o frontend, você precisa iniciar o backend Flask.

#### 1.1. Navegar até o Diretório do Backend

```bash
cd /path/to/CrossDome-P-main
```

#### 1.2. Criar e Ativar Ambiente Virtual Python

```bash
python3 -m venv venv
source venv/bin/activate
```

#### 1.3. Instalar Dependências Python

```bash
pip install -r requirements.txt
```

#### 1.4. Configurar Variáveis de Ambiente

Crie um arquivo `.env` no diretório raiz do backend com as seguintes configurações:

```env
DATABASE_URL=sqlite:///crossdome.db
FLASK_ENV=development
```

#### 1.5. Iniciar o Servidor Flask

```bash
cd app
python main.py
```

O backend estará disponível em `http://localhost:5000`.

**Nota:** Mantenha este terminal aberto enquanto usa o frontend.

---

### Passo 2: Configurar o Frontend

#### 2.1. Navegar até o Diretório do Frontend

Abra um **novo terminal** e navegue até o diretório do frontend:

```bash
cd /path/to/crossdome-frontend
```

#### 2.2. Instalar Dependências do Frontend

Execute o seguinte comando para instalar todas as dependências necessárias:

```bash
pnpm install
```

**Alternativas:**
- Se você preferir usar npm: `npm install`
- Se você preferir usar yarn: `yarn install`

#### 2.3. Iniciar o Servidor de Desenvolvimento

```bash
pnpm dev
```

O servidor de desenvolvimento Vite será iniciado e a aplicação estará disponível em:

```
http://localhost:3000
```

Abra este endereço em seu navegador para acessar a interface.

---

## Uso da Interface

### Página Principal (Home)

A página principal apresenta um formulário elegante para submissão de análises de cross-reatividade.

#### Seleção do Modo de Análise

A interface oferece dois modos de operação:

1. **Analyze**: Analisa peptídeos contra um alelo HLA específico
2. **Compare**: Compara dois conjuntos de peptídeos entre si

#### Entrada de Dados - Subject Peptides

Você pode fornecer os peptídeos de duas formas:

**Opção 1: Entrada de Texto**
- Insira peptídeos diretamente no campo de texto
- Separe múltiplos peptídeos por vírgula
- Exemplo: `LLFGYPVYV, ACDEFGHIK, YLLPAIVHI`

**Opção 2: Upload de Arquivo**
- Clique em "Arquivo (.csv ou .txt)"
- Selecione um arquivo contendo peptídeos
- Formatos aceitos: `.csv` ou `.txt`

#### Entrada de Dados - Target

**Para o modo "Analyze":**
- Selecione um alelo HLA da lista dropdown
- Mais de 70 alelos HLA disponíveis
- Exemplo: `HLA-A*02:01`

**Para o modo "Compare":**
- Forneça um segundo conjunto de peptídeos
- Use as mesmas opções de entrada (texto ou arquivo)

#### Submissão da Análise

Após preencher todos os campos obrigatórios:

1. Clique no botão **"Iniciar Análise"**
2. Aguarde o processamento (indicador de loading será exibido)
3. Você será automaticamente redirecionado para a página de resultados

---

### Página de Resultados

A página de resultados exibe os dados da análise em uma tabela elegante com efeito glassmorphic.

#### Informações Exibidas

A tabela de resultados apresenta as seguintes colunas:

| Coluna | Descrição |
|--------|-----------|
| **Rank** | Classificação do resultado |
| **Query** | Peptídeo de consulta (subject) |
| **Subject** | Peptídeo alvo encontrado |
| **Score** | Pontuação de relacionamento |
| **Z-Score** | Pontuação Z estatística |
| **P-Value** | Valor de significância estatística |
| **Affinity** | Afinidade MHCflurry |
| **Immunogenicity** | Pontuação de imunogenicidade |
| **Resource** | Fonte do dado |

#### Funcionalidades da Página de Resultados

**Exportação de Dados:**
- Clique no botão **"Exportar CSV"** no canto superior direito
- O arquivo será baixado automaticamente com o nome `crossdome-results-{jobId}.csv`

**Nova Análise:**
- Clique no botão **"Nova Análise"** para retornar à página principal
- Seus dados anteriores não serão preservados

---

## Configuração do Backend (URL da API)

Por padrão, o frontend está configurado para se conectar ao backend em `http://localhost:5000`. Se o seu backend estiver em um endereço diferente, você precisará atualizar as URLs nos seguintes arquivos:

### Atualizar URL em Home.tsx

Abra o arquivo `/path/to/crossdome-frontend/client/src/pages/Home.tsx` e localize a linha:

```typescript
const response = await fetch("http://localhost:5000/api/v1/submitform", {
```

Substitua `http://localhost:5000` pelo endereço correto do seu backend.

### Atualizar URL em Results.tsx

Abra o arquivo `/path/to/crossdome-frontend/client/src/pages/Results.tsx` e localize as linhas:

```typescript
const analysisResponse = await fetch(`http://localhost:5000/api/v1/job/${jobId}/results`);
```

```typescript
const resultsResponse = await fetch(`http://localhost:5000/api/v1/job/${jobId}/results-chunked?start=0&end=100`);
```

Substitua `http://localhost:5000` pelo endereço correto do seu backend em ambas as linhas.

---

## Personalização

### Alterar Cores do Tema

As cores do tema estão definidas no arquivo `/path/to/crossdome-frontend/client/src/index.css`. Para personalizar a paleta de cores:

1. Abra o arquivo `client/src/index.css`
2. Localize a seção `:root` com as variáveis de cor
3. Modifique os valores OKLCH conforme desejado

Exemplo de variáveis principais:

```css
:root {
  --primary: oklch(0.65 0.15 250);        /* Azul brilhante */
  --accent: oklch(0.55 0.12 270);         /* Lavanda */
  --background: oklch(0.15 0.04 250);     /* Azul profundo */
  --foreground: oklch(0.95 0.01 250);     /* Off-white */
}
```

### Alterar Tipografia

As fontes estão definidas no arquivo `client/index.html`. Para usar fontes diferentes:

1. Abra `client/index.html`
2. Modifique a importação do Google Fonts
3. Atualize as variáveis de fonte em `client/src/index.css`:

```css
@theme inline {
  --font-display: "Outfit", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-mono: "Fira Code", monospace;
}
```

---

## Solução de Problemas

### Problema: Backend não está respondendo

**Sintoma:** Erro "Erro ao conectar com o servidor" ao submeter análise.

**Solução:**
1. Verifique se o backend Flask está em execução
2. Confirme que o backend está acessível em `http://localhost:5000`
3. Verifique o console do backend para mensagens de erro
4. Certifique-se de que as configurações de CORS estão corretas no backend

### Problema: Página de resultados não carrega

**Sintoma:** Erro ao carregar resultados ou página em branco.

**Solução:**
1. Verifique se o Job ID é válido
2. Confirme que o backend processou a análise com sucesso
3. Abra o console do navegador (F12) para ver mensagens de erro detalhadas
4. Verifique se os endpoints `/api/v1/job/{jobId}/results` e `/api/v1/job/{jobId}/results-chunked` estão funcionando

### Problema: Estilos não estão sendo aplicados

**Sintoma:** Interface aparece sem estilização ou com aparência quebrada.

**Solução:**
1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Reinicie o servidor de desenvolvimento: `pnpm dev`
3. Verifique se todas as dependências foram instaladas corretamente
4. Execute `pnpm install` novamente se necessário

### Problema: Fontes não estão carregando

**Sintoma:** Texto aparece com fontes padrão do sistema.

**Solução:**
1. Verifique sua conexão com a internet (fontes são carregadas do Google Fonts)
2. Confirme que o link do Google Fonts está correto em `client/index.html`
3. Verifique o console do navegador para erros de carregamento de recursos

---

## Build para Produção

Para criar uma versão otimizada para produção:

### Passo 1: Gerar Build

```bash
cd /path/to/crossdome-frontend
pnpm build
```

Este comando irá:
- Compilar o código TypeScript
- Otimizar e minificar os arquivos
- Gerar os arquivos estáticos na pasta `dist/public`

### Passo 2: Servir os Arquivos Estáticos

Você pode servir os arquivos estáticos usando qualquer servidor web. Exemplo com o servidor Node.js incluído:

```bash
pnpm start
```

O servidor estará disponível em `http://localhost:3000`.

**Alternativa com Nginx:**

Configure o Nginx para servir a pasta `dist/public`:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;
    
    root /path/to/crossdome-frontend/dist/public;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Tecnologias Utilizadas

A nova interface foi construída com as seguintes tecnologias modernas:

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **React** | 19.2.1 | Framework JavaScript para construção da UI |
| **TypeScript** | 5.6.3 | Superset tipado do JavaScript |
| **Vite** | 7.1.7 | Build tool e servidor de desenvolvimento |
| **Tailwind CSS** | 4.1.14 | Framework CSS utilitário |
| **shadcn/ui** | - | Biblioteca de componentes React |
| **Wouter** | 3.3.5 | Roteador leve para React |
| **Lucide React** | 0.453.0 | Biblioteca de ícones |
| **Sonner** | 2.0.7 | Sistema de notificações toast |

---

## Arquitetura da Aplicação

### Fluxo de Dados

O fluxo de dados da aplicação segue o seguinte padrão:

1. **Usuário submete formulário** → Dados são enviados via POST para `/api/v1/submitform`
2. **Backend cria Job** → Retorna `job_id` para o frontend
3. **Frontend navega para Results** → Usa `job_id` na URL
4. **Results solicita análise** → GET para `/api/v1/job/{jobId}/results`
5. **Backend processa análise** → Retorna resumo com `total_rows`
6. **Results carrega dados** → GET para `/api/v1/job/{jobId}/results-chunked`
7. **Dados são exibidos** → Tabela renderiza os resultados

### Gerenciamento de Estado

A aplicação utiliza **React Hooks** para gerenciamento de estado:

- `useState`: Estado local de componentes (formulários, loading, etc.)
- `useEffect`: Efeitos colaterais (fetch de dados, etc.)
- `useLocation`: Navegação entre páginas (Wouter)

Não há gerenciamento de estado global (Redux, Zustand, etc.) pois a aplicação é relativamente simples e não requer compartilhamento complexo de estado entre componentes.

---

## Boas Práticas de Desenvolvimento

### Validação de Dados

A interface implementa validação básica no frontend:

- Campos obrigatórios são verificados antes da submissão
- Tipos de arquivo são validados (apenas .csv e .txt)
- Mensagens de erro claras são exibidas ao usuário

**Importante:** A validação no frontend é apenas para UX. O backend deve sempre validar todos os dados recebidos.

### Tratamento de Erros

Todos os requests HTTP são envolvidos em blocos `try-catch`:

```typescript
try {
  const response = await fetch(url);
  const data = await response.json();
  // Processar dados
} catch (error) {
  console.error("Error:", error);
  toast.error("Mensagem amigável para o usuário");
}
```

### Acessibilidade

A interface segue práticas básicas de acessibilidade:

- Labels associados a inputs
- Contraste adequado de cores
- Navegação por teclado funcional
- Estados de foco visíveis

---

## Próximos Passos Sugeridos

Para expandir e melhorar a interface, considere as seguintes implementações futuras:

### Funcionalidades Adicionais

1. **Paginação de Resultados**: Implementar paginação para conjuntos de dados grandes
2. **Filtros e Ordenação**: Permitir filtrar e ordenar resultados na tabela
3. **Visualizações Gráficas**: Adicionar gráficos (scatter plots, heatmaps) para visualizar correlações
4. **Histórico de Análises**: Salvar e recuperar análises anteriores
5. **Autenticação de Usuários**: Sistema de login para gerenciar análises por usuário
6. **Comparação de Resultados**: Comparar múltiplas análises lado a lado
7. **Exportação em Múltiplos Formatos**: Adicionar exportação para Excel, JSON, etc.

### Melhorias Técnicas

1. **Testes Automatizados**: Implementar testes unitários e de integração
2. **Cache de Resultados**: Cachear resultados no frontend para melhor performance
3. **Progressive Web App**: Transformar em PWA para uso offline
4. **Internacionalização**: Suporte para múltiplos idiomas
5. **Otimização de Performance**: Code splitting, lazy loading de componentes

---

## Suporte e Contato

Para questões, sugestões ou reportar problemas:

**Desenvolvido por:** Martiela V Freitas  
**Projeto:** CrossDome - Python Reimplementation  
**Data:** Fevereiro de 2026

---

## Licença

Este projeto é uma reimplementação Python do pacote CrossDome R. Consulte o arquivo `LICENSE.md` no diretório raiz do projeto para informações sobre licenciamento.

---

**Nota Final:** Esta interface foi projetada com foco em estética moderna e experiência do usuário, mantendo a funcionalidade completa do CrossDome original. O design glassmorphic biomédico foi escolhido para refletir a natureza científica da ferramenta enquanto proporciona uma experiência visual agradável e profissional.
