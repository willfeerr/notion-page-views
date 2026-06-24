# Notion Pages Lab

Aplicacao React para testar paginas e Data Sources no modelo Notion-first, com views configuraveis, propriedades controladas, editor Lexical e sincronizacao local com Yjs.

## Estrutura

```text
apps/
  web/          # aplicacao Vite publicada no GitHub Pages
packages/       # espaco para modulos compartilhados
turbo.json      # pipeline de build, testes e desenvolvimento
```

## Funcionalidades

- Database containers, Data Sources e ownership canonico de paginas
- Board, Calendar, Table, List, Gallery, Timeline e Chart sem duplicacao de rows
- Filtros AND/OR, multiplos sorts, group/subgroup e projection por view
- Side peek, center peek e full page configuraveis
- Layout de database page e templates persistidos por Data Source
- Operation Journal para moves recuperaveis, schema mapping, conflito e undo
- Relation real entre Data Sources
- Property registry, Files, Unique ID, auditoria, Place, Formula e Rollup
- Editor Lexical com um Y.Doc independente por pagina
- BroadcastChannel local com contrato preparado para Hocuspocus

## Preview

https://willfeerr.github.io/notion-page-views/?v=55b5973

## Desenvolvimento

```bash
npm install
npm run dev:web
npm test
```

Consulte [YJS_ARCHITECTURE.md](./YJS_ARCHITECTURE.md) e [FIDELITY.md](./FIDELITY.md).
