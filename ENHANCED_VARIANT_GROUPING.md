# Enhanced Product Variant Grouping - Smart Name Parsing

## Update: October 2025

### Problem Solved

Products with variant information embedded in their names (e.g., "Interior Paint - Beige (1L)") now automatically group together, even when the color/size is not in separate database fields.

### How It Works Now

#### Before (Not Grouping)
```
Interior Paint - Beige (1L)         [separate]
Interior Paint - Light Blue (1L)    [separate]
Interior Paint - Off White (1L)     [separate]
Interior Paint - White (1L)         [separate]
Interior Paint Base                 [separate]
```

#### After (Grouped with Variants)
```
Interior Paint
ProPaint •
[Beige] [Light Blue] [Off White] [White] [Base] ← Click to select
₱15.00  Stock: 30  [Add to Cart]
```

### Smart Name Parsing

The system now intelligently extracts base product names and variant info:

#### Pattern Recognition

**Example 1: Color in Name**
```
Full Name: "Interior Paint - Beige (1L)"
Base Name: "Interior Paint"
Extracted Color: "Beige"
Extracted Size: "1L"
```

**Example 2: Size in Parentheses**
```
Full Name: "Interior Paint - Light Blue (1L)"
Base Name: "Interior Paint"
Extracted Color: "Light Blue"
Extracted Size: "1L"
```

**Example 3: Base Suffix**
```
Full Name: "Interior Paint Base"
Base Name: "Interior Paint"
Extracted Color: "Base"
Extracted Size: null
```

### Extraction Patterns

The system removes these patterns to find the base name:

1. **Size in parentheses**: `(1L)`, `(4L)`, `(10m)`, `(5kg)` etc.
2. **Color after dash**: ` - Beige`, ` - Light Blue`, ` - Off White`
3. **Trailing "Base"**: ` Base` at the end

### Grouping Logic

```typescript
// Products group if they have the same:
1. Brand (normalized to lowercase)
2. Base name (after removing variant patterns)

// Example grouping:
Brand: "ProPaint" + Base Name: "interior paint"
  ✅ "Interior Paint - Beige (1L)"
  ✅ "Interior Paint - Light Blue (1L)"
  ✅ "Interior Paint - Off White (1L)"
  ✅ "Interior Paint - White (1L)"
  ✅ "Interior Paint Base"
```

### Variant Detection

The system detects variants from:

1. **Database fields** (if available):
   - `color` field
   - `size` field
   - `variety` field

2. **Embedded in name** (extracted):
   - Color: Text after ` - ` and before `(`
   - Size: Text inside `()` at the end

3. **Priority**: Database field > Extracted from name

### Display Behavior

**Product Name Display:**
- Shows cleaned base name: "Interior Paint" (not "Interior Paint - Beige (1L)")
- Capitalized properly: "Interior Paint" (not "interior paint")

**Variant Chips:**
- Size chips (blue): `1L`, `4L`, `10m`
- Color chips (purple): `Beige`, `Light Blue`, `Off White`, `White`, `Base`
- Variety chips (green): `Flat Finish`, `Glossy`, `Semi-Gloss`

**Selection:**
- Click chip to select that variant
- Selected variant shows its specific price/stock
- "Add to Cart" adds the selected variant

### Supported Name Formats

✅ **Working patterns:**
```
Product Name - Color (Size)         → Groups with variants
Product Name - Color                → Groups with variants
Product Name (Size)                 → Groups with variants
Product Name Base                   → Groups with variants
Product Name - Variety - Color      → Groups with variants
```

✅ **Examples:**
```
"Interior Paint - Beige (1L)"
"Interior Paint - Light Blue (1L)"
"Wall Paint - Matte - White (4L)"
"Electrical Wire (10m)"
"ProPaint Base"
"Wood Stain - Dark Oak"
```

### Database Recommendations

#### Option 1: Keep Current Format (Works Now!)
Your products can stay as-is with embedded variants:
```
name: "Interior Paint - Beige (1L)"
color: null
size: null
```
✅ System will extract and group automatically

