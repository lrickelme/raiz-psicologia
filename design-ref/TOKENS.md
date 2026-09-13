# Tokens — Raíz (extraído de `styles.css` + `guia.html`)

Extração literal dos valores usados nesses dois arquivos. Sem interpretação de código de aplicação — apenas inventário.

## 1. Cor

### 1.1 Variáveis declaradas em `:root` (styles.css)

| Token | Hex | Uso observado nestes arquivos |
|---|---|---|
| `--ink` | `#46342A` | cor de texto padrão do body, títulos, wordmark "Raíz" |
| `--ink2` | `#5C4636` | texto secundário (parágrafo de intro, amostra "Hanken Grotesk", "IBM Plex Mono 09:00") |
| `--wine` | `#7E2B2E` | ação primária: botão principal, item de nav ativo, label "Alta"/"Cancelada" |
| `--wine-d` | `#6A2225` | **declarada, não usada** em styles.css/guia.html |
| `--bg` | `#F3E9DC` | fundo do app-shell / `.guide-page`; texto do logo sobre fundo escuro |
| `--surface` | `#FCF8F2` | fundo do card do guia; fundo de inputs |
| `--beige` | `#E5D6C2` | swatch de paleta "Areia" |
| `--sand` | `#EFE3D3` | *(declarada; não encontrada em uso direto nestes 2 arquivos)* |
| `--moss` | `#5E6E4E` | avatar, botão "Concluir", label "Baixa"/"Realizada" |
| `--moss-l` | `#7C8C64` | **declarada, não usada** em styles.css/guia.html |
| `--amber` | `#B6863C` | label "Média"/"Agendada" |
| `--muted` | `#8C7A68` | texto terciário/eyebrows/legendas |
| `--muted2` | `#A89682` | texto de nav inativo, `.profile-crp`, `.guide-link` |
| `--line` | `#E6D8C7` | bordas padrão (cards, divisores) |
| `--line2` | `#DECDB8` | bordas de inputs/botão secundário (mais contraste que `--line`) |

### 1.2 Cores literais (fora das variáveis)

| Hex / valor | Onde aparece |
|---|---|
| `#E9E0D3` | `body { background }` — nota: é **diferente** de `--bg` (`#F3E9DC`); é o fundo "cru" da página antes do app-shell/guide-page pintarem por cima |
| `#6E8158` → `#46342A` | gradiente do `.leaf` (logo), `linear-gradient(140deg, ...)` |
| `rgba(245,238,228,0.5)` | `.leaf::after` (linha central da folha) |
| `#CDB9A2` | thumb da scrollbar customizada |
| `rgba(245,238,228,0.08)` | fundo de `.nav-item:hover` |
| `rgba(245,238,228,0.12)` | borda superior de `.guide-link` e `.sidebar-profile` |
| `#FBEFE6` | texto sobre `--wine` (nav ativo, botão primário) |
| `#F4F2E8` | texto sobre `--moss` (avatar, botão "Concluir") |
| `#fff` | texto sobre os 3 pills de prioridade (Alta/Média/Baixa) |
| `#E7ECDC` | fundo do pill "● Realizada" |
| `#F3E8D2` | fundo do pill "● Agendada" |
| `#F1DEDC` | fundo do pill "● Cancelada" |
| `rgba(70,52,42,0.4)` | cor da sombra do card do guia |

## 2. Tipografia

### 2.1 Famílias

| Família | Papel | Fallback |
|---|---|---|
| `'Bricolage Grotesque'` | display — wordmark, títulos (h1, headers de seção/subseção), amostras de tipo | `sans-serif` |
| `'Hanken Grotesk'` | corpo/UI — texto de body, nav, botões | `system-ui, sans-serif` |
| `'IBM Plex Mono'` | mono — eyebrows, dados/horas, legendas de swatch, back-link | `monospace` |

Carregada via Google Fonts com pesos: Bricolage Grotesque 12,400/500/600/700 + 24,600/700; Hanken Grotesk 400/500/600/700; IBM Plex Mono 400/500.

### 2.2 Escala de tamanho (todos os `font-size` encontrados, em ordem crescente)

| px | Onde |
|---|---|
| 10 | legenda hex do swatch de paleta |
| 10.5 | subtítulo mono abaixo do logo ("Psicologia · Sistema de Gestão") |
| 11 | eyebrow de seção ("01 · Fundamentos da marca"), legenda "Display · 600/700" etc., `.profile-crp` |
| 11.5 | `.guide-link`, pills de prioridade/status |
| 12 | `.back-link`, nome do swatch de paleta |
| 12.5 | `.avatar` (iniciais) |
| 13 | legenda/caption do logo, `.profile-name` |
| 13.5 | texto de botão, texto de input |
| 14 | `.nav-item` |
| 15 | parágrafo de intro, amostra "IBM Plex Mono 09:00" |
| 18 | headers de subseção (Logotipo/Tipografia/Paleta & papéis/Componentes) |
| 20 | amostra "Hanken Grotesk — corpo" |
| 21 | `.brand-name` (logo na sidebar) |
| 27 | wordmark "Raíz" dentro dos swatches de logo |
| 30 | wordmark "Raíz" no header do guia |
| 32 | `h1` |
| 34 | amostra de tipo "Bricolage" |

