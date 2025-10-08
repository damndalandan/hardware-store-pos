# VAT Settings Quick Guide

## 📍 Location
**Settings > Tax Rates > VAT Configuration**

## ⚙️ Available Settings

### 1️⃣ Default VAT Rate
```
Field: Percentage input
Default: 12%
Example: 12.00
```
**What it does:** Sets the VAT percentage applied to all sales

### 2️⃣ VAT-Inclusive Pricing
```
Toggle: ON/OFF
Default: ON (Prices include VAT)
```
**ON:** ₱19.99 stays ₱19.99 (VAT already included)  
**OFF:** ₱19.99 becomes ₱22.39 (VAT added at checkout)

### 3️⃣ Show VAT Breakdown
```
Toggle: ON/OFF
Default: ON (Show breakdown)
```
**ON:** Receipt shows VATABLE SALE + VAT separately  
**OFF:** Receipt shows only total amount

### 4️⃣ VAT-Registered Business
```
Toggle: ON/OFF
Default: ON (VAT-Registered)
```
**ON:** Must comply with BIR VAT regulations  
**OFF:** Non-VAT business (no VAT reporting)

## 📊 Receipt Examples

### With Breakdown (ON)
```
VATABLE SALE (Less VAT):  ₱17.85
VAT (12%):                 ₱2.14
───────────────────────────────
TOTAL AMOUNT DUE:         ₱19.99
```

### Without Breakdown (OFF)
```
TOTAL AMOUNT DUE:         ₱19.99
```

## 🇵🇭 Philippine Standard (Recommended)
```
✓ VAT Rate: 12%
✓ VAT-Inclusive: ON
✓ Show Breakdown: ON
✓ VAT-Registered: ON
```

## 🔒 Permissions
- **Admin:** Can modify all settings
- **Manager:** Can view only
- **Cashier:** No access

## 💾 Saving
Changes are saved **automatically** when you toggle or update a setting.

## 📖 BIR Formula
```
Price ÷ 1.12 = VATABLE SALE
VATABLE SALE × 0.12 = VAT
VATABLE SALE + VAT = Price
```

## ⚠️ Important Notes
- Settings apply to **new sales** only
- Historical sales remain unchanged
- VAT-registered businesses **must** show breakdown (BIR requirement)
- Default settings comply with Philippine tax laws
