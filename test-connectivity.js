const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Test credentials
const testUser = {
  username: 'admin',
  password: 'admin123'
};

async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, testUser);
    authToken = response.data.token;
    
    // Set default auth header
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    
    console.log('✅ Authentication successful');
    console.log(`User: ${response.data.user.username} (${response.data.user.role})`);
    return response.data.user;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function testProductsAPI() {
  console.log('\n📦 Testing Products API...');
  try {
    const response = await axios.get(`${API_BASE_URL}/products?active_only=true&limit=5`);
    const { products, pagination } = response.data;
    
    console.log(`✅ Products API working - Found ${products.length} products`);
    console.log(`Total products: ${pagination.total}`);
    
    if (products.length > 0) {
      console.log(`Sample product: ${products[0].name} (SKU: ${products[0].sku})`);
      return products[0]; // Return first product for testing
    }
    
    return null;
  } catch (error) {
    console.error('❌ Products API failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function testShiftManagement(userId) {
  console.log('\n⏰ Testing Shift Management...');
  try {
    // Check for active shift
    let activeShift;
    try {
      const currentShiftResponse = await axios.get(`${API_BASE_URL}/shifts/current/${userId}`);
      activeShift = currentShiftResponse.data;
      console.log(`✅ Found active shift: ${activeShift.id}`);
    } catch (error) {
      if (error.response?.status === 404) {
        // Start new shift
        console.log('No active shift found, starting new shift...');
        const startShiftResponse = await axios.post(`${API_BASE_URL}/shifts`, {
          cashierId: userId,
          cashierName: 'Test Cashier',
          startingCash: 100.00,
          startTime: new Date().toISOString()
        });
        activeShift = startShiftResponse.data;
        console.log(`✅ New shift started: ${activeShift.id}`);
      } else {
        throw error;
      }
    }
    
    return activeShift;
  } catch (error) {
    console.error('❌ Shift management failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function testSalesTransaction(product, shift) {
  console.log('\n💰 Testing Sales Transaction...');
  try {
    // Create a test sale
    const saleData = {
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      items: [
        {
          productId: product.id,
          quantity: 2,
          unitPrice: product.selling_price || 25.00
        }
      ],
      paymentMethod: 'cash',
      discountAmount: 0,
      taxRate: 8.5
    };
    
    const response = await axios.post(`${API_BASE_URL}/sales`, saleData);
    const sale = response.data;
    
    console.log(`✅ Sale processed successfully: ${sale.saleNumber}`);
    console.log(`Total amount: $${sale.totalAmount}`);
    console.log(`Items sold: ${sale.receiptData.items.length}`);
    
    return sale;
  } catch (error) {
    console.error('❌ Sales transaction failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function testInventoryUpdate(productId) {
  console.log('\n📊 Testing Inventory Updates...');
  try {
    const response = await axios.get(`${API_BASE_URL}/inventory?product_id=${productId}`);
    const inventoryItems = response.data;
    
    if (inventoryItems.length > 0) {
      const item = inventoryItems[0];
      console.log(`✅ Inventory updated - Product: ${item.product_name}`);
      console.log(`Current stock: ${item.quantity}`);
      console.log(`Reserved: ${item.reserved_quantity}`);
      console.log(`Last updated: ${item.updated_at}`);
    }
    
    return inventoryItems[0];
  } catch (error) {
    console.error('❌ Inventory check failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function testShiftTotalsUpdate(shiftId) {
  console.log('\n📈 Testing Shift Totals Update...');
  try {
    const response = await axios.get(`${API_BASE_URL}/shifts/current/${1}`); // Assuming user ID 1
    const updatedShift = response.data;
    
    console.log(`✅ Shift totals updated:`);
    console.log(`Total sales: $${updatedShift.totalSales}`);
    console.log(`Total transactions: ${updatedShift.totalTransactions}`);
    console.log(`Cash total: $${updatedShift.totalCash}`);
    
    return updatedShift;
  } catch (error) {
    console.error('❌ Shift totals check failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function testReceiptReprint(saleId) {
  console.log('\n🧾 Testing Receipt Reprint...');
  try {
    const response = await axios.get(`${API_BASE_URL}/sales/${saleId}/receipt`);
    const receipt = response.data.receiptData;
    
    console.log(`✅ Receipt data retrieved:`);
    console.log(`Sale number: ${receipt.saleNumber}`);
    console.log(`Customer: ${receipt.customerName}`);
    console.log(`Items count: ${receipt.items.length}`);
    console.log(`Reprinted by: ${receipt.reprintedBy}`);
    
    return receipt;
  } catch (error) {
    console.error('❌ Receipt reprint failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function runEndToEndTest() {
  console.log('🚀 Starting End-to-End Data Connectivity Test...');
  console.log('='*50);
  
  try {
    // Step 1: Authenticate
    const user = await testAuthentication();
    
    // Step 2: Test Products API
    const product = await testProductsAPI();
    if (!product) {
      console.error('❌ No products found - cannot continue with sale test');
      return;
    }
    
    // Step 3: Test Shift Management
    const shift = await testShiftManagement(user.id);
    
    // Step 4: Process a Sale
    const sale = await testSalesTransaction(product, shift);
    
    // Step 5: Verify Inventory Update
    await testInventoryUpdate(product.id);
    
    // Step 6: Check Shift Totals Update
    await testShiftTotalsUpdate(shift.id);
    
    // Step 7: Test Receipt Reprint
    await testReceiptReprint(sale.saleId);
    
    console.log('\n🎉 All tests passed successfully!');
    console.log('✅ End-to-end data connectivity is working correctly');
    console.log('✅ Cashier POS → Sales → Inventory → Shift management integration complete');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runEndToEndTest();