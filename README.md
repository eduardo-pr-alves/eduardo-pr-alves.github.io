# Treino Semanal

Site para acompanhar a ficha de treino na academia: treino do dia, timer de descanso, imagens de
como fazer cada exercício, registro de cargas, histórico e evolução do peso.

Feito com HTML, CSS e JavaScript puros. Os dados ficam em um banco **SQLite** dentro do próprio
navegador ([sql.js](https://github.com/sql-js/sql.js)); não precisa de servidor nem de conta.

## Funcionalidades

| Tela | O que faz |
|---|---|
| **Hoje** | Treino do dia da semana, semana atual (dias feitos), peso, IMC, fase do programa e um lembrete das recomendações |
| **Semana** | Os 7 dias da ficha; cada dia mostra os exercícios com imagem e permite **editar** séries, repetições, descanso e duração |
| **Treino** | Registro série a série (carga e repetições), com a carga da última vez já preenchida; ao concluir uma série o **timer de descanso** começa sozinho |
| **Exercício** | Imagens animadas (posição inicial e final), passo a passo, dicas, erros comuns e histórico de cargas |
| **Histórico** | Treinos salvos com duração, séries, volume e observações |
| **Progresso** | Programa de 12 semanas com a fase atual, gráfico do peso corporal e cargas por exercício |
| **Mais** | Recomendações, perfil, configurações, importar/exportar o plano (JSON) e backup do banco (.db) |

### Timer

- Descanso automático com o tempo da ficha (60 s, 90 s…), com −15 s / +15 s, pausar e pular.
- Cardio e prancha usam o timer de execução; ao zerar, o exercício é marcado como feito.
- Bipes nos 3 últimos segundos, alarme e vibração no fim; notificação se o app estiver em segundo plano.
- Tela cheia ao tocar no círculo; botão **Timer** no topo para um timer livre.
- A tela fica ligada durante o treino e o timer continua certo mesmo se a página for recarregada.
- Aviso aos 55 min e aos 60 min (limite da sessão definido no perfil).

### Fases do programa

A data de início fica em **Progresso**. Nas semanas 1–2 o treino usa 2 séries por exercício
(como diz a ficha); depois volta ao número completo. A opção pode ser desligada na mesma tela.

## Como usar

- **No GitHub Pages:** depois de juntar este branch ao `main`, o site fica em
  <https://eduardo-pr-alves.github.io/>.
- **No celular:** abra o endereço e use *Adicionar à tela inicial*. O site funciona sem internet
  depois da primeira visita.
- **No computador:** `python -m http.server` nesta pasta e abra <http://localhost:8000>. Abrir o
  `index.html` direto também funciona (mais lento).

## Dados e backup

Os dados ficam só no aparelho/navegador em que foram registrados. Em **Mais → Backup**:

- **Exportar backup (.db)**: baixa o banco SQLite (abre no DB Browser for SQLite).
- **Importar backup (.db)**: restaura o arquivo em outro aparelho ou navegador.

## Alterar a ficha

1. Pelo próprio site: **Semana → dia → Editar dia**.
2. Importando um JSON no mesmo formato da ficha em **Mais → Plano de treino**.
3. Editando `PLANO_PADRAO` em `js/dados.js` (vale para o primeiro uso ou em *Restaurar plano original*).

Exercícios novos ganham imagem quando o nome bate com uma das regras de `REGRAS_CATALOGO`
(`js/dados.js`); sem imagem, aparece um ícone.

## Estrutura

```
index.html            página única
css/estilo.css        visual (tema claro e escuro)
js/dados.js           plano padrão e catálogo de exercícios (instruções e imagens)
js/banco.js           banco SQLite: tabelas, plano JSON ⇄ tabelas, backup
js/timer.js           timer, bipes, vibração e notificação
js/grafico.js         gráfico do peso
js/app.js             telas e regras do treino
sw.js                 funcionamento offline (mude VERSAO ao publicar alterações)
vendor/               sql.js (SQLite em WebAssembly e em JavaScript)
img/exercicios/       duas imagens por exercício
```

## Créditos

- Imagens: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (domínio público).
- SQLite no navegador: [sql.js](https://github.com/sql-js/sql.js) (licença MIT, `vendor/LICENSE-sql.js.txt`).

O site organiza a ficha, mas não substitui a avaliação de um profissional de educação física.
