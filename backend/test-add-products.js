const axios = require('axios');

// Test script to add sample products (paint with color variants, hardware with size variants)
// Usage: node test-add-products.js
// Ensure the backend API is running (default: http://localhost:5000/api)

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';

let AUTH_TOKEN = process.env.API_TOKEN || null;

async function loginAndSetToken() {
  if (AUTH_TOKEN) return;
  const username = process.env.TEST_ADMIN_USER || 'admin';
  const password = process.env.TEST_ADMIN_PASS || 'admin123';
  try {
    const resp = await axios.post(`${API_BASE}/auth/login`, { username, password });
    AUTH_TOKEN = resp.data.token;
    console.log('Authenticated as', username);
  } catch (err) {
    console.error('Failed to login test user', err.response?.data || err.message);
    throw err;
  }
}

async function createProduct(payload) {
  try {
    await loginAndSetToken();
    const resp = await axios.post(`${API_BASE}/products`, payload, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } });
    return resp.data;
  } catch (err) {
    console.error('API error creating product', payload.sku || payload.name, err.response?.data || err.message);
    return null;
  }
}

async function addPaintWithColors() {
  console.log('Adding paint product with color variants...');

  const base = {
    sku: 'PAINT-BASE',
    barcode: null,
    name: 'Interior Paint Base',
    brand: 'ProPaint',
    description: 'Base product for interior paint variants',
    categoryId: null,
    size: '1L',
    variety: null,
    color: null,
    unit: 'ltr',
    costPrice: 8.5,
    sellingPrice: 15.0,
    minStockLevel: 5,
    maxStockLevel: 200,
    supplierId: null,
    initialStock: 50
  };

  // Create base product (optional)
  const baseResp = await createProduct({ ...base, sku: 'PAINT-BASE-000' });
  if (baseResp) console.log('Created base paint product id:', baseResp.id || baseResp);

  const colors = ['White', 'Off White', 'Beige', 'Light Blue'];
  let count = 0;
  for (const color of colors) {
    const sku = `PAINT-${color.replace(/\s+/g, '').toUpperCase().slice(0, 12)}-1L`;
    const payload = {
      ...base,
      sku,
      name: `Interior Paint - ${color} (1L)`,
      color,
      barcode: null,
      initialStock: 30
    };
    const res = await createProduct(payload);
    if (res) {
      count++;
      console.log(`  ✅ Created variant: ${payload.name} (sku=${sku})`);
    }
  }
  console.log(`Paint variants created: ${count}/${colors.length}`);
}

async function addHardwareWithSizes() {
  console.log('Adding hardware product with size variants...');

  const base = {
    sku: 'BOLT-BASE',
    barcode: null,
    name: 'Hex Bolt',
    brand: 'FastenersCo',
    description: 'Standard hex bolt',
    categoryId: null,
    size: null,
    variety: null,
    color: null,
    unit: 'pcs',
    costPrice: 0.12,
    sellingPrice: 0.30,
    minStockLevel: 10,
    maxStockLevel: 10000,
    supplierId: null,
    initialStock: 500
  };

  const sizes = ['M6', 'M8', 'M10', 'M12'];
  let count = 0;
  for (const size of sizes) {
    const sku = `BOLT-${size}`;
    const payload = {
      ...base,
      sku,
      name: `Hex Bolt ${size}`,
      size,
      costPrice: base.costPrice * (size === 'M6' ? 1 : size === 'M8' ? 1.2 : size === 'M10' ? 1.5 : 1.8),
      sellingPrice: +( (base.costPrice * (size === 'M6' ? 1 : size === 'M8' ? 1.2 : size === 'M10' ? 1.5 : 1.8)) * 2.5 ).toFixed(2),
      initialStock: size === 'M12' ? 200 : 500
    };
    const res = await createProduct(payload);
    if (res) {
      count++;
      console.log(`  ✅ Created size variant: ${payload.name} (sku=${sku})`);
    }
  }
  console.log(`Hardware size variants created: ${count}/${sizes.length}`);
}

async function runAll() {
  console.log('Using API base:', API_BASE);
  await addPaintWithColors();
  await addHardwareWithSizes();
  console.log('Done.');
}

runAll().catch(err => { console.error('Script failed', err); process.exit(1); });
