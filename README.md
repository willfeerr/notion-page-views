# Notion Pages Lab

Aplicacao React real para testar o pacote `notion-page`: propriedades controladas, schema editavel, editor Lexical e sincronizacao local com Yjs.

## Funcionalidades

- Criar, renomear, reordenar, converter e excluir propriedades
- Editar texto, numero, select, multi-select, status, data, pessoa, checkbox, URL, email e telefone
- Criar, renomear, colorir e excluir opcoes
- Editar titulo, icone e capa da pagina
- Arrastar cards entre colunas de status
- Editar conteudo no Lexical com slash commands e blocos customizados
- Sincronizar schema e propriedades entre abas com `Y.Doc + BroadcastChannel`
- Sincronizar cada editor Lexical em um documento Yjs separado
- Persistir o workspace no `localStorage`

## Desenvolvimento

```bash
npm install
npm run dev
```

O contrato de colaboracao aceita `transport: 'broadcast'` ou `transport: 'hocuspocus'`. Para migrar ao servidor, informe `wsUrl` e altere apenas o transporte.

Consulte [FIDELITY.md](./FIDELITY.md) para o mapa de fidelidade e dependencias de backend ainda necessarias.
