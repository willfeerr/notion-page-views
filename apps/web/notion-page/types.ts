import type { SerializedEditorState } from 'lexical';

export type PropertyColor =
  | 'default' | 'gray' | 'brown' | 'orange' | 'yellow'
  | 'green' | 'blue' | 'purple' | 'pink' | 'red';

export interface SelectOption { id: string; name: string; color: PropertyColor; }
export interface StatusGroup { id: string; name: string; color: PropertyColor; optionIds: string[]; }
export interface PersonOption { id: string; name: string; avatarUrl?: string; avatarColor?: PropertyColor; }

export type PropertyType =
  | 'text' | 'number' | 'select' | 'multi_select' | 'status'
  | 'date' | 'person' | 'checkbox' | 'url' | 'email' | 'phone'
  | 'relation' | 'files' | 'unique_id' | 'created_by' | 'last_edited_by' | 'place'
  | 'formula' | 'rollup'
  | 'created_time' | 'last_edited_time';

interface PropertyDefinitionBase { id: string; name: string; type: PropertyType; description?: string; }
export interface TextPropertyDefinition extends PropertyDefinitionBase { type: 'text'; }
export interface NumberPropertyDefinition extends PropertyDefinitionBase {
  type: 'number'; format?: 'plain' | 'currency' | 'percent'; currency?: string;
}
export interface SelectPropertyDefinition extends PropertyDefinitionBase {
  type: 'select'; options: SelectOption[];
}
export interface MultiSelectPropertyDefinition extends PropertyDefinitionBase {
  type: 'multi_select'; options: SelectOption[];
}
export interface StatusPropertyDefinition extends PropertyDefinitionBase {
  type: 'status'; options: SelectOption[]; groups: StatusGroup[];
}
export interface DatePropertyDefinition extends PropertyDefinitionBase {
  type: 'date';
  includeTime?: boolean;
  timezone?: string;
}
export interface PersonPropertyDefinition extends PropertyDefinitionBase {
  type: 'person'; people: PersonOption[]; multiple?: boolean;
}
export interface CheckboxPropertyDefinition extends PropertyDefinitionBase { type: 'checkbox'; }
export interface UrlPropertyDefinition extends PropertyDefinitionBase { type: 'url'; }
export interface EmailPropertyDefinition extends PropertyDefinitionBase { type: 'email'; }
export interface PhonePropertyDefinition extends PropertyDefinitionBase { type: 'phone'; }
export interface CreatedTimePropertyDefinition extends PropertyDefinitionBase { type: 'created_time'; }
export interface LastEditedTimePropertyDefinition extends PropertyDefinitionBase { type: 'last_edited_time'; }
export interface RelationPropertyDefinition extends PropertyDefinitionBase {
  type: 'relation';
  targetDataSourceId: string;
  multiple?: boolean;
}
export interface FilesPropertyDefinition extends PropertyDefinitionBase { type: 'files'; }
export interface UniqueIdPropertyDefinition extends PropertyDefinitionBase { type: 'unique_id'; prefix?: string; }
export interface CreatedByPropertyDefinition extends PropertyDefinitionBase { type: 'created_by'; }
export interface LastEditedByPropertyDefinition extends PropertyDefinitionBase { type: 'last_edited_by'; }
export interface PlacePropertyDefinition extends PropertyDefinitionBase { type: 'place'; }
export type FormulaExpression =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'property'; propertyId: string }
  | { kind: 'operation'; operator: 'add' | 'subtract' | 'multiply' | 'divide' | 'concat'; left: FormulaExpression; right: FormulaExpression };
export interface FormulaPropertyDefinition extends PropertyDefinitionBase { type: 'formula'; expression: FormulaExpression; }
export interface RollupPropertyDefinition extends PropertyDefinitionBase {
  type: 'rollup';
  relationPropertyId: string;
  targetPropertyId?: string;
  calculation: 'count' | 'count_values' | 'sum' | 'average' | 'min' | 'max' | 'show_unique';
}

export interface RelationPageOption { id: string; title: string; icon?: string | null; }
export interface RelationTargetOption { id: string; title: string; pages: RelationPageOption[]; }

export interface DateRangeValue {
  start: string;
  end?: string | null;
  allDay?: boolean;
  timezone?: string;
}

export type PropertyDefinition =
  | TextPropertyDefinition | NumberPropertyDefinition
  | SelectPropertyDefinition | MultiSelectPropertyDefinition | StatusPropertyDefinition
  | DatePropertyDefinition | PersonPropertyDefinition | CheckboxPropertyDefinition
  | UrlPropertyDefinition | EmailPropertyDefinition | PhonePropertyDefinition
  | CreatedTimePropertyDefinition | LastEditedTimePropertyDefinition
  | RelationPropertyDefinition | FilesPropertyDefinition | UniqueIdPropertyDefinition
  | CreatedByPropertyDefinition | LastEditedByPropertyDefinition | PlacePropertyDefinition
  | FormulaPropertyDefinition | RollupPropertyDefinition;

export type StoredPropertyValue = string | number | boolean | string[] | DateRangeValue | null | undefined;
export type PageProperties = Record<string, StoredPropertyValue>;

export interface NotionSchema {
  properties: PropertyDefinition[];
}

export interface DatabasePageLayoutSection {
  id: string;
  title: string;
  propertyIds: string[];
  collapsed?: boolean;
}

export interface DatabasePageLayout {
  pinnedPropertyIds: string[];
  sections: DatabasePageLayoutSection[];
}

export interface DatabasePageTemplate {
  id: string;
  name: string;
  title: string;
  icon?: string | null;
  coverUrl?: string | null;
  coverPosition?: number;
  properties: PageProperties;
  content: SerializedEditorState | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardLinkLane {
  id: string;
  name: string;
  color: PropertyColor;
}

export interface BoardLinkOption {
  id: string;
  databaseId: string;
  title: string;
  lanes: BoardLinkLane[];
}

export interface BoardLinkValue {
  boardId: string;
  laneId: string | null;
}


/**
 * Config for Hocuspocus real-time collaboration.
 * When provided, the editor uses LexicalCollaborationPlugin
 * (Yjs-backed) instead of OnChangePlugin.
 */
export interface CollabConfig {
  /** Local cross-tab sync by default; switch to hocuspocus without changing the editor API. */
  transport?: 'broadcast' | 'hocuspocus';
  /** Hocuspocus WebSocket URL, e.g. "ws://localhost:1234" */
  wsUrl?: string;
  /**
   * Document/room name — typically "page-{page.id}".
   * Each unique value is a separate Yjs document on the server.
   */
  room: string;
  user: {
    id: string;
    name: string;
    /** CSS hex color for the collaboration cursor, e.g. "#3B82F6" */
    color: string;
    /** Human-readable editing area shown beside the collaborator name. */
    location?: string;
  };
  onPresenceChange?: (presence: CollabPresence[]) => void;
}

export interface CollabPresence {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  location: string;
}

export interface NotionPageData {
  id: string;
  icon?: string | null;
  coverUrl?: string | null;
  /** Vertical position (0-100) of the cover background. Default 50. */
  coverPosition?: number;
  title: string;
  properties: PageProperties;
  /** Serializable mirror used to bootstrap, export and index the Yjs-backed editor. */
  content: SerializedEditorState | null;
  /** Small database projection used before the page Y.Doc is loaded. */
  contentPreview?: string;
  createdTime: string;
  lastEditedTime: string;
}
