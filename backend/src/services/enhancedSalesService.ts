import { Pool, PoolConnection } from 'mysql2/promise';
import { logger } from '../utils/logger';
import { RowDataPacket } from 'mysql2';

export interface PaymentSplit {
  paymentMethod: string;
  amount: number;
  referenceNumber?: string;
  notes?: string;
}

export interface EnhancedSaleData {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAccountId?: number; // For AR transactions
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
  }>;
  paymentSplits: PaymentSplit[]; // Multiple payment methods
  taxRate?: number;
  discountAmount?: number;
  shiftId?: number;
  cashierId: number;
}

/**
 * Process an enhanced sale with multi-payment support
 */
export async function processEnhancedSale(
  pool: Pool,
  saleData: EnhancedSaleData
): Promise<{
  saleId: number;
  saleNumber: string;
  totalAmount: number;
  receiptData: any;
}> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAccountId,
      items,
      paymentSplits,
      taxRate = 0,
      discountAmount = 0,
      shiftId,
      cashierId
    } = saleData;

    // Validate payment splits
    if (!paymentSplits || paymentSplits.length === 0) {
      throw new Error('At least one payment method is required');
    }

    // Calculate item totals
    let subtotal = 0;
    const saleItems = [];

    for (const item of items) {
      const { productId, quantity, unitPrice, discountAmount: itemDiscount = 0 } = item;

      // Validate product
      const [productRows] = await connection.execute(
        'SELECT id, name, sku, is_active FROM products WHERE id = ? AND is_active = 1',
        [productId]
      );
      const product = (productRows as any[])[0];

      if (!product) {
        throw new Error(`Product with ID ${productId} not found or inactive`);
      }

      // Check inventory
      const [inventoryRows] = await connection.execute(
        'SELECT current_stock FROM inventory WHERE product_id = ?',
        [productId]
      );
      const inventory = (inventoryRows as any[])[0];

      const availableQuantity = inventory?.current_stock || 0;
      if (availableQuantity < quantity) {
        throw new Error(`Insufficient inventory for ${product.name}. Available: ${availableQuantity}`);
      }

      const itemTotal = quantity * unitPrice - itemDiscount;
      subtotal += itemTotal;

      saleItems.push({
        productId,
        quantity,
        unitPrice,
        discountAmount: itemDiscount,
        totalPrice: itemTotal,
        productName: product.name,
        sku: product.sku
      });
    }

    // VAT-inclusive calculation (Philippine BIR format)
    // Price already includes 12% VAT
    // Formula: totalWithVat = vatableSale * 1.12
    // Therefore: vatableSale = totalWithVat / 1.12, vat = vatableSale * 0.12
    const totalWithVat = subtotal - discountAmount;
    const vatRate = taxRate > 0 ? taxRate / 100 : 0.12; // Default to 12% VAT if not specified
    const vatDivisor = 1 + vatRate;
    const vatableSale = totalWithVat / vatDivisor; // Less VAT (VATABLE SALE)
    const taxAmount = vatableSale * vatRate; // VAT amount
    const totalAmount = totalWithVat; // Total already includes VAT

    // Validate payment splits total matches sale total
    const paymentTotal = paymentSplits.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paymentTotal - totalAmount) > 0.01) {
      throw new Error(`Payment total (₱${paymentTotal.toFixed(2)}) does not match sale total (₱${totalAmount.toFixed(2)})`);
    }

    // Generate sale number
    const saleNumber = `SALE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Determine primary payment method (largest amount) for backward compatibility
    const primaryPayment = paymentSplits.reduce((max, p) => p.amount > max.amount ? p : max);

    // Find or create customer if customer name is provided
    let customerId: number | null = null;
    if (customerName && customerName.trim()) {
      try {
        // Check if customer exists (case-insensitive)
        const [existingCustomers] = await connection.execute<RowDataPacket[]>(
          'SELECT id FROM customers WHERE LOWER(customer_name) = LOWER(?)',
          [customerName.trim()]
        );

        if (existingCustomers.length > 0) {
          customerId = existingCustomers[0].id;
        } else {
          // Create new customer
          const [customerResult] = await connection.execute(`
            INSERT INTO customers (customer_name, phone, email, total_purchases, last_purchase_date)
            VALUES (?, ?, ?, 0, NOW())
          `, [customerName.trim(), customerPhone || null, customerEmail || null]);
          customerId = (customerResult as any).insertId;
          logger.info(`Auto-created customer: ${customerName} (ID: ${customerId})`);
        }
      } catch (error) {
        logger.warn(`Failed to create/link customer: ${error}`);
        // Continue with sale even if customer linking fails
      }
    }

    // Insert sale record
    const [saleResult] = await connection.execute(`
      INSERT INTO sales (
        sale_number, customer_id, customer_name, customer_email, customer_phone,
        subtotal, tax_amount, discount_amount, total_amount,
        payment_method, payment_status, cashier_id, shift_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `, [
      saleNumber,
      customerId || null,
      customerName || null,
      customerEmail || null,
      customerPhone || null,
      vatableSale,  // VATABLE SALE (Less VAT) for BIR compliance
      taxAmount,    // VAT amount (12%)
      discountAmount,
      totalAmount,  // Total with VAT included
      primaryPayment.paymentMethod, // Primary method for legacy support
      cashierId,
      shiftId || null
    ]) as any;

    const saleId = saleResult.insertId;

    // Insert payment splits
    for (const split of paymentSplits) {
      await connection.execute(`
        INSERT INTO payment_splits (
          sale_id, payment_method_code, amount, reference_number, notes
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        saleId,
        split.paymentMethod,
        split.amount,
        split.referenceNumber || null,
        split.notes || null
      ]);
    }

    // Insert sale items and update inventory
    for (const item of saleItems) {
      await connection.execute(`
        INSERT INTO sale_items (
          sale_id, product_id, quantity, unit_price, discount_amount, total_price
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [saleId, item.productId, item.quantity, item.unitPrice, item.discountAmount, item.totalPrice]);

      // Update inventory
      await connection.execute(
        'UPDATE inventory SET current_stock = current_stock - ? WHERE product_id = ?',
        [item.quantity, item.productId]
      );

      // Record inventory transaction
      await connection.execute(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, quantity_change, reference_id, reference_type, created_by
        ) VALUES (?, 'sale', ?, ?, 'sale', ?)
      `, [item.productId, -item.quantity, saleId, cashierId]);
    }

    // Handle AR transaction if customer account is specified
    if (customerAccountId) {
      const arPayment = paymentSplits.find(p => p.paymentMethod === 'AR');
      if (arPayment && arPayment.amount > 0) {
        // Get current balance
        const [customerRows] = await connection.execute(
          'SELECT current_balance, credit_limit FROM customer_accounts WHERE id = ?',
          [customerAccountId]
        );
        const customer = (customerRows as any[])[0];

        if (!customer) {
          throw new Error(`Customer account ${customerAccountId} not found`);
        }

        const newBalance = parseFloat(customer.current_balance) + arPayment.amount;
        if (newBalance > parseFloat(customer.credit_limit)) {
          throw new Error(`Transaction exceeds customer credit limit`);
        }

        // Create AR transaction
        await connection.execute(`
          INSERT INTO ar_transactions (
            customer_account_id, sale_id, transaction_type, amount,
            balance_after, payment_method, reference_number, processed_by
          ) VALUES (?, ?, 'charge', ?, ?, 'AR', ?, ?)
        `, [customerAccountId, saleId, arPayment.amount, newBalance, saleNumber, cashierId]);

        // Update customer balance
        await connection.execute(
          'UPDATE customer_accounts SET current_balance = ? WHERE id = ?',
          [newBalance, customerAccountId]
        );
      }
    }

    // Update shift totals
    await updateShiftTotals(connection, cashierId, totalAmount, paymentSplits);

    // Update customer purchase statistics
    if (customerId) {
      try {
        await connection.execute(`
          UPDATE customers 
          SET total_purchases = total_purchases + ?,
              last_purchase_date = NOW()
          WHERE id = ?
        `, [totalAmount, customerId]);
        logger.info(`Updated customer ${customerId} purchase stats: +$${totalAmount}`);
      } catch (error) {
        logger.warn(`Failed to update customer purchase stats: ${error}`);
        // Non-fatal, continue with sale
      }
    }

    await connection.commit();

    logger.info(`Enhanced sale completed: ${saleNumber} for $${totalAmount}`);

    return {
      saleId,
      saleNumber,
      totalAmount,
      receiptData: {
        saleNumber,
        customerName,
        items: saleItems,
        subtotal: vatableSale,  // VATABLE SALE (Less VAT)
        taxAmount,              // VAT (12%)
        discountAmount,
        totalAmount,            // Total with VAT
        paymentSplits,
        saleDate: new Date().toISOString()
      }
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update shift totals with payment breakdown
 */
async function updateShiftTotals(
  connection: PoolConnection,
  cashierId: number,
  totalAmount: number,
  paymentSplits: PaymentSplit[]
): Promise<void> {
  try {
    const [shiftRows] = await connection.execute(
      'SELECT id FROM shifts WHERE cashier_id = ? AND is_active = 1',
      [cashierId]
    );
    const activeShift = (shiftRows as any[])[0];

    if (!activeShift) {
      return; // No active shift, skip update
    }

    // Calculate payment method totals
    const cashAmount = paymentSplits.filter(p => p.paymentMethod === 'CASH').reduce((sum, p) => sum + p.amount, 0);
    const cardAmount = paymentSplits.filter(p => p.paymentMethod === 'CREDIT_CARD').reduce((sum, p) => sum + p.amount, 0);
    const mobileAmount = paymentSplits.filter(p => ['GCASH', 'QR_PH', 'BANK_TRANSFER'].includes(p.paymentMethod)).reduce((sum, p) => sum + p.amount, 0);
    const checkAmount = paymentSplits.filter(p => p.paymentMethod === 'CHECK').reduce((sum, p) => sum + p.amount, 0);

    await connection.execute(`
      UPDATE shifts 
      SET total_sales = total_sales + ?,
          total_transactions = total_transactions + 1,
          total_cash = total_cash + ?,
          total_card = total_card + ?,
          total_mobile = total_mobile + ?,
          total_check = total_check + ?
      WHERE id = ?
    `, [totalAmount, cashAmount, cardAmount, mobileAmount, checkAmount, activeShift.id]);

  } catch (error) {
    logger.warn('Failed to update shift totals:', error);
    // Non-fatal, just log the warning
  }
}