### 2.3 Pesos (`font-weight`)

- **400** — implícito (peso padrão do body/parágrafos, não declarado explicitamente na maioria dos casos)
- **500** — `.nav-item` (inativo), amostra "Hanken Grotesk — corpo"
- **600** — headers de subseção, `.nav-item.active`, `.profile-name`, `.avatar`, nomes de swatch, eyebrows de componente, texto de botão, pills, h1
- **700** — wordmark "Raíz" (`.brand-name` e nos swatches), amostra "Bricolage"

### 2.4 Letter-spacing

| Valor | Onde |
|---|---|
| `0.01em` | h1 do guia |
| `0.15em` | eyebrow de grupo de componente ("Botões", "Campos", etc.) |
| `0.22em` | eyebrow de seção ("01 · Fundamentos da marca") |
| `0.34em` | subtítulo mono abaixo do logo |

### 2.5 Line-height

| Valor | Onde |
|---|---|
| `1` | wordmark do header, amostra "Bricolage" |
| `1.15` | h1 |
| `1.55` | caption do logo |
| `1.6` | parágrafo de intro |

### 2.6 Text-transform

- `uppercase` — usado em todos os eyebrows mono (subtítulo do logo, "01 · Fundamentos...", labels de grupo de componente)

## 3. Espaçamento

### 3.1 Padding

| Valor | Onde |
|---|---|
| `0 6px` | `.guide-link` |
| `4px 6px` | `.sidebar-brand` |
| `4px 12px` | pills de prioridade/status |
| `10px` | `.sidebar-profile` |
| `10px 13px` | `.nav-item` |
| `10px 20px` | botão secundário |
| `11px 14px` | campo de input |
| `11px 20px` | botão primário/concluir |
| `14px` (top, do `.guide-link`) | separador acima do link do guia |
| `16px 16px` (22px 16px) | `.sidebar` → `22px 16px` |
| `20px` | card de grupo de componente |
| `22px` | box de amostra de tipografia |
| `24px` | swatch de logo |
| `36px` | card principal do guia |
| `46px 32px 90px` | `.guide-page` (top/laterais/bottom) |

### 3.2 Margin

| Valor | Onde |
|---|---|
| `0 auto 18px` | linha logo+wordmark do header |
| `0 auto 40px` | bloco de header/intro |
| `0 auto 56px` | card do guia |
| `0 0 8px` | h1 (margin-bottom) |
| `12px 0 0` | caption do logo (margin-top) |
| `7px` (margin-top) | legenda hex do swatch |
| `4px` (margin-top) | eyebrow secundário ("Status de consulta") |

### 3.3 Gap (flex/grid)

| Valor | Onde |
|---|---|
| `4px` | `.nav-list` |
| `8px` | pills de prioridade/status |
| `11px` | `.sidebar-brand`, `.sidebar-profile`, componentes internos de card |
| `12px` | `.nav-item` |
| `14px` | swatches de logo, cards de componente, grid de paleta |
| `22px` | `.sidebar` |
| `34px` | grid de 2 colunas da seção de fundamentos |

### 3.4 Largura de conteúdo / layout

- `max-width: 1320px` — largura máxima de todo o conteúdo do guia (header, card, back-link-row)
- `width: 228px` — largura fixa da sidebar
- Grid de paleta: `repeat(6, 1fr)`
- Grid de fundamentos: `1fr 1fr` (2 colunas), com blocos "grid-column: 1 / -1" para seções full-width (paleta, componentes)

## 4. Border-radius

| Valor | Onde |
|---|---|
| `10px` | thumb da scrollbar |
| `12px` | `.nav-item`, input de campo |
| `13px` | swatch de cor da paleta |
| `16px` | cards de swatch de logo, box de tipografia, cards de componente |
| `24px` | card principal do guia |
| `50%` | `.avatar` (círculo) |
| `999px` | botões, pills (formato pílula) |
| `54% 8% 54% 8%` | `.leaf` (blob orgânico do ícone/logo — não é um raio uniforme) |

### Bordas (largura, adjacente a border-radius)

| Valor | Onde |
|---|---|
| `1px` (com `var(--line)`) | bordas padrão de cards/divisores |
| `1.5px` (com `var(--line2)` ou `var(--wine)`) | inputs, botão secundário |

## 5. Outros valores notados (fora do escopo pedido, mas adjacentes)

- **Sombra**: `0 20px 50px -32px rgba(70,52,42,0.4)` — única box-shadow encontrada, no card do guia.
- **Gradiente**: `linear-gradient(140deg, #6E8158, #46342A)` — logo `.leaf`.
- **Tamanhos fixos de ícone/avatar**: `34px`/`44px`/`46px` (variações do `.leaf`), `34px` (`.avatar`).

## 6. Observações de consistência

- `body` usa `#E9E0D3` diretamente, enquanto `--bg` é `#F3E9DC` — duas cores "creme" muito próximas mas distintas; verificar se é intencional (fallback antes do JS montar o app-shell) antes de unificar em um token de aplicação.
- `--wine-d`, `--moss-l` e `--sand` estão declaradas em `:root` mas não têm uso localizado nestes dois arquivos — podem estar reservadas para telas em `index.html` (fora do escopo desta extração).
