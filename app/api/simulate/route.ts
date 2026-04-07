import { NextRequest, NextResponse } from 'next/server';

const TEALIUM_ACCOUNT = 'sbx-launchdarkly';
const TEALIUM_PROFILE = 'main';
const TEALIUM_COLLECT_URL = 'https://collect.tealiumiq.com/event';

const PRODUCTS = [
  { id: 'SKU-001', name: 'Premium Headphones', price: 149.99, category: 'Electronics' },
  { id: 'SKU-002', name: 'Running Shoes', price: 89.99, category: 'Footwear' },
  { id: 'SKU-003', name: 'Coffee Maker', price: 59.99, category: 'Kitchen' },
  { id: 'SKU-004', name: 'Yoga Mat', price: 29.99, category: 'Fitness' },
  { id: 'SKU-005', name: 'Backpack', price: 74.99, category: 'Accessories' },
  { id: 'SKU-006', name: 'Wireless Mouse', price: 34.99, category: 'Electronics' },
  { id: 'SKU-007', name: 'Water Bottle', price: 19.99, category: 'Fitness' },
  { id: 'SKU-008', name: 'Desk Lamp', price: 44.99, category: 'Home Office' },
];

const PAGES = ['Homepage', 'Product List', 'Product Detail', 'Cart', 'Checkout', 'Order Confirmation', 'About', 'Blog', 'FAQ', 'Contact'];
const STATES = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];

interface SimUser {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  customerType: string;
  country: string;
}

interface TealiumResult {
  user: string;
  eventType: string;
  status: 'sent' | 'error';
  detail: string;
  httpStatus?: number;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPageViewPayload(user: SimUser) {
  const page = randomItem(PAGES);
  return {
    tealium_account: TEALIUM_ACCOUNT,
    tealium_profile: TEALIUM_PROFILE,
    tealium_visitor_id: user.key,
    tealium_event: 'page_view',
    data: {
      page_name: page,
      page_type: page.toLowerCase().replace(/\s/g, '_'),
      customer_id: user.key,
      customer_type: user.customerType,
      country_code: user.country,
      currency_code: user.country === 'UK' ? 'GBP' : user.country === 'DE' ? 'EUR' : 'USD',
    },
    _detail: `page_view: ${page}`,
  };
}

function buildProductViewPayload(user: SimUser) {
  const product = randomItem(PRODUCTS);
  return {
    tealium_account: TEALIUM_ACCOUNT,
    tealium_profile: TEALIUM_PROFILE,
    tealium_visitor_id: user.key,
    tealium_event: 'product_view',
    data: {
      event_name: 'product-viewed',
      page_name: 'Product Detail',
      product_id: [product.id],
      product_name: [product.name],
      product_price: [String(product.price)],
      product_unit_price: [product.price],
      product_quantity: [1],
      product_category: [product.category],
      customer_id: user.key,
      customer_type: user.customerType,
    },
    _detail: `product_view: ${product.name} ($${product.price})`,
  };
}

function buildAddToCartPayload(user: SimUser) {
  const product = randomItem(PRODUCTS);
  return {
    tealium_account: TEALIUM_ACCOUNT,
    tealium_profile: TEALIUM_PROFILE,
    tealium_visitor_id: user.key,
    tealium_event: 'cart_add',
    data: {
      event_name: 'add-to-cart',
      product_id: [product.id],
      product_name: [product.name],
      product_price: [String(product.price)],
      product_unit_price: [product.price],
      product_quantity: [1],
      customer_id: user.key,
    },
    _detail: `add_to_cart: ${product.name}`,
  };
}

function buildPurchasePayload(user: SimUser) {
  // Pick 1-3 random products for the cart
  const cartSize = 1 + Math.floor(Math.random() * 3);
  const cart = Array.from({ length: cartSize }, () => randomItem(PRODUCTS));
  const subtotal = cart.reduce((sum, p) => sum + p.price, 0);
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const shipping = subtotal > 100 ? 0 : 5.99;
  const orderTotal = subtotal + tax + shipping;
  const orderId = 'ORD-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  const state = randomItem(STATES);
  const zip = String(10000 + Math.floor(Math.random() * 89999));

  return {
    tealium_account: TEALIUM_ACCOUNT,
    tealium_profile: TEALIUM_PROFILE,
    tealium_visitor_id: user.key,
    tealium_event: 'purchase',
    data: {
      event_name: 'purchase-complete',
      order_id: orderId,
      order_total: String(orderTotal.toFixed(2)),
      order_subtotal: String(subtotal.toFixed(2)),
      order_tax: String(tax.toFixed(2)),
      order_shipping: String(shipping.toFixed(2)),
      order_currency: 'USD',
      product_id: cart.map(p => p.id),
      product_name: cart.map(p => p.name),
      product_price: cart.map(p => String(p.price)),
      product_unit_price: cart.map(p => p.price),
      product_quantity: cart.map(() => 1),
      product_on_page: cart.map(p => p.name),
      customer_id: user.key,
      customer_type: user.customerType,
      customer_email: user.email,
      customer_country: user.country,
      customer_state: state,
      customer_zip: zip,
    },
    _detail: `purchase: ${orderId} ($${subtotal.toFixed(2)})`,
  };
}

async function sendToTealiumCollect(
  payload: Record<string, unknown>,
  user: SimUser,
  eventType: string
): Promise<TealiumResult> {
  // Extract _detail before sending
  const detail = payload._detail as string;
  const sendPayload = { ...payload };
  delete sendPayload._detail;

  try {
    const resp = await fetch(TEALIUM_COLLECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sendPayload),
    });

    return {
      user: `${user.firstName} ${user.lastName[0]}.`,
      eventType,
      status: resp.ok ? 'sent' : 'error',
      detail,
      httpStatus: resp.status,
    };
  } catch (err) {
    return {
      user: `${user.firstName} ${user.lastName[0]}.`,
      eventType,
      status: 'error',
      detail: `${detail} - ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      users: SimUser[];
      eventType: string;
    };

    const { users, eventType } = body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'users array is required' }, { status: 400 });
    }

    const results: TealiumResult[] = [];

    for (const user of users) {
      let payload: Record<string, unknown>;

      switch (eventType) {
        case 'page_view':
          payload = buildPageViewPayload(user);
          break;
        case 'product_view':
          payload = buildProductViewPayload(user);
          break;
        case 'add_to_cart':
          payload = buildAddToCartPayload(user);
          break;
        case 'purchase':
          payload = buildPurchasePayload(user);
          break;
        case 'mixed': {
          // Pick a random event type for each user
          const rand = Math.random();
          if (rand < 0.25) payload = buildPageViewPayload(user);
          else if (rand < 0.50) payload = buildProductViewPayload(user);
          else if (rand < 0.75) payload = buildAddToCartPayload(user);
          else payload = buildPurchasePayload(user);
          break;
        }
        default:
          payload = buildPageViewPayload(user);
      }

      const result = await sendToTealiumCollect(payload, user, eventType);
      results.push(result);
    }

    const sentCount = results.filter(r => r.status === 'sent').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        sent: sentCount,
        errors: errorCount,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
