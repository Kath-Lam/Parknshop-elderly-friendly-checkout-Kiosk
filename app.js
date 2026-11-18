import {LiveQRScanner} from './qr-scanner.js';
import {PRODUCTS, productById, money, createCart, addItem, setQuantity, setBags, totals} from './checkout-model.js';

const $ = selector => document.querySelector(selector);
const state = {route: 'home', lang: 'zh', cart: createCart(), selected: null, member: false, payment: '', large: false, removed: null, quantityHighlight: null};
const t = (zh, en) => state.lang === 'zh' ? zh : en;
const discountMoney = cents => cents ? '−'+money(cents) : money(0);
const hkd = cents => 'HK'+money(cents);
const bagQuantityLabel = quantity => t(`已選 ${quantity} 個`,`${quantity} selected`);
const name = p => state.lang === 'zh' ? p.name : p.en;
const methodName = m => ({Octopus:t('八達通','Octopus'),'MoneyBack points':t('易賞錢積分','MoneyBack points'),Voucher:t('禮券','Voucher'),eVoucher:t('電子禮券','eVoucher'),'WeChat Pay':t('微信支付','WeChat Pay')})[m] || m;
let returnFocus = null, restoreSelector = null, helpReturnFocus = null;
let memberScanner=null, qrDetected=false, quantityHighlightTimer=null;
let receiptResizeObserver=null;
const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  home: '<path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
  remove: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  bag: '<path d="M5 8h14l2 13H3L5 8Z M8 9V6a4 4 0 0 1 8 0v3"/>',
  scan: '<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M7 7v10m3-10v10m3-10v10m4-10v10M1 12h22"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  berries: '<circle cx="8" cy="14" r="5" fill="#596baf"/><circle cx="16" cy="15" r="5" fill="#40508c"/><circle cx="12" cy="8" r="5" fill="#7185bf"/><path d="m12 3 2-2m-4 6 2 2 2-2" stroke="#243968"/>',
  milk: '<path d="m7 2 10 0-2 5 4 4v11H5V7l2-5Z" fill="#f5f7f2"/><path d="M5 11h14v8H5" fill="#77b3cf"/><path d="M7 2 9 7h6M9 7v4"/>',
  bread: '<path d="M5 9C0 6 5 2 12 2s12 4 7 7v12H5V9Z" fill="#d8aa67"/><path d="M8 10v7m4-8v8m4-7v7" stroke="#ae8048"/>',
  orange: '<circle cx="12" cy="14" r="9" fill="#ed9c35"/><path d="M12 5V2m0 2c3-5 9-3 8-2-1 3-5 4-8 2" fill="#71a84d"/>',
};
function icon(key) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] || paths.scan}</svg>`; }
const button = (label, action, cls='kiosk-button', extra='') => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const dots = '<span class="moneyback-dots" aria-hidden="true"><i></i></span>';
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 5000); }
function clearQuantityFeedback(){
  clearTimeout(quantityHighlightTimer);quantityHighlightTimer=null;
  state.quantityHighlight=null;
}
function showQuantityHighlight(id){
  clearTimeout(quantityHighlightTimer);
  state.quantityHighlight=id;
  quantityHighlightTimer=setTimeout(()=>{
    state.quantityHighlight=null;
    document.querySelectorAll('.quantity-updated').forEach(row=>row.classList.remove('quantity-updated'));
    quantityHighlightTimer=null;
  },3500);
}
function render() {
  document.documentElement.lang = state.lang === 'zh' ? 'zh-HK' : 'en';
  document.documentElement.dataset.large=String(state.large);
  $('#text-size').textContent=state.large?t('還原字體','Standard text'):t('放大文字','Larger text');
  $('#text-size').setAttribute('aria-pressed',String(state.large));
  $('#speak').textContent=t('朗讀提示','Read aloud');
  $('#staff-help').innerHTML=`${icon('help')}<span>${t('職員協助','Staff help')}</span>`;
  $('#language').textContent = state.lang === 'zh' ? 'ENG' : '中文';
  $('#language').setAttribute('aria-label', t('Switch to English', '切換至中文'));
  $('#screen').classList.toggle('shopping-screen',['scan','payment'].includes(state.route));
  $('#screen').classList.toggle('payment-screen',state.route==='payment');
  document.body.classList.toggle('payment-page',state.route==='payment');
  document.body.classList.toggle('shopping-page',state.route==='scan');
  $('#screen').innerHTML = state.route === 'home' ? home() : state.route === 'complete' ? complete() : checkout();
  bindReceiptScrollHint();
  $('#demo-title').textContent = t('掃描商品', 'Scan products');
  $('#demo-subtitle').textContent = t('選擇商品加入購物清單', 'Select a product to add to your basket');
  $('#demo-products').innerHTML = PRODUCTS.map(p => button(`${icon(p.icon)}<span>${name(p)}<small>${money(p.price)}</small></span>`, 'add', 'demo-product', `data-id="${p.id}" ${['payment','complete'].includes(state.route) ? 'disabled' : ''}`)).join('');
  $('#reset').textContent = t('重新開始','Reset');
  $('#fullscreen').textContent = t('全螢幕','Full screen');
}
function home() {
  return `<div class="home-screen home-clean"><div class="home-prompt">${t('請按「開始」購物','Press Start to begin shopping')}</div><div class="home-actions">${button(`${icon('search')}<span class="home-price-label"><span>${t('查詢','Price')}</span><span>${t('價格',' enquiry')}</span></span>`,'prices')}${button(`${dots}<span>${t('易賞錢','MoneyBack')}</span>`,'member','kiosk-button aqua')}${button(`${t('開始','Start')}${icon('arrow')}`,'start','kiosk-button start-button')}</div></div>`;
}
function receipt() {
  const total=totals(state.cart);
  return `<div class="receipt"><div class="receipt-scroll" tabindex="0" role="region" aria-label="${t('商品清單','Items in basket')}"><div class="receipt-heading"><strong>${t('商品清單','Your items')}</strong><span>${t('數量 / 金額','QTY / AMOUNT')}</span></div>${state.member?`<div class="receipt-meta member">MoneyBack · ${t('已加入會員資料','Member details added')}</div>`:''}${state.cart.items.length?state.cart.items.map(item=>{
    const p=productById(item.id);
    return button(`<span class="receipt-row"><strong>${name(p)}</strong><strong>${money(p.price*item.quantity)}</strong></span><span class="item-unit">${t('單價','Unit price')} ${money(p.price)} × <b>${item.quantity} ${t('件','items')}</b></span>`, 'select',`receipt-item ${state.selected===p.id?'selected':''}`,`data-id="${p.id}" aria-pressed="${state.selected===p.id}" ${state.route==='payment'?'disabled':''}`);
  }).join(''):`<div class="receipt-empty">${icon('scan')}<strong>${t('請加入商品','Please add a product')}</strong><small>${t('點選商品加入清單','Select a product to add it')}</small></div>`}${total.discount?`<div class="receipt-promo"><div class="receipt-row"><strong>${t('藍莓每兩件減 $8','Save $8 per 2 blueberries')}</strong><strong>${discountMoney(total.discount)}</strong></div></div>`:''}${state.cart.bags?`<div class="receipt-bags receipt-row"><span>${t('購物袋','Bags')} ${state.cart.bags} × $1.00</span><span>${money(total.bagCharge)}</span></div>`:''}</div><div class="receipt-breakdown"><div><span>${t('商品小計','Items subtotal')}</span><strong>${money(total.subtotal)}</strong></div><div class="saving"><span>${t('優惠減免','Promotion savings')}</span><strong>${discountMoney(total.discount)}</strong></div></div><div class="receipt-totals" aria-live="polite"><div class="total-stat"><strong>${total.quantity}</strong><span>${t('貨品件數','ITEMS')}</span></div><div class="total-stat"><strong class="bag-selected-count">${bagQuantityLabel(state.cart.bags)}</strong><span>${t('購物袋','Bags')}</span></div><div class="total-stat due"><strong data-testid="total">${hkd(total.total)}</strong><span>${t('應付總額','Total due')}</span></div></div></div>`;
}
function scanPanel() {
  const p=productById(state.selected),quantity=state.cart.items.find(x=>x.id===state.selected)?.quantity;
  const locked=state.route==='payment';
  return `<div class="scan-panel"><div class="scan-label"><span>${t('目前選取商品','Selected item')}</span><span>${state.removed&&!locked?button(t('復原剛才移除','Undo removal'),'undo','undo-button'):p?p.barcode:'—'}</span></div><div class="scan-content"><div class="current-item">${p?`<span class="item-name">${name(p)}</span><span class="current-qty">${quantity} ${t('件','')}</span>${button(t('修改數量','Quantity'),'quantity','quantity-button',locked?'disabled':'')}`:`<span class="scan-empty">${t('點選清單中的商品，即可修改或取消','Select an item above to change or remove it')}</span>`}</div><div class="transaction-actions">${button(`${icon('home')}${t('主頁','Home')}`,'home')}${button(`${icon('help')}${t('職員協助','Staff help')}`,'help','kiosk-button help-action')}${button(`${icon('remove')}${t('取消貨品','Remove')}`,'remove','kiosk-button',!p||locked?'disabled':'')}</div></div></div>`;
}
function scanSide() {
  return `<aside class="side-panel">${button(`${dots}<span>${state.member?t('已登入會員','Member signed in'):t('非會員都可儲分','Earn points as a guest')}<small>${'MoneyBack '+t('易賞錢','Rewards')}</small></span>`,'member','kiosk-button side-member')}<div class="side-instruction">${icon('scan')}<strong>${t('請掃描商品條碼','Scan the barcode')}</strong><span>${t('核對總額後，請按「付款」','Check your items and total, then press Pay')}</span></div><div class="bag-controls">${button('−','bag-minus','circle-button',`aria-label="${t('減少購物袋','Remove one bag')}" ${state.cart.bags===0?'disabled':''}`)}<div class="bag-display">${icon('bag')}<span class="bag-price">$1</span><span class="bag-count" aria-hidden="true">${state.cart.bags}</span></div>${button('+','bag-plus','circle-button',`aria-label="${t('增加購物袋','Add one bag')}" ${state.cart.bags===9?'disabled':''}`)}</div><div class="bag-caption">${t('購物袋每個 $1；不需要可略過','Bags $1 each · optional')}</div>${button(state.member?t('會員資料','Member details'):t('登入會員（可略過）','Member login (optional)'),'member','kiosk-button member-login')}${button(`<span class="produce-symbol">${icon('orange')}</span>${t('蔬果 / 無條碼','Produce / no barcode')}`,'produce','kiosk-button produce-button')}${button(`${t('付款','Pay')}${icon('arrow')}`,'pay','kiosk-button pay-button',totals(state.cart).quantity?'':'disabled')}</aside>`;
}
function paymentLogo(file){return `<img class="payment-logo" src="assets/payments/${file}" alt="" aria-hidden="true" draggable="false">`;}
function brandedPayment(method,file,showName=false,cls='logo-payment'){
  return button(`${paymentLogo(file)}<span class="payment-name ${showName?'':'sr-only'}">${methodName(method)}</span>`,'method',cls,`data-method="${method}" aria-label="${methodName(method)}"`);
}
function paymentSide(showBack=true) {
  return `<aside class="side-panel payment-side" aria-label="${t('付款方式','Payment methods')}"><h2 class="payment-title">${t('請選擇付款方式','Choose payment method')}</h2>${brandedPayment('Octopus','octopus-mark.svg',false,'payment-choice octopus-choice')}<div class="payment-group"><div class="group-caption">${t('電子錢包','Digital wallets')}</div><div class="payment-grid">${brandedPayment('AlipayHK','alipayhk.svg')}${brandedPayment('PayMe','payme.png')}${brandedPayment('WeChat Pay','wechat-pay.svg',true)}</div></div><div class="payment-group"><div class="group-caption">${t('信用卡 / Apple Pay','Cards / Apple Pay')}</div><div class="card-grid">${brandedPayment('VISA','visa.svg')}${brandedPayment('Mastercard','mastercard.svg',true)}${brandedPayment('UnionPay','unionpay.svg')}${brandedPayment('Apple Pay','apple-pay.svg')}</div></div>${button(`${t('其他付款方式','Other payment methods')}<span aria-hidden="true">›</span>`,'other-payments','payment-choice other-payment-button','aria-haspopup="dialog"')}${showBack?button(`‹ ${t('返回修改商品','Back to edit items')}`,'back','kiosk-button back-payment'):''}</aside>`;
}
function otherPaymentMethods(){
  modal(t('其他付款方式','Other payment methods'),`<div class="modal-list">${[[t('電子禮券','eVoucher'),'eVoucher'],[t('禮券','Voucher'),'Voucher'],[t('積分當錢使','MoneyBack points'),'MoneyBack points']].map(([label,method])=>button(label,'method','modal-product',`data-method="${method}"`)).join('')}</div>`,button(t('返回主要付款方式','Back to main payment methods'),'close','modal-action secondary'));
}
function receiptProductLabel(p){
  return `<span class="shopping-product-name">${t(p.shortName||p.name,p.shortEn||p.en)}</span>${p.spec?`<span class="shopping-product-spec">${t(p.spec,p.specEn)}</span>`:''}`;
}
function bindReceiptScrollHint(){
  receiptResizeObserver?.disconnect();receiptResizeObserver=null;
  const area=$('.shopping-table-area'),scroll=$('.shopping-table-scroll'),hint=$('#more-products-hint');
  if(!area||!scroll||!hint)return;
  const table=scroll.querySelector('table');
  const update=()=>{
    // Compare against the entire area so adding the hint cannot create its own overflow.
    const overflow=table.getBoundingClientRect().height>area.clientHeight+1;
    area.classList.toggle('has-overflow',overflow);
    const more=overflow&&scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop>2;
    hint.hidden=!more;
    if(more)scroll.setAttribute('aria-describedby','more-products-hint');else scroll.removeAttribute('aria-describedby');
    scroll.style.scrollPaddingTop=`${table.tHead.getBoundingClientRect().height+8}px`;
  };
  scroll.addEventListener('scroll',update,{passive:true});
  receiptResizeObserver=new ResizeObserver(update);
  receiptResizeObserver.observe(area);receiptResizeObserver.observe(table);
  update();
}
function shoppingReceipt(){
  const sum=totals(state.cart),locked=state.route==='payment';
  const colgroup='<col class="name-col"><col class="unit-col"><col class="qty-col"><col class="amount-col">';
  const headers=`<th scope="col">${t('商品名稱','Item')}</th><th scope="col">${t('單價','Unit price')}</th><th scope="col">${t('數量','Qty')}</th><th scope="col">${t('金額','Amount')}</th>`;
  return `<div class="shopping-receipt"><div class="shopping-table-area"><div class="shopping-table-scroll" tabindex="0" role="region" aria-label="${locked?t('付款前商品清單，只供核對','Items before payment, review only'):t('商品清單，可上下捲動','Your items, scrollable')}"><table class="shopping-table ${locked?'readonly-table':''}"><colgroup>${colgroup}</colgroup><thead><tr>${headers}</tr></thead><tbody>${state.cart.items.length?state.cart.items.map(item=>{
    const p=productById(item.id);
    const quantityCell=locked?`<span class="quantity-value">${item.quantity}</span>`:`<div class="row-quantity-controls" role="group" aria-label="${t(`修改${p.name}數量，目前 ${item.quantity} 件`,`Change quantity for ${p.en}, currently ${item.quantity}`)}">${button('−','item-minus','row-quantity-button',`data-id="${p.id}" aria-label="${t(`減少一件${p.name}`,`Remove one ${p.en}`)}"`)}<span class="quantity-value">${item.quantity}</span>${button('+','item-plus','row-quantity-button',`data-id="${p.id}" aria-label="${t(`增加一件${p.name}`,`Add one ${p.en}`)}" ${item.quantity===99?'disabled':''}`)}</div>`;
    return `<tr data-product-id="${p.id}" class="${!locked&&state.quantityHighlight===p.id?'quantity-updated':''}"><th scope="row">${receiptProductLabel(p)}</th><td class="shopping-money">${money(p.price)}</td><td class="shopping-quantity">${quantityCell}</td><td class="shopping-line-amount"><span class="line-amount-value">${money(p.price*item.quantity)}</span></td></tr>`;
  }).join(''):`<tr class="shopping-empty"><td colspan="4">${icon('scan')}<strong>${t('請加入商品','Please add a product')}</strong><span>${t('點選商品加入清單','Select a product to add it')}</span></td></tr>`}</tbody></table></div><div id="more-products-hint" class="shopping-scroll-hint" hidden>${t('下方還有商品 ↓','More items below ↓')}</div></div><div class="shopping-breakdown"><div><span>${t('商品小計','Items subtotal')}</span><strong>${money(sum.subtotal)}</strong></div><div class="saving"><span>${t('優惠減免','Promotion savings')}</span><strong>${discountMoney(sum.discount)}</strong></div></div><div class="shopping-bag-charge"><span>${t(`購物袋　${state.cart.bags} 個 × $1.00`,`Shopping bags　${state.cart.bags} × $1.00`)}</span><strong>${money(sum.bagCharge)}</strong></div><div class="receipt-totals shopping-totals" aria-live="polite"><div class="total-stat basket-item-count"><strong>${sum.quantity}</strong><span>${t('件商品','items')}</span></div><div class="total-stat due"><span>${t('應付總額','Total due')}</span><strong data-testid="total">${hkd(sum.total)}</strong></div></div></div>`;
}
function shoppingCheckout(){
  const sum=totals(state.cart),paying=state.route==='payment';
  const memberLabel=state.member?(state.memberMask||t('已登入','Signed in')):(paying?t('未登入','Not signed in'):t('未登入，按此登入','Not signed in · Sign in'));
  const heading=`<div class="shopping-heading"><h2>${paying?t('付款前核對','Review before payment'):t('商品清單','Your items')}</h2>${paying?`<p>${t('商品資料已鎖定；如需更改，請按「返回修改商品」。','Items are locked. Select Back to edit items if you need to make changes.')}</p>`:''}</div>`;
  const member=paying?`<div class="shopping-member payment-member-status">${icon('user')}<span>${t('會員：','Member: ')}<strong>${memberLabel}</strong></span></div>`:button(`${icon('user')}<span>${t('會員：','Member: ')}<strong>${memberLabel}</strong></span>`,'member','shopping-member');
  return `<div class="shopping-layout ${paying?'payment-layout':''}"><div class="shopping-top">${heading}${member}</div><div class="shopping-main"><div class="shopping-left">${shoppingReceipt()}<div class="shopping-feedback" role="status">${state.removed&&!paying?`<span>${t('已移除','Removed ')}${name(productById(state.removed.id))}</span>${button(t('復原移除','Undo removal'),'undo','undo-button')}`:''}</div><div class="shopping-bottom">${button(`‹ ${paying?t('返回修改商品','Back to edit items'):t('返回首頁','Back to home')}`,paying?'back':'shopping-back','kiosk-button shopping-back')}${paying?'':button(`<span class="produce-symbol">${icon('orange')}</span>${t('蔬果 / 無條碼','Produce / no barcode')}`,'produce','kiosk-button shopping-produce')}</div></div>${paying?paymentSide(false):`<aside class="shopping-side" aria-label="${t('購物袋及付款','Bags and payment')}"><div class="shopping-bags"><div class="bag-controls">${button('−','bag-minus','circle-button',`aria-label="${t('減少購物袋','Remove one bag')}" ${state.cart.bags===0?'disabled':''}`)}<div class="bag-display">${icon('bag')}<span class="bag-price">$1</span><span class="bag-count" aria-hidden="true">${state.cart.bags}</span></div>${button('+','bag-plus','circle-button',`aria-label="${t('增加購物袋','Add one bag')}" ${state.cart.bags===9?'disabled':''}`)}</div><p class="bag-selected-label" role="status">${bagQuantityLabel(state.cart.bags)}</p><p class="bag-unit-price">${t('購物袋每個 $1','Bags $1 each')}</p></div>${button(`${t('付款','Pay')}${icon('arrow')}`,'pay','kiosk-button shopping-pay',sum.quantity?'':'disabled')}</aside>`}</div></div>`;
}
function checkout() {
  return shoppingCheckout();
}
function complete() {
  const total = totals(state.cart);
  return `<div class="result-screen"><section class="result-card"><div class="result-icon">${icon('check')}</div><h2>${t('付款完成','Payment completed')}</h2><p>${t('多謝惠顧！請取回您的貨品。','Thank you! Please collect your items.')}</p><div class="result-total">${hkd(total.total)}</div><div class="result-details"><div><span>${t('付款方式','Payment method')}</span><strong>${methodName(state.payment)}</strong></div><div><span>${t('貨品件數 / 購物袋','Items / bags')}</span><strong>${total.quantity} / ${state.cart.bags}</strong></div><div><span>${t('優惠節省','Promotion savings')}</span><strong>${money(total.discount)}</strong></div></div><div class="result-buttons">${button(t('下載電子收據','Download e-receipt'),'download','modal-action secondary')}${button(t('下一位顧客','Next customer'),'new','modal-action')}</div></section></div>`;
}
function stopMemberCamera(){memberScanner?.stop();memberScanner=null;}
function closeModal() { stopMemberCamera();if($('#member-phone'))$('#member-phone').value='';$('#modal').close(); }
function modal(title, content, actions='') {
  stopMemberCamera();
  const dialog = $('#modal');
  dialog.classList.remove('membership-modal');
  if(!dialog.open){returnFocus=document.activeElement;restoreSelector=returnFocus?.dataset?.action?`[data-action="${returnFocus.dataset.action}"]${returnFocus.dataset.id?`[data-id="${returnFocus.dataset.id}"]`:''}`:null;}
  $('#modal-content').innerHTML = `<div class="modal-header"><h2 id="modal-title">${title}</h2><div class="modal-header-tools">${button(`${icon('help')}<span>${t('職員協助','Staff help')}</span>`,'help','staff-help-button modal-help')}${button(icon('close'),'close','modal-close',`aria-label="${t('關閉','Close')}"`)}</div></div><div class="modal-body">${content}${actions ? `<div class="modal-actions">${actions}</div>` : ''}</div>`;
  dialog.setAttribute('aria-labelledby','modal-title');
  if (!dialog.open) dialog.showModal();
}
function openStaffHelp(){
  const dialog=$('#staff-help-dialog');if(dialog.open)return;
  helpReturnFocus=document.activeElement;
  $('#staff-help-title').textContent=t('職員協助','Staff assistance');
  $('#staff-help-description').textContent=t('請向現場職員尋求協助。','Please ask a nearby staff member for help.');
  $('#staff-help-close').innerHTML=icon('close');$('#staff-help-close').setAttribute('aria-label',t('關閉','Close'));
  $('#staff-help-return').textContent=t('返回操作','Return to what I was doing');
  dialog.showModal();$('#staff-help-return').focus();
}
$('#staff-help-dialog').addEventListener('close',()=>{if(helpReturnFocus?.isConnected)helpReturnFocus.focus({preventScroll:true});});
$('#staff-help-dialog').addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const controls=[...$('#staff-help-dialog').querySelectorAll('button')];
  if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus();}
  else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus();}
});
const cancel = () => button(t('取消','Cancel'),'close','modal-action secondary');
function reset() { clearQuantityFeedback();state.cart = createCart(); state.selected = null; state.member = false; state.memberMask=null; state.payment = ''; state.removed = null; state.route = 'home'; closeModal(); render(); }
function confirmReset() {
  if (!state.cart.items.length && !state.member && !state.cart.bags) return reset();
  modal(t('重新開始？','Start again?'), `<p>${t('這會清除本次的商品、購物袋及會員資料。','This will clear the current items, bags and member details.')}</p>`, cancel()+button(t('重新開始','Start again'),'new','modal-action danger'));
}
function member() {
  qrDetected=false;
  if(state.member){
    modal(t('易賞錢會員','MoneyBack membership'),`<div class="membership-preview">${dots}<div><strong>${t('已加入會員資料','Member details added')}</strong><small>${state.memberMask||t('二維碼方式','QR code login')}</small></div></div>`,button(t('繼續購物','Continue shopping'),'close','modal-action secondary')+button(t('移除會員資料','Remove member details'),'member-toggle','modal-action'));
    return;
  }
  modal(t('易賞錢會員','MoneyBack membership'),`<div class="member-login-grid"><section class="member-qr-panel" aria-labelledby="qr-heading"><h3 id="qr-heading">${t('掃描會員二維碼','Scan member QR code')}</h3><div class="camera-preview" id="camera-preview"><video id="member-video" autoplay muted playsinline aria-label="${t('二維碼掃描即時鏡頭畫面','Live camera preview for QR scanning')}"></video><div class="camera-placeholder" id="camera-placeholder">${icon('scan')}<span>${t('正在開啟鏡頭…','Opening camera…')}</span></div><div class="qr-alignment" aria-hidden="true"><i></i><i></i><i></i><i></i></div><span class="camera-live" id="camera-live" hidden>${t('即時畫面','LIVE')}</span></div><div class="qr-status" id="qr-status" role="status" aria-live="polite">${t('正在開啟鏡頭…','Opening camera…')}</div><div class="qr-camera-actions">${button(t('重新開啟鏡頭','Retry camera'),'camera-retry','member-secondary', 'id="camera-retry" hidden')}${button(t('重新掃描','Scan again'),'qr-rescan','member-secondary','id="qr-rescan" hidden')}</div>${button(t('使用此二維碼','Use this QR code'),'member-qr-login','modal-action member-submit','id="qr-login" disabled')}</section><div class="member-or" aria-hidden="true">${t('或','OR')}</div><section class="member-phone-panel" aria-labelledby="phone-heading"><h3 id="phone-heading"><label for="member-phone">${t('輸入 8 位電話號碼','Enter an 8-digit phone number')}</label></h3><div class="phone-input-row"><span class="phone-prefix">+852</span><input id="member-phone" type="tel" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" autocomplete="off" placeholder="${t('請輸入電話號碼','Phone number')}" aria-describedby="phone-error"></div><div class="phone-error" id="phone-error" role="status" aria-live="polite"></div><div class="phone-keypad" aria-label="${t('電話數字鍵盤','Phone number keypad')}">${['1','2','3','4','5','6','7','8','9','clear','0','delete'].map(n=>button(n==='clear'?t('清除','Clear'):n==='delete'?t('刪除','Delete'):n,'phone-key','phone-key',`data-key="${n}" aria-label="${n==='clear'?t('清除全部數字','Clear all digits'):n==='delete'?t('刪除最後一位','Delete last digit'):n}"`)).join('')}</div>${button(t('使用此電話號碼','Use this phone number'),'member-phone-login','modal-action member-submit','id="phone-login"')}</section></div>`,button(t('略過，繼續購物','Skip and continue shopping'),'close','modal-action secondary'));
  $('#modal').classList.add('membership-modal');
  $('#member-phone').addEventListener('input',()=>{
    const input=$('#member-phone');input.value=input.value.replace(/[^0-9]/g,'').slice(0,8);updatePhoneFeedback();
  });
  startMemberCamera();
}
function updatePhoneFeedback(submitted=false){
  const input=$('#member-phone');if(!input)return false;
  const missing=8-input.value.length;
  const incomplete=missing>0&&(input.value.length>0||submitted);
  $('#phone-error').textContent=incomplete?t(`還差 ${missing} 位數字。`,`${missing} more ${missing===1?'digit':'digits'} needed.`):'';
  if(submitted&&missing>0)input.setAttribute('aria-invalid','true');
  else input.removeAttribute('aria-invalid');
  return missing===0;
}
function startMemberCamera(){
  if(!$('#member-video'))return;
  if(!memberScanner)memberScanner=new LiveQRScanner({video:$('#member-video'),onState:cameraState,onCode:()=>{qrDetected=true;const btn=$('#qr-login');if(btn)btn.disabled=false;}});
  memberScanner.start();
}
function cameraState(kind){
  if(!$('#member-video'))return;
  const live=['scanning','detected'].includes(kind);
  $('#camera-live').hidden=!live;
  $('#camera-placeholder').hidden=live;
  $('#camera-preview').classList.toggle('qr-found',kind==='detected');
  $('#qr-rescan').hidden=kind!=='detected';
  $('#camera-retry').hidden=['requesting','scanning','detected'].includes(kind);
  const messages={requesting:t('請允許使用鏡頭。','Allow camera access.'),scanning:t('請把二維碼對準框內。','Place the QR code inside the frame.'),detected:t('已讀取二維碼。','QR code read.'),denied:t('鏡頭權限未開啟，請允許使用鏡頭，或改用電話號碼。','Allow camera access or use your phone number.'),'no-camera':t('找不到鏡頭，請改用電話號碼。','No camera found. Use your phone number.'),busy:t('鏡頭正被使用，請關閉其他鏡頭程式後重試。','Camera in use. Close other camera apps and retry.'),unsupported:t('無法開啟鏡頭，請改用電話號碼。','Camera unavailable. Use your phone number.'),ended:t('鏡頭已停止，請重新開啟。','Camera stopped. Select Retry camera.'),'decoder-error':t('未能掃描，請重試或改用電話號碼。','Scanning unavailable. Retry or use your phone number.'),error:t('未能開啟鏡頭，請重試或改用電話號碼。','Could not open camera. Retry or use your phone number.')};
  $('#qr-status').textContent=messages[kind]||messages.error;
  if(!live){$('#camera-placeholder span').textContent=kind==='requesting'?t('正在等候鏡頭…','Waiting for camera…'):t('鏡頭暫不可用','Camera unavailable');qrDetected=false;$('#qr-login').disabled=true;}
}
function loginMember(source){
  if(source==='qr'&&!qrDetected)return;
  if(source==='phone'){
    const input=$('#member-phone');
    if(!updatePhoneFeedback(true)){input.focus();return;}
    state.memberMask='****'+input.value.slice(-4);
    input.value='';
  }else state.memberMask=t('二維碼','QR code');
  state.member=true;
  closeModal();render();toast(t('已加入會員資料','Member details added'));
}
function productList(produceOnly=false,focusId=null) {
  const action=produceOnly?'add':'price-detail';
  modal(produceOnly ? t('蔬果 / 無條碼商品','Produce / no barcode') : t('查詢價格','Price enquiry'), `<p>${produceOnly?t('點選商品加入購物清單。','Select a product to add it to your basket.'):t('點選商品查看價格。','Select a product to view its price.')}</p><div class="modal-list">${PRODUCTS.filter(p => !produceOnly || p.category === 'produce').map(p => button(`${icon(p.icon)}<span class="product-description">${name(p)}${state.lang==='zh'?`<small>${p.en}</small>`:''}</span><strong>${money(p.price)}</strong>`,action,'modal-product',`data-id="${p.id}"`)).join('')}</div>`,produceOnly?'':button(state.route==='home'?t('返回首頁','Back to home'):t('返回購物','Back to shopping'),'close','modal-action secondary'));
  if(focusId)$('#modal').querySelector(`[data-action="price-detail"][data-id="${focusId}"]`)?.focus();
}
function priceDetail(id){
  const p=productById(id);if(!p)return;
  modal(t('商品價格','Product price'),`<div class="price-detail"><img class="price-product-photo" src="${p.image}" alt="${p.name}" width="600" height="450"><div class="price-product-info"><h3>${name(p)}</h3>${state.lang==='zh'?`<p class="price-english-name">${p.en}</p>`:''}<div class="price-detail-amount"><span>${t('單價','Unit price')}</span><strong>${money(p.price)}</strong></div></div></div>`,button(t('返回商品列表','Back to products'),'price-list','modal-action secondary',`data-id="${p.id}"`)+button(t('加入購物清單','Add to shopping list'),'add','modal-action',`data-id="${p.id}" ${['payment','complete'].includes(state.route)?'disabled':''}`));
  $('#modal-title').setAttribute('tabindex','-1');$('#modal-title').focus();
}
function quantity() {
  const p = productById(state.selected); if (!p) return;
  const qty = state.cart.items.find(x => x.id === p.id).quantity;
  modal(t('修改數量','Change quantity'), `<label for="quantity-input">${name(p)}</label><div class="quantity-editor">${button('−','qty-minus','',`aria-label="${t('減少數量','Decrease quantity')}"`)}<input id="quantity-input" class="modal-input" type="number" min="1" max="99" step="1" value="${qty}" inputmode="numeric" aria-describedby="quantity-error">${button('+','qty-plus','',`aria-label="${t('增加數量','Increase quantity')}"`)}</div><div class="modal-error" id="quantity-error" role="alert"></div>`,cancel()+button(t('確認','Confirm'),'qty-save','modal-action'));
  $('#quantity-input').focus(); $('#quantity-input').select();
}
function add(id) {
  if (['payment','complete'].includes(state.route)) return;
  try { state.cart = addItem(state.cart,id); } catch { return toast(t('每款商品最多可加入99件','Maximum 99 of each product')); }
  clearQuantityFeedback();state.selected = id; state.removed=null; state.route = 'scan'; closeModal(); render(); toast(`${t('已加入','Added')} ${name(productById(id))}`);
}
function download() {
  const sum = totals(state.cart);
  const text = ['PARKnSHOP / FUSION','付款紀錄 / Payment record','',...state.cart.items.map(x => `${productById(x.id).name} / ${productById(x.id).en}  x${x.quantity}  ${money(productById(x.id).price*x.quantity)}`),`Items subtotal / 商品小計: ${money(sum.subtotal)}`,`Discount / 優惠減免: ${discountMoney(sum.discount)}`,`Bags / 購物袋: ${state.cart.bags} × $1.00 = ${money(sum.bagCharge)}`,`TOTAL HKD / 總額: ${hkd(sum.total)}`,`Payment / 付款: ${state.payment}`, '', 'Thank you / 多謝惠顧'].join('\n');
  const url = URL.createObjectURL(new Blob([text], {type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = 'electronic-receipt.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function act(action, target) {
  switch (action) {
    case 'shopping-back':state.route='home';render();break;
    case 'item-minus':case 'item-plus':{
      if(state.route!=='scan')break;
      const id=target.dataset.id,item=state.cart.items.find(x=>x.id===id);if(!item)break;
      const n=item.quantity+(action==='item-plus'?1:-1);
      if(n===0){state.selected=id;act('remove');break;}
      if(n<1||n>99)break;
      state.cart=setQuantity(state.cart,id,n);showQuantityHighlight(id);
      const scroll=$('.shopping-table-scroll');const position={top:scroll.scrollTop,left:scroll.scrollLeft};
      render();$('.shopping-table-scroll').scrollTop=position.top;$('.shopping-table-scroll').scrollLeft=position.left;
      break;
    }
    case 'start': state.route = 'scan'; render(); break;
    case 'add': add(target.dataset.id); break;
    case 'select': if(state.route === 'scan') {state.selected = target.dataset.id; render();} break;
    case 'quantity': quantity(); break;
    case 'qty-minus': case 'qty-plus': { const input = $('#quantity-input'); input.value = Math.min(99,Math.max(1,(Number(input.value)||1)+(action === 'qty-plus' ? 1 : -1))); break; }
    case 'qty-save': { const n = Number($('#quantity-input').value); if(!Number.isInteger(n)||n<1||n>99) {$('#quantity-input').setAttribute('aria-invalid','true');$('#quantity-error').textContent=t('請輸入1至99之間的整數','Enter a whole number from 1 to 99');$('#quantity-input').focus();break;} state.cart = setQuantity(state.cart,state.selected,n);closeModal();render();break; }
    case 'remove': { const p=productById(state.selected); if(p){
      modal(t('移除這件商品？','Remove this item?'),`<p>${name(p)}</p>`,button(t('保留商品','Keep item'),'close','modal-action secondary')+button(t('移除商品','Remove item'),'remove-confirm','modal-action danger'));
      $('#modal .modal-action.secondary').focus();
    }break; }
    case 'remove-confirm': clearQuantityFeedback();state.removed={...state.cart.items.find(x=>x.id===state.selected)};state.cart=setQuantity(state.cart,state.selected,0);state.selected=state.cart.items.at(-1)?.id||null;closeModal();render();break;
    case 'undo': if(state.removed){state.cart=setQuantity(state.cart,state.removed.id,state.removed.quantity);state.selected=state.removed.id;state.removed=null;render();toast(t('商品已恢復','Item restored'));}break;
    case 'bag-minus': case 'bag-plus': if(state.route==='scan'){state.cart=setBags(state.cart,Math.min(9,Math.max(0,state.cart.bags+(action==='bag-plus'?1:-1))));render();}break;
    case 'member': member();break;
    case 'camera-retry':startMemberCamera();break;
    case 'qr-rescan':qrDetected=false;$('#qr-login').disabled=true;memberScanner?.rescan();break;
    case 'phone-key':{
      const input=$('#member-phone'),key=target.dataset.key;
      if(key==='clear')input.value='';else if(key==='delete')input.value=input.value.slice(0,-1);else if(input.value.length<8)input.value+=key;
      updatePhoneFeedback();break;
    }
    case 'member-phone-login':loginMember('phone');break;
    case 'member-qr-login':loginMember('qr');break;
    case 'member-toggle': state.member=!state.member;closeModal();render();toast(state.member?t('已加入會員資料','Member details added'):t('已登出','Signed out'));break;
    case 'produce': productList(true);break;
    case 'prices': productList();break;
    case 'price-detail':priceDetail(target.dataset.id);break;
    case 'price-list':productList(false,target.dataset.id);break;
    case 'pay': if(totals(state.cart).quantity){state.route='payment';render();window.scrollTo({top:0,behavior:'instant'});}break;
    case 'other-payments':otherPaymentMethods();break;
    case 'back': state.route='scan';render();break;
    case 'method': state.pendingPayment=target.dataset.method;modal(t('確認付款方式','Confirm payment method'),`<div class="simulation-payment"><div class="payment-mark">${methodName(state.pendingPayment)}</div><span class="amount">${hkd(totals(state.cart).total)}</span><p>${t('請核對付款方式及金額。','Check the payment method and amount.')}</p></div>`,button(t('更換付款方式','Change payment method'),'close','modal-action secondary')+button(t('確認付款','Confirm payment'),'paid','modal-action'));break;
    case 'paid': state.payment=state.pendingPayment;state.route='complete';closeModal();render();break;
    case 'home': case 'reset': confirmReset();break;
    case 'new': reset();break;
    case 'download': download();break;
    case 'help': case 'request-help':openStaffHelp();break;
    case 'staff-help-close':$('#staff-help-dialog').close();break;
    case 'other': modal(t('其他功能','Other functions'),`<div class="modal-list">${button(`${icon('search')}${t('查詢價格','Price enquiry')}`,'prices','modal-product')}${button(`${icon('user')}${t('會員登入','Member login')}`,'member','modal-product')}${button(`${icon('help')}${t('職員協助','Staff assistance')}`,'help','modal-product')}</div>`);break;
    case 'close': closeModal();break;
  }
}
document.addEventListener('click',e=>{
  const target=e.target.closest('[data-action]');if(!target||target.disabled)return;
  const action=target.dataset.action, qualifier=target.dataset.id?`[data-id="${target.dataset.id}"]`:'';
  act(action,target);
  if(!$('#modal').open&&!target.isConnected)$(`[data-action="${action}"]${qualifier}`)?.focus({preventScroll:true});
});
$('#language').addEventListener('click',()=>{if('speechSynthesis' in window)speechSynthesis.cancel();state.lang=state.lang==='zh'?'en':'zh';render();});
$('#text-size').addEventListener('click',()=>{state.large=!state.large;render();});
$('#speak').addEventListener('click',speak);
$('#reset').addEventListener('click',confirmReset);
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast(t('請使用瀏覽器的全螢幕選項','Use the browser full-screen option'));}});
$('#modal').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.id==='member-phone'){e.preventDefault();loginMember('phone');}
  if(e.key==='Enter'&&e.target.id==='quantity-input'){e.preventDefault();act('qty-save');}
  if(e.key==='Tab'){
    const controls=[...$('#modal').querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
    if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1)?.focus();}
    else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0]?.focus();}
  }
});
$('#modal').addEventListener('close',()=>{
  if($('#modal').open)return;
  stopMemberCamera();qrDetected=false;
  if($('#member-phone'))$('#member-phone').value='';
  const fallback=restoreSelector?$(restoreSelector):null;
  if(fallback)fallback.focus({preventScroll:true});else if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else ($('[data-action="undo"]')||$('#language'))?.focus({preventScroll:true});
});
function speak() {
  if(!('speechSynthesis' in window))return modal(t('朗讀暫不可用','Read aloud unavailable'),`<p>${t('請使用畫面提示，或按「職員協助」。','Use the onscreen instructions or press Staff help.')}</p>`,button(t('返回','Back'),'close','modal-action'));
  if(speechSynthesis.speaking){speechSynthesis.cancel();$('#speak').textContent=t('朗讀提示','Read aloud');return;}
  const total=totals(state.cart);
  const text=state.route==='home'?t('歡迎使用自助付款。請按開始。','Welcome to self checkout. Press Start.'):state.route==='complete'?t('付款完成。請取回所有商品。','Payment completed. Please collect your items.'):state.route==='payment'?t(`應付總額港幣${total.total/100}元。請在右邊選擇付款方式。按「返回修改商品」可以繼續修改，商品會保留。`,`Total ${hkd(total.total)} Hong Kong dollars. Choose a payment method on the right. Back to edit items keeps your basket.`):t(`目前有${total.quantity}件商品，購物袋${state.cart.bags}個。優惠減免${total.discount/100}元。應付總額港幣${total.total/100}元。核對後，請按右下角付款。有問題可按右上角職員協助。`,`${total.quantity} items, ${state.cart.bags} bags. Savings ${money(total.discount)}. Total ${hkd(total.total)} Hong Kong dollars. Check your items, then press Pay at the bottom right. Staff help is at the top right.`);
  const u=new SpeechSynthesisUtterance(text);u.lang=t('zh-HK','en-GB');u.rate=.85;const voice=speechSynthesis.getVoices().find(v=>v.lang.toLowerCase()===u.lang.toLowerCase());if(voice)u.voice=voice;
  const finish=()=>{$('#speak').textContent=t('朗讀提示','Read aloud');};u.onend=finish;u.onerror=()=>{finish();toast(t('朗讀未能播放，請使用畫面提示或尋求協助。','Read aloud could not play. Use onscreen instructions or ask for help.'));};
  speechSynthesis.speak(u);$('#speak').textContent=t('停止朗讀','Stop reading');
}
render();

document.addEventListener('visibilitychange',()=>{if(document.hidden&&memberScanner){stopMemberCamera();cameraState('ended');}});
window.addEventListener('pagehide',stopMemberCamera);
