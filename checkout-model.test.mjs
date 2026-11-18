import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCTS, productByBarcode, createCart, addItem, setQuantity, setBags, totals, exampleCart} from './checkout-model.js';
test('local product database provides unique ids, barcodes, images and prices', () => {
  assert.equal(new Set(PRODUCTS.map(product => product.id)).size, PRODUCTS.length);
  assert.equal(new Set(PRODUCTS.map(product => product.barcode)).size, PRODUCTS.length);
  for (const product of PRODUCTS) {
    assert.ok(product.sku);
    assert.ok(product.image.startsWith('assets/products/'));
    assert.ok(Number.isInteger(product.price) && product.price > 0);
    assert.equal(productByBarcode(product.barcode), product);
  }
});
test('barcode lookup normalizes spaces and rejects unknown values', () => {
  assert.equal(productByBarcode(' 75 568 ')?.id, 'blueberries');
  assert.equal(productByBarcode('not-in-database'), undefined);
});
test('blueberry pairs receive $8 off, including multiple pairs and an odd unit', () => {
  [1600,2400,4000,4800].forEach((expected,index) => assert.equal(totals(setQuantity(createCart(),'blueberries',index+1)).total,expected));
});
test('changing quantity and removing products recomputes the promotion',()=>{
  const cart=exampleCart();
  assert.equal(totals(setQuantity(cart,'blueberries',1)).total,1600);
  assert.equal(totals(setQuantity(cart,'blueberries',0)).total,0);
  assert.equal(totals(cart).total,2400);
});
test('mixed products and bags are calculated in integer cents without mutating original cart',()=>{
  const original=exampleCart();
  const mixed=setBags(addItem(addItem(original,'milk'),'bread'),2);
  assert.deepEqual(totals(mixed),{quantity:4,subtotal:6340,discount:800,bagCharge:200,total:5740});
  assert.deepEqual(original,exampleCart());
});
test('invalid quantities, bags and unknown products are rejected',()=>{
  for(const n of [-1,1.5,100,NaN])assert.throws(()=>setQuantity(createCart(),'milk',n));
  for(const n of [-1,1.5,10])assert.throws(()=>setBags(createCart(),n));
  assert.throws(()=>addItem(createCart(),'unknown'));
});
