import type { FormulaExpression, NotionPageData, NotionSchema, RollupPropertyDefinition, StoredPropertyValue } from '../notion-page/types';

function formulaValue(expression: FormulaExpression, properties: Record<string, StoredPropertyValue>): StoredPropertyValue {
  if (expression.kind === 'literal') return expression.value;
  if (expression.kind === 'property') return properties[expression.propertyId] ?? null;
  const left = formulaValue(expression.left, properties);
  const right = formulaValue(expression.right, properties);
  if (expression.operator === 'concat') return `${left ?? ''}${right ?? ''}`;
  const a = typeof left === 'number' ? left : Number(left);
  const b = typeof right === 'number' ? right : Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (expression.operator === 'add') return a + b;
  if (expression.operator === 'subtract') return a - b;
  if (expression.operator === 'multiply') return a * b;
  return b === 0 ? null : a / b;
}

function rollupValue(definition: RollupPropertyDefinition, page: NotionPageData, pages: Map<string, NotionPageData>): StoredPropertyValue {
  const relation = page.properties[definition.relationPropertyId];
  const related = Array.isArray(relation) ? relation.flatMap((id) => {
    const target = pages.get(id);
    return target ? [target] : [];
  }) : [];
  if (definition.calculation === 'count') return related.length;
  const values = related.map((target) => definition.targetPropertyId ? target.properties[definition.targetPropertyId] : target.title)
    .filter((value) => value !== null && value !== undefined);
  if (definition.calculation === 'count_values') return values.length;
  if (definition.calculation === 'show_unique') return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [String(value)]))];
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return null;
  if (definition.calculation === 'sum') return numbers.reduce((total, value) => total + value, 0);
  if (definition.calculation === 'average') return numbers.reduce((total, value) => total + value, 0) / numbers.length;
  if (definition.calculation === 'min') return Math.min(...numbers);
  return Math.max(...numbers);
}

export function materializeComputedProperties(
  pages: NotionPageData[],
  schemas: Record<string, NotionSchema>,
): NotionPageData[] {
  const materialized = pages.map((page) => ({ ...page, properties: { ...page.properties } }));
  const byId = new Map(materialized.map((page) => [page.id, page]));
  materialized.forEach((page) => {
    schemas[page.id]?.properties.filter((definition) => definition.type === 'formula').forEach((definition) => {
      page.properties[definition.id] = formulaValue(definition.expression, page.properties);
    });
  });
  materialized.forEach((page) => {
    schemas[page.id]?.properties.filter((definition) => definition.type === 'rollup').forEach((definition) => {
      page.properties[definition.id] = rollupValue(definition, page, byId);
    });
  });
  return materialized;
}
