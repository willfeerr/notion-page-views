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
  | 'created_time' | 'last_edited_time';

interface PropertyDefinitionBase { id: string; name: string; type: PropertyType; }
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
export interface DatePropertyDefinition extends PropertyDefinitionBase { type: 'date'; }
export interface PersonPropertyDefinition extends PropertyDefinitionBase {
  type: 'person'; people: PersonOption[]; multiple?: boolean;
}
export interface CheckboxPropertyDefinition extends PropertyDefinitionBase { type: 'checkbox'; }
export interface UrlPropertyDefinition extends PropertyDefinitionBase { type: 'url'; }
export interface EmailPropertyDefinition extends PropertyDefinitionBase { type: 'email'; }
export interface PhonePropertyDefinition extends PropertyDefinitionBase { type: 'phone'; }
export interface CreatedTimePropertyDefinition extends PropertyDefinitionBase { type: 'created_time'; }
export interface LastEditedTimePropertyDefinition extends PropertyDefinitionBase { type: 'last_edited_time'; }

export type PropertyDefinition =
  | TextPropertyDefinition | NumberPropertyDefinition
  | SelectPropertyDefinition | MultiSelectPropertyDefinition | StatusPropertyDefinition
  | DatePropertyDefinition | PersonPropertyDefinition | CheckboxPropertyDefinition
  | UrlPropertyDefinition | EmailPropertyDefinition | PhonePropertyDefinition
  | CreatedTimePropertyDefinition | LastEditedTimePropertyDefinition;

export type StoredPropertyValue = string | number | boolean | string[] | null | undefined;
export type PageProperties = Record<string, StoredPropertyValue>;

export interface NotionSchema {
  properties: PropertyDefinition[];
}

/**
 * Config for Hocuspocus real-time collaboration.
 * When provided, the editor uses LexicalCollaborationPlugin
 * (Yjs-backed) instead of OnChangePlugin.
 */
export interface CollabConfig {
  /** Hocuspocus WebSocket URL, e.g. "ws://localhost:1234" */
  wsUrl: string;
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
  };
}

export interface NotionPageData {
  id: string;
  icon?: string | null;
  coverUrl?: string | null;
  /** Vertical position (0-100) of the cover background. Default 50. */
  coverPosition?: number;
  title: string;
  properties: PageProperties;
  /**
   * Only used in local (non-collab) mode as initial state seed.
   * In collab mode, content lives in the Yjs doc on the Hocuspocus server.
   */
  content: SerializedEditorState | null;
  createdTime: string;
  lastEditedTime: string;
}
