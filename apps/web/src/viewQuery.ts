import type { NotionPageData, StoredPropertyValue } from '../notion-page/types';
import type { FilterCondition, FilterGroup, ResourceBase, SortDefinition } from './domain';

function isEmpty(value: StoredPropertyValue): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function scalar(value: StoredPropertyValue): string | number | boolean | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return Date.parse(value.start) || value.start;
  if (Array.isArray(value)) return value.join('\u0000');
  return value ?? null;
}

function matchesCondition(page: NotionPageData, condition: FilterCondition): boolean {
  const current = condition.propertyId === 'title' ? page.title : page.properties[condition.propertyId];
  const expected = condition.value;
  if (condition.operator === 'is_empty') return isEmpty(current);
  if (condition.operator === 'is_not_empty') return !isEmpty(current);
  if (condition.operator === 'contains') {
    if (Array.isArray(current)) return Array.isArray(expected)
      ? expected.every((value) => current.includes(value))
      : typeof expected === 'string' && current.includes(expected);
    return String(current ?? '').toLocaleLowerCase().includes(String(expected ?? '').toLocaleLowerCase());
  }
  const left = scalar(current);
  const right = scalar(expected);
  if (condition.operator === 'equals') return JSON.stringify(current ?? null) === JSON.stringify(expected ?? null);
  if (condition.operator === 'not_equals') return JSON.stringify(current ?? null) !== JSON.stringify(expected ?? null);
  if (left === null || right === null) return false;
  const comparison = compareValue(current, expected);
  if (condition.operator === 'greater_than' || condition.operator === 'after') return comparison > 0;
  if (condition.operator === 'greater_than_or_equal') return comparison >= 0;
  if (condition.operator === 'less_than' || condition.operator === 'before') return comparison < 0;
  if (condition.operator === 'less_than_or_equal') return comparison <= 0;
  return true;
}

export function matchesFilter(page: NotionPageData, filter?: FilterGroup): boolean {
  if (!filter?.filters.length) return true;
  const results = filter.filters.map((entry) => entry.type === 'group' ? matchesFilter(page, entry) : matchesCondition(page, entry));
  return filter.operator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

function compareValue(left: StoredPropertyValue, right: StoredPropertyValue): number {
  if (isEmpty(left)) return isEmpty(right) ? 0 : 1;
  if (isEmpty(right)) return -1;
  const a = scalar(left);
  const b = scalar(right);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function pageValue(page: NotionPageData, propertyId: string): StoredPropertyValue {
  if (propertyId === 'title') return page.title;
  if (propertyId === 'created_time') return page.createdTime;
  if (propertyId === 'last_edited_time') return page.lastEditedTime;
  return page.properties[propertyId];
}

export function sortPages(pages: NotionPageData[], sorts: SortDefinition[] = []): NotionPageData[] {
  if (!sorts.length) return pages;
  return [...pages].sort((left, right) => {
    for (const sort of sorts) {
      const leftValue = pageValue(left, sort.propertyId);
      const rightValue = pageValue(right, sort.propertyId);
      const leftEmpty = isEmpty(leftValue);
      const rightEmpty = isEmpty(rightValue);
      if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1;
      const result = compareValue(leftValue, rightValue);
      if (result) return sort.direction === 'ascending' ? result : -result;
    }
    return left.id.localeCompare(right.id);
  });
}

export function executeViewQuery(pages: NotionPageData[], view: Pick<ResourceBase, 'filter' | 'sorts'>): NotionPageData[] {
  return sortPages(pages.filter((page) => matchesFilter(page, view.filter)), view.sorts);
}
