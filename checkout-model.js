import {activeProducts, findProductById, findProductByBarcode} from './product-database.js';

export const PRODUCTS = Object.freeze(activeProducts());
export const MAX_QUANTITY = 99;
export const BAG_PRICE = 100;
export const productById = findProductById;
export const productByBarcode = findProductByBarcode;
export const money = cents => '$' + (cents / 100).toFixed(2);

export function createCart() { return {items: [], bags: 0}; }

export function setQuantity(cart, id, quantity) {
  if (!productById(id)) throw new Error('Unknown product');
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) throw new Error('Invalid quantity');
  const items = cart.items.filter(item => item.id !== id);
  const index = cart.items.findIndex(item => item.id === id);
  if (quantity > 0) items.splice(index < 0 ? items.length : index, 0, {id, quantity});
  return {...cart, items};
}

export function addItem(cart, id) {
  const quantity = (cart.items.find(item => item.id === id)?.quantity || 0) + 1;
  return setQuantity(cart, id, quantity);
}

export function setBags(cart, quantity) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9) throw new Error('Invalid bag quantity');
  return {...cart, bags: quantity};
}

export function totals(cart) {
  let subtotal = 0, quantity = 0;
  for (const item of cart.items) {
    const product = productById(item.id);
    if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) throw new Error('Invalid cart');
    subtotal += product.price * item.quantity;
    quantity += item.quantity;
  }
  const blueberries = cart.items.find(item => item.id === 'blueberries')?.quantity || 0;
  const discount = Math.floor(blueberries / 2) * 800;
  const bagCharge = cart.bags * BAG_PRICE;
  return {quantity, subtotal, discount, bagCharge, total: subtotal - discount + bagCharge};
}

export function exampleCart() { return {items: [{id: 'blueberries', quantity: 2}], bags: 0}; }
