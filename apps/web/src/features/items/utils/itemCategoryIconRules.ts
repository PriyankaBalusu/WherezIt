export interface CategoryIconRule {
  patterns: RegExp[];
  icon: string;
  bg: string;
  border: string;
}

const PALETTE = {
  blue: { bg: '#f0f9ff', border: '#bae6fd' },
  pink: { bg: '#fdf4ff', border: '#f5d0fe' },
  rose: { bg: '#fff1f2', border: '#fecdd3' },
  gray: { bg: '#f1f5f9', border: '#cbd5e1' },
  green: { bg: '#f0fdf4', border: '#bbf7d0' },
  yellow: { bg: '#fffbeb', border: '#fde68a' },
  slate: { bg: '#f8fafc', border: '#e2e8f0' },
  red: { bg: '#fef2f2', border: '#fca5a5' },
  teal: { bg: '#f0fdfa', border: '#99f6e4' },
  indigo: { bg: '#fbfbfe', border: '#e0e7ff' },
  amber: { bg: '#fff7ed', border: '#ffedd5' },
};

export const CATEGORY_ICON_RULES: CategoryIconRule[] = [
  { patterns: [/electronic|device|appliance|gadget|tech/i], icon: '💻', ...PALETTE.blue },
  { patterns: [/kitchen|dining|cookware|dishware|tableware/i], icon: '🍽️', ...PALETTE.rose },
  { patterns: [/cloth|apparel|wear|footwear|garment/i], icon: '👕', ...PALETTE.pink },
  { patterns: [/book|reading|media|literature|publication/i], icon: '📚', ...PALETTE.green },
  { patterns: [/tool|hardware|repair|building|equipment/i], icon: '🛠️', ...PALETTE.gray },
  { patterns: [/toy|game|child|kid|play/i], icon: '🧩', ...PALETTE.indigo },
  { patterns: [/doc|paper|file|office|stationery|record/i], icon: '📄', ...PALETTE.slate },
  { patterns: [/furniture|furnishing|seating|home decor/i], icon: '🛋️', ...PALETTE.amber },
  { patterns: [/bath|toilet|hygiene|personal care/i], icon: '🧴', ...PALETTE.teal },
  { patterns: [/beauty|cosmetics|makeup|skincare/i], icon: '💄', ...PALETTE.pink },
  { patterns: [/food|pantry|beverage|grocery|snack/i], icon: '🥫', ...PALETTE.rose },
  { patterns: [/sport|fitness|exercise|gym|workout/i], icon: '⚽', ...PALETTE.green },
  { patterns: [/outdoor|camp|hiking|travel gear/i], icon: '⛺', ...PALETTE.green },
  { patterns: [/holiday|decor|seasonal|christmas|celebration/i], icon: '🎨', ...PALETTE.indigo },
  { patterns: [/clean|laundry|housekeeping/i], icon: '🧹', ...PALETTE.teal },
  { patterns: [/garden|plant|yard|lawn/i], icon: '🪴', ...PALETTE.green },
  { patterns: [/pet|dog|cat|animal/i], icon: '🐾', ...PALETTE.amber },
  { patterns: [/baby|infant|nursery/i], icon: '👶', ...PALETTE.indigo },
  { patterns: [/auto|car|vehicle|motoring/i], icon: '🚗', ...PALETTE.gray },
  { patterns: [/medic|health|safety|first aid/i], icon: '🩹', ...PALETTE.red },
  { patterns: [/music|craft|hobby|art/i], icon: '🎵', ...PALETTE.pink },
  { patterns: [/travel|luggage|baggage/i], icon: '🧳', ...PALETTE.amber },
];
