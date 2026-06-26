# Handoff P0 — Board como Relation, sem Board placement

## Contexto

Este PR está migrando o workspace para uma arquitetura Notion-first: Database/Data Source ownership, propriedades reais e views derivadas. O Board deve existir como view/recurso de uma Data Source, mas o vínculo de uma página com um Board/Lane **não pode** ser um bloco especial, placement especial, clone de página ou move implícito.

A regra do produto é:

- Board dentro da página = propriedade `relation` normal.
- Lane/status do Board = propriedade `status` normal da Data Source alvo.
- Mover para outra base = ação explícita de ownership move.
- Relation nunca chama `linkPage`, `unlinkPage`, `movePage`, nem cria `MoveOperation`.

## Estado atual do branch

O branch contém guards de teste que devem continuar existindo:

- `apps/web/src/appShellBoardPlacementGuard.test.ts`
- `apps/web/src/moveApiUsageGuard.test.ts`

Esses guards bloqueiam regressões enquanto o shell ainda tiver resíduo de Board placement.

## Implementação pendente

### 1. Limpar `apps/web/src/App.tsx`

Remover completamente:

- import de `BoardLinkOption`;
- import de `BoardLinkValue`;
- cálculo `openPageBoard`;
- cálculo `boardOptions`;
- cálculo `boardPlacement`;
- função `updateBoardPlacement`;
- props `boardOptions`, `boardPlacement`, `onBoardPlacementChange` passadas para `NotionPageView`;
- qualquer chamada UI para `.linkPage(` ou `.unlinkPage(` usada para simular vínculo com Board.

Manter:

- `relationTargets={relationTargets}`;
- fluxo explícito de move/ownership via `MovePageDialog`;
- `openPageDataSourceId` se ainda for usado pelo `MovePageDialog`.

### 2. Integrar colaboração por config

O branch já possui:

- `apps/web/src/collabConfig.ts`
- `apps/web/notion-page/editor/collabUrl.ts`
- `apps/web/.env.example`

No `App.tsx`, substituir collab hardcoded em broadcast por `resolveCollabConfig`:

```tsx
collab={{
  ...resolveCollabConfig({
    room: ROOM_NAMES.page(openPage.id),
    user: { ...collabUser, location: editingLocation },
  }),
  onPresenceChange: setPresence,
}}
```

Import esperado:

```ts
import { resolveCollabConfig } from './collabConfig';
```

Com env de teste:

```env
VITE_COLLAB_TRANSPORT=hocuspocus
VITE_HOCUSPOCUS_URL=https://collab.skrbe.com
```

O app normaliza `https://collab.skrbe.com` para `wss://collab.skrbe.com` antes de criar `HocuspocusProvider`.

### 3. Remover tipos mortos em `apps/web/notion-page/types.ts`

Remover:

```ts
export interface BoardLinkLane { id: string; name: string; color: PropertyColor; }
export interface BoardLinkOption { id: string; databaseId: string; title: string; lanes: BoardLinkLane[]; }
export interface BoardLinkValue { boardId: string; laneId: string | null; }
```

Não substituir por outro tipo de placement. O substituto conceitual é `RelationPropertyDefinition` + `RelationTargetOption`.

## Critérios de aceite

### Testes/guards

Todos devem passar:

- `appShellBoardPlacementGuard.test.ts`
- `moveApiUsageGuard.test.ts`
- testes de relation/cardinality existentes
- testes de Hocuspocus URL/config

### Busca textual esperada

Após o patch, estas strings não devem aparecer em `apps/web/src/App.tsx` nem em `apps/web/notion-page/types.ts`:

- `BoardLinkOption`
- `BoardLinkValue`
- `openPageBoard`
- `boardOptions`
- `boardPlacement`
- `onBoardPlacementChange`
- `updateBoardPlacement`

Chamadas `.linkPage(` e `.unlinkPage(` não devem aparecer em UI/componentes; somente no store legado/testes permitidos pelo guard.

### Comportamento esperado

- Criar/editar propriedade `relation` não move página.
- Criar/editar propriedade `relation` não cria `MoveOperation`.
- Abrir página continua funcionando em side/center/full page.
- Move explícito entre databases continua funcionando pelo diálogo de move.
- Hocuspocus pode ser ativado por env sem alterar código.
- Sem fallback para Board placement ou pseudo-bloco visual.

## Arquivos relevantes

- `apps/web/src/App.tsx`
- `apps/web/notion-page/types.ts`
- `apps/web/src/appShellBoardPlacementGuard.test.ts`
- `apps/web/src/moveApiUsageGuard.test.ts`
- `apps/web/src/collabConfig.ts`
- `apps/web/notion-page/editor/collabUrl.ts`
- `apps/web/notion-page/editor/CollabPlugin.tsx`