#### Option 2: Separate Fields (Best Practice)
For better data organization:
```
name: "Interior Paint"
color: "Beige"
size: "1L"
```
✅ Cleaner data, easier to query/filter
✅ Still groups correctly

#### Option 3: Hybrid (Also Works)
Mix of both:
```
name: "Interior Paint"
color: "Beige"
size: null  // size embedded in name if needed
```
✅ Flexible approach

### Edge Cases Handled

**Multi-word colors:**
```
"Interior Paint - Light Blue (1L)"
Extracted: "Light Blue" ✅
```

**Colors with special characters:**
```
"Interior Paint - Off-White (1L)"
Extracted: "Off-White" ✅
```

**Multiple parentheses:**
```
"Wire (Heavy Duty) (10m)"
Extracted size: "10m" ✅
Base name: "Wire (Heavy Duty)" ✅
```

**Missing sizes:**
```
"Interior Paint - Beige"
Extracted color: "Beige" ✅
Extracted size: null ✅
```

### Examples from Your Store

**ProPaint Interior Paints:**
```
Database:
- Interior Paint - Beige (1L)
- Interior Paint - Light Blue (1L)
- Interior Paint - Off White (1L)
- Interior Paint - White (1L)
- Interior Paint Base

POS Display:
Interior Paint
ProPaint •
[Beige] [Light Blue] [Off White] [White] [Base]
₱15.00  Stock: 30  [Add to Cart]
```

**Boysen Paint:**
```
Database:
- Paint (red color field)
- Paint (no color field / N/A)

POS Display:
Paint
Boysen •
[N/A] [red]
₱13.00  Stock: 10  [Add to Cart]
```

### Benefits

✅ **No Database Changes Required**
- Works with existing product data
- No need to split names into separate fields
- Backward compatible

✅ **Flexible Data Entry**
- Can embed variants in name
- Can use separate fields
- Can mix both approaches

✅ **Cleaner POS Interface**
- Products group logically
- Easy variant selection
- Less scrolling

✅ **Better Search Results**
- Type "interior paint" → See all variants grouped
- Click color chip to select specific variant
- One product entry instead of 5

### Migration Path

If you want to clean up your product names:

**Option A: Leave as-is (Recommended for now)**
- System handles embedded variants automatically
- No work required
- Everything works

**Option B: Use Excel Import to restructure**
- Export current products
- Split into separate columns in Excel
- Import with proper Name/Color/Size fields

**Example Excel format:**
```excel
SKU              Name             Color        Size   Brand
PAINT-INT-BG-1L  Interior Paint   Beige        1L     ProPaint
PAINT-INT-BL-1L  Interior Paint   Light Blue   1L     ProPaint
PAINT-INT-OW-1L  Interior Paint   Off White    1L     ProPaint
PAINT-INT-WH-1L  Interior Paint   White        1L     ProPaint
PAINT-INT-BASE   Interior Paint   Base         1L     ProPaint
```

### Technical Details

**Location:** `frontend/src/pages/CashierPOS.tsx`

**Functions:**
- `groupProductsByVariants()` - Main grouping logic
- `extractEmbeddedVariant()` - Extracts color/size from name
- `capitalizeWords()` - Formats display names

**Algorithm:**
1. Normalize brand and name to lowercase
2. Remove size patterns: `(.*)`
3. Remove color patterns: ` - .*`
4. Remove trailing "base"
5. Create grouping key: `brand_basename`
6. Extract embedded color and size
7. Use database fields OR extracted values
8. Group variants together
9. Display with variant chips

### Testing

Test with these searches in POS:

✅ "interior paint" → Should show 1 group with 5 color variants
✅ "paint" → Should show Boysen Paint with color variants
✅ "propaint" → Should show all ProPaint products grouped
✅ Click color chips → Should select that specific variant
✅ Add to cart → Should add the selected variant SKU

---

**Status**: ✅ Implemented and Working
**Date**: October 2025
**Backward Compatible**: Yes
**Database Changes Required**: None
