# Product Variant Grouping in POS

## Overview

The POS system now intelligently groups products with the same brand and name but different attributes (size, variety, color) as variants. This allows for optimized selection in the POS interface.

## How It Works

### Grouping Logic

Products are grouped based on **Brand + Name** combination:

```typescript
// Grouping key: brand_name (normalized to lowercase)
const brandNorm = (product.brand || '').trim().toLowerCase();
const nameNorm = (product.name || '').trim().toLowerCase();
const baseKey = `${brandNorm}_${nameNorm}`;
```

### Variant Detection

The system automatically detects three types of variants:

1. **Size Variants** - Different sizes of the same product
2. **Variety Variants** - Different product varieties (e.g., paint finishes)
3. **Color Variants** - Different colors of the same product

## Examples

### Example 1: Electrical Wire (Size Variants)

**Products in Database:**
- Brand: ElecTest, Name: Electrical Wire, Size: 10m
- Brand: ElecTest, Name: Electrical Wire, Size: 5m

**POS Display:**
- Shows as one group: "Electrical Wire"
- Variant chips: `10m` | `5m`
- Click a chip to select that variant

### Example 2: ProPaint (Variety Variants)

**Products in Database:**
- Brand: ProBrand, Name: ProPaint, Variety: Flat Finish
- Brand: ProBrand, Name: ProPaint, Variety: Glossy Finish
- Brand: ProBrand, Name: ProPaint, Variety: Semi-Gloss

**POS Display:**
- Shows as one group: "ProPaint"
- Variant chips: `Flat Finish` | `Glossy Finish` | `Semi-Gloss`
- Green chips for variety selection

### Example 3: Combined Variants

**Products in Database:**
- Brand: PaintCo, Name: Wall Paint, Size: 1L, Variety: Matte, Color: White
- Brand: PaintCo, Name: Wall Paint, Size: 1L, Variety: Matte, Color: Blue
- Brand: PaintCo, Name: Wall Paint, Size: 4L, Variety: Matte, Color: White
- Brand: PaintCo, Name: Wall Paint, Size: 4L, Variety: Glossy, Color: White

**POS Display:**
- Shows as one group: "Wall Paint"
- Size chips: `1L` | `4L` (blue)
- Variety chips: `Matte` | `Glossy` (green)
- Color chips: `White` | `Blue` (purple)

## UI Implementation

### Variant Chip Colors

- **Size variants**: Blue (primary color)
- **Variety variants**: Green (success color)
- **Color variants**: Purple (secondary color)

### Product Display

```
┌─────────────────────────────────────┐
│ ProPaint                            │
│ ProBrand • Paint                    │
│                                     │
│ [Flat Finish] [Glossy] [Semi-Gloss] │
│                                     │
│ ₱195.00    Stock: 35    Add to Cart│
└─────────────────────────────────────┘
```

### Selection Behavior

1. When products are grouped, the first variant is selected by default
2. Clicking a variant chip selects that specific product
3. The selected variant's price and stock are displayed
4. "Add to Cart" adds the currently selected variant

## Benefits

1. **Cleaner POS Interface** - Less clutter with grouped products
2. **Faster Selection** - Easy to switch between variants
3. **Better Organization** - Products grouped logically
4. **Flexible Variants** - Supports size, variety, and color combinations
5. **Automatic Detection** - No manual configuration needed

## Product Data Requirements

### Required Fields for Grouping
- `name` - Product name (must match exactly for grouping)
- `brand` - Product brand (must match exactly for grouping)

### Variant Fields (Optional)
- `size` - Creates size variant chips (e.g., "10m", "5m", "1L")
- `variety` - Creates variety variant chips (e.g., "Flat Finish", "Glossy")
- `color` - Creates color variant chips (e.g., "White", "Blue", "Red")

### Example Product Entry

```json
{
  "sku": "PAINT-PRO-FLAT-1L",
  "name": "ProPaint",
  "brand": "ProBrand",
  "variety": "Flat Finish",
  "size": "1L",
  "color": "White",
  "unit": "can",
  "cost_price": 120.00,
  "selling_price": 180.00
}
```

## Edge Cases

### Products Without Variants

If a product has no size, variety, or color attributes, it displays normally without variant chips.

### Single Variant

If only one product exists with a given brand+name combination, it displays without variant chips.

### Mixed Attributes

Products can have any combination of size/variety/color. The system shows chips for all detected variant types.

## Technical Details

### Location
- File: `frontend/src/pages/CashierPOS.tsx`
- Function: `groupProductsByVariants()`

### Algorithm
1. Normalize brand and name to lowercase
2. Create grouping key: `brand_name`
3. Add products to groups by key
4. Detect variant types by comparing attributes
5. Display variant chips for each type detected

### Performance
- Grouping happens client-side during search
- Efficient Map-based lookups
- No database changes required

## Troubleshooting

### Products Not Grouping

**Problem**: Products with same brand/name don't group together

**Solutions**:
1. Check brand spelling is exactly the same (case-insensitive)
2. Check name spelling is exactly the same (case-insensitive)
3. Remove extra spaces from brand/name fields
4. Ensure products are in the search results

### Variant Chips Not Showing

**Problem**: Products group but no variant chips appear

**Solutions**:
1. Ensure at least one variant field (size/variety/color) is different
2. Check that variant fields contain values
3. Verify products have the same brand+name combination

## Future Enhancements

Potential improvements for future versions:

1. **Custom Grouping Rules** - Allow admins to define custom grouping logic
2. **Variant Thumbnails** - Show product images for color variants
3. **Variant Sorting** - Custom sort order for variant chips
4. **Variant Filters** - Filter product list by specific variants
5. **Bulk Variant Creation** - Wizard for creating multiple variants at once
