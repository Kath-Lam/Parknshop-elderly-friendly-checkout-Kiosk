// 本地商品資料庫。所有價格以港幣「分」儲存，避免小數計算誤差。
// barcode 現為課堂展示編號；取得實際包裝條碼後只需更換這個欄位。
const PRODUCT_RECORDS = [
  {
    id: 'blueberries',
    sku: 'PNS-0001',
    barcode: '75568',
    name: '藍莓',
    en: 'BLUEBERRIES',
    price: 1600,
    currency: 'HKD',
    image: 'assets/products/blueberries.jpg',
    icon: 'berries',
    category: 'produce',
    active: true,
  },
  {
    id: 'milk',
    sku: 'PNS-0002',
    barcode: '10243',
    name: '鮮牛奶 250毫升',
    en: 'FRESH MILK 250ML',
    shortName: '鮮牛奶',
    shortEn: 'FRESH MILK',
    spec: '250 毫升',
    specEn: '250 ml',
    price: 1290,
    currency: 'HKD',
    image: 'assets/products/milk.jpg',
    icon: 'milk',
    category: 'grocery',
    active: true,
  },
  {
    id: 'bread',
    sku: 'PNS-0003',
    barcode: '30421',
    name: '全麥方包',
    en: 'WHOLEMEAL BREAD',
    price: 1850,
    currency: 'HKD',
    image: 'assets/products/bread.jpg',
    icon: 'bread',
    category: 'grocery',
    active: true,
  },
  {
    id: 'orange',
    sku: 'PNS-0004',
    barcode: '60018',
    name: '橙',
    en: 'ORANGE',
    price: 650,
    currency: 'HKD',
    image: 'assets/products/orange.jpg',
    icon: 'orange',
    category: 'produce',
    active: true,
  },
];

function normalizeBarcode(value) {
  return String(value ?? '').trim().replace(/[\s-]/g, '');
}

function freezeProduct(product) {
  return Object.freeze({...product});
}

export const PRODUCT_DATABASE = Object.freeze(PRODUCT_RECORDS.map(freezeProduct));

const PRODUCT_BY_ID = new Map();
const PRODUCT_BY_BARCODE = new Map();

for (const product of PRODUCT_DATABASE) {
  if (PRODUCT_BY_ID.has(product.id)) throw new Error(`Duplicate product id: ${product.id}`);
  PRODUCT_BY_ID.set(product.id, product);

  const barcode = normalizeBarcode(product.barcode);
  if (!barcode) throw new Error(`Missing barcode: ${product.id}`);
  if (PRODUCT_BY_BARCODE.has(barcode)) throw new Error(`Duplicate barcode: ${barcode}`);
  PRODUCT_BY_BARCODE.set(barcode, product);
}

export function findProductById(id) {
  return PRODUCT_BY_ID.get(String(id ?? ''));
}

export function findProductByBarcode(barcode) {
  return PRODUCT_BY_BARCODE.get(normalizeBarcode(barcode));
}

export function activeProducts() {
  return PRODUCT_DATABASE.filter(product => product.active);
}
