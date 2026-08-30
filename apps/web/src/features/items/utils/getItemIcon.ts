import { ITEM_ICON_RULES } from './itemIconRules';
import { CATEGORY_ICON_RULES } from './itemCategoryIconRules';

export interface ItemIconStyle {
  icon: string;
  bg: string;
  border: string;
}

const DEFAULT_FALLBACK_STYLE: ItemIconStyle = {
  icon: '📦',
  bg: '#f1f5f9',
  border: '#e2e8f0',
};

/**
 * Normalizes input text by trimming, lowercasing, and resolving extra whitespace.
 */
function normalizeInput(input?: string | null): string {
  if (!input) return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Resolves icon and visual styling for an item based on its name and confirmed category.
 *
 * Selection Hierarchy:
 * 1. Specific Item Name Rule Match
 * 2. Confirmed Category Rule Match
 * 3. Neutral Fallback (📦)
 */
export function getItemIconAndStyle(
  name: string,
  category?: string | null
): ItemIconStyle {
  const normalizedName = normalizeInput(name);
  const normalizedCategory = normalizeInput(category);

  // 1. SPECIFIC ITEM NAME MATCH
  if (normalizedName) {
    for (const rule of ITEM_ICON_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(normalizedName))) {
        return {
          icon: rule.icon,
          bg: rule.bg,
          border: rule.border,
        };
      }
    }
  }

  // 2. CONFIRMED CATEGORY MATCH
  if (normalizedCategory) {
    for (const rule of CATEGORY_ICON_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(normalizedCategory))) {
        return {
          icon: rule.icon,
          bg: rule.bg,
          border: rule.border,
        };
      }
    }
  }

  // 3. GENERIC FALLBACK
  return DEFAULT_FALLBACK_STYLE;
}
