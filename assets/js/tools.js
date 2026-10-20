/** Shop scoped promotional actions matching M/Actions.py's If/Do data model. */
window.HiperTools = (() => {
  "use strict";
  const { state, $, api, showToast, setMessage } = window.HiperApi;
  let editing = null;
  let editingTool = null;
  let paymentTools = [];
  let selectedToolKey = "";
  let selectedActionKey = "";

  const localDate = () => new Date().toISOString().slice(0, 10);
  const actionOf = entry => entry?.action || [];
  const text = value => String(value ?? "");
  const field = selector => $(selector);
  const productKey = item => text(item?.id ?? item?.User_id);

  function productChoiceArray(product) {
    const shop = text(product.at_shop || state.activeShop?.Shop_name);
    const price = Number(product.price) || 0;
    const info = { type: "ITEM", values: { ...product }, extra_data: [], item_list: [] };
    // Keep the positional item data used by Actions.py (id, code, barcode, name, qty, price, shop...).
    return [info, text(product.id), text(product.code), text(product.barcode), text(product.name), "", "", "1", text(product.quantity), "", text(price), text(price), shop, text(product.barcode), "", ""];
  }

  function setSelectedProducts(select, savedItems) {
    const selectedIds = new Set((Array.isArray(savedItems) ? savedItems : []).map(item => text(item?.[1])));
    [...(select?.options || [])].forEach(option => { option.selected = selectedIds.has(option.value); });
  }

  function fillProducts() {
    const products = state.products || [];
    for (const select of [field("#action-if-products"), field("#action-do-products")]) {
      if (!select) continue;
      select.replaceChildren();
      for (const item of products) {
        const option = new Option(`${item.name || "Product"} | ${item.code || item.barcode || item.id} | ${window.HiperApi.formatMoney(item.price, item.at_shop)}`, productKey(item));
        select.add(option);
      }
    }
  }

  function populateShopOptions() {
    const shops = state.shops || [];
    const filter = field("#action-shop-filter"); const editorShop = field("#action-shop");
    if (filter) {
      const selected = filter.value; filter.replaceChildren(new Option("All shops", ""));
      shops.forEach(shop => filter.add(new Option(shop.Shop_name || "Shop", text(shop.Shop_Id))));
      filter.value = selected;
    }
    if (editorShop) {
      const selected = editorShop.value; editorShop.replaceChildren(new Option("Choose a shop", ""), new Option("All shops", "*"));
      shops.forEach(shop => editorShop.add(new Option(shop.Shop_name || "Shop", text(shop.Shop_Id))));
      if (selected && shops.some(shop => text(shop.Shop_Id) === selected)) editorShop.value = selected;
    }
  }

  function conditionSummary(action) {
    const condition = action[5] || [];
    const parts = [];
    if (condition[2]) parts.push(`Price >= ${condition[2]}`);
    if (condition[3]) parts.push(`Discount >= ${condition[3]}`);
    if (condition[4]) parts.push(`Qty >= ${condition[4]}`);
    if (condition[5]) parts.push(`Profit >= ${condition[5]}`);
    if (condition[1]?.length) parts.push(`${condition[1].length} qualifying product(s)`);
    return parts.join(" | ") || "No minimum conditions";
  }

  function renderPromotions() {
    populateShopOptions();
    const body = field("#promotions-body"); if (!body) return;
    body.replaceChildren();
    const query = (field("#action-search")?.value || "").trim().toLowerCase();
    const selectedShop = field("#action-shop-filter")?.value || "";
    const items = (state.shopActions || []).filter(entry => {
      const a = actionOf(entry);
      return (!selectedShop || text(entry.shop_id) === selectedShop) &&
        (!query || [a[0], a[1], entry.shop_name, a[3], a[4]].some(value => text(value).toLowerCase().includes(query)));
    });
    if (!items.some(entry => `${entry.shop_id}:${actionOf(entry)[0]}` === selectedActionKey)) selectedActionKey = "";
    items.forEach(entry => {
      const a = actionOf(entry); const row = document.createElement("tr");
      row.dataset.actionCode = text(a[0]); row.dataset.shopId = text(entry.shop_id);
      if (`${entry.shop_id}:${a[0]}` === selectedActionKey) row.classList.add("manager-selected-row");
      [a[0], a[1], entry.shop_name, a[2], a[3], a[4], conditionSummary(a)].forEach(value => {
        const cell = document.createElement("td"); cell.textContent = text(value) || "-"; row.append(cell);
      });
      body.append(row);
    });
    field("#action-edit-selected").disabled = !selectedActionKey;
    field("#action-delete-selected").disabled = !selectedActionKey;
    if (!items.length) {
      const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 7;
      cell.className = "empty-state"; cell.textContent = "No promotional actions match this shop and search."; row.append(cell); body.append(row);
    }
  }

  function openEditor(entry = null) {
    editing = entry ? { code: text(actionOf(entry)[0]), shopId: text(entry.shop_id), entry } : null;
    if (!entry) { selectedActionKey = ""; renderPromotions(); }
    const a = actionOf(entry); const condition = a[5] || []; const offer = a[6] || [];
    field("#action-form")?.reset(); populateShopOptions(); fillProducts();
    field("#action-editor-title").textContent = entry ? "Edit promotional action" : "New promotional action";
    field("#action-shop").value = entry ? text(entry.shop_id) : "*";
    field("#action-code").value = text(a[0]); field("#action-title").value = text(a[1]);
    field("#action-from").value = text(a[3]) || localDate(); field("#action-to").value = text(a[4]) || localDate();
    field("#action-if-price").value = text(condition[2]); field("#action-if-discount").value = text(condition[3]);
    field("#action-if-qty").value = text(condition[4]); field("#action-if-profit").value = text(condition[5]);
    field("#action-do-price").value = text(offer[2]); field("#action-do-discount").value = text(offer[3]);
    setSelectedProducts(field("#action-if-products"), condition[1]); setSelectedProducts(field("#action-do-products"), offer[1]);
    setMessage(field("#action-message"), ""); field("#action-editor").showModal();
  }

  function selectedItems(selector) {
    const ids = new Set([...(field(selector)?.selectedOptions || [])].map(option => option.value));
    return (state.products || []).filter(item => ids.has(productKey(item))).map(productChoiceArray);
  }

  async function saveAction(event) {
    event.preventDefault();
    const code = field("#action-code").value.trim(); const shopId = field("#action-shop").value;
    if (!shopId) return setMessage(field("#action-message"), "Choose a shop or All shops.", "error");
    const created = actionOf(editing?.entry)[2] || localDate();
    const condition = ["If", selectedItems("#action-if-products"), field("#action-if-price").value, field("#action-if-discount").value, field("#action-if-qty").value, field("#action-if-profit").value];
    const offer = ["Do", selectedItems("#action-do-products"), field("#action-do-price").value, field("#action-do-discount").value];
    const action = [code, field("#action-title").value.trim(), created, field("#action-from").value, field("#action-to").value, condition, offer];
    const button = field("#action-form [type=submit]"); button.disabled = true;
    try {
      await api("shop_actions", { method: "POST", body: { operation: editing ? "update" : "create", shop_id: shopId, code, original_code: editing?.code || code, action } });
      const response = await api("shop_actions"); state.shopActions = response.items || [];
      field("#action-editor").close(); editing = null; selectedActionKey = `${shopId}:${code}`; renderPromotions(); showToast("Promotional action saved.");
    } catch (error) { setMessage(field("#action-message"), error.message, "error"); }
    finally { button.disabled = false; }
  }

  async function handleActionClick(event) {
    const row = event.target.closest("tr[data-action-code]"); if (!row) return;
    selectedActionKey = `${row.dataset.shopId}:${row.dataset.actionCode}`; renderPromotions();
  }
  function selectedAction() { return (state.shopActions || []).find(item => `${item.shop_id}:${actionOf(item)[0]}` === selectedActionKey); }
  async function deleteSelectedAction() {
    const entry = selectedAction(); if (!entry || !window.confirm(`Delete promotion ${actionOf(entry)[1] || actionOf(entry)[0]} from ${entry.shop_name}?`)) return;
    try { await api("shop_actions", { method: "POST", body: { operation: "delete", shop_id: entry.shop_id, code: actionOf(entry)[0], original_code: actionOf(entry)[0] } }); state.shopActions = (await api("shop_actions")).items || []; selectedActionKey = ""; renderPromotions(); showToast("Promotional action deleted."); }
    catch (error) { showToast(error.message, true); }
  }

  function bindEvents() {
    field("#action-add")?.addEventListener("click", () => openEditor());
    field("#action-edit-selected")?.addEventListener("click", () => { const entry = selectedAction(); if (entry) openEditor(entry); });
    field("#action-delete-selected")?.addEventListener("click", deleteSelectedAction);
    field("#action-cancel")?.addEventListener("click", () => { field("#action-editor").close(); editing = null; });
    field("#action-cancel-footer")?.addEventListener("click", () => { field("#action-editor").close(); editing = null; });
    field("#action-editor")?.addEventListener("click", event => { if (event.target === field("#action-editor")) field("#action-editor").close(); });
    field("#action-form")?.addEventListener("submit", saveAction);
    field("#promotions-body")?.addEventListener("click", handleActionClick);
    field("#action-shop-filter")?.addEventListener("change", renderPromotions);
    field("#action-search")?.addEventListener("input", renderPromotions);
    bindToolEvents();
  }
  const toolFlags = ["#tool-enabled", "#tool-quick", "#tool-markpad", "#tool-customer", "#tool-drawer", "#tool-receipt", "#tool-change"];
  async function renderTools() {
    const body = field("#tools-body"); if (!body) return;
    const shops = state.shops || []; const filter = field("#tool-shop-filter"); const shopSelect = field("#tool-shop");
    if (filter) { const selected = filter.value; filter.replaceChildren(new Option("All shops", "")); shops.forEach(shop => filter.add(new Option(shop.Shop_name || "Shop", text(shop.Shop_Id)))); filter.value = selected; }
    if (shopSelect) { const selected = shopSelect.value; shopSelect.replaceChildren(new Option("Choose a shop", "")); shops.forEach(shop => shopSelect.add(new Option(shop.Shop_name || "Shop", text(shop.Shop_Id)))); if (shops.some(shop => text(shop.Shop_Id) === selected)) shopSelect.value = selected; }
    const query = (field("#tool-search")?.value || "").trim().toLowerCase(); const selectedShop = filter?.value || "";
    try {
      const response = await api("shop_payment_tools");
      paymentTools = (response.items || []).map(item => ({ ...item, shop: shops.find(shop => text(shop.Shop_Id) === text(item.shop_id)) || { Shop_Id: item.shop_id, Shop_name: item.shop_name } }));
    } catch (error) { showToast(error.message, true); paymentTools = []; }
    paymentTools = paymentTools.filter(item => (!selectedShop || text(item.shop.Shop_Id) === selectedShop) && (!query || [item.shop.Shop_name, ...item.tool].some(value => text(value).toLowerCase().includes(query))));
    if (!paymentTools.some(item => `${item.shop_Id || item.shop.Shop_Id}:${item.index}` === selectedToolKey)) selectedToolKey = "";
    body.replaceChildren();
    paymentTools.forEach((item, rowIndex) => {
      const row = document.createElement("tr"); row.dataset.toolRow = String(rowIndex);
      if (`${item.shop_Id || item.shop.Shop_Id}:${item.index}` === selectedToolKey) row.classList.add("manager-selected-row");
      [item.shop.Shop_name, ...item.tool].forEach((value, i) => { const cell = document.createElement("td"); cell.textContent = i >= 6 ? (Number(value) ? "Yes" : "No") : text(value) || "-"; row.append(cell); });
      body.append(row);
    });
    field("#tool-edit").disabled = !selectedToolKey;
    field("#tool-delete").disabled = !selectedToolKey;
    if (!paymentTools.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 13; cell.className = "empty-state"; cell.textContent = "No payment tools match this shop and search."; row.append(cell); body.append(row); }
  }

  function toolPayload() { return [field("#tool-name").value.trim(), field("#tool-method").value, field("#tool-code").value.trim(), field("#tool-shortcut").value.trim(), field("#tool-access").value.trim(), ...toolFlags.map(selector => field(selector).checked ? 1 : 0)]; }
  function openToolEditor(item = null) {
    editingTool = item; field("#tool-form").reset(); field("#tool-editor-title").textContent = item ? "Edit payment tool" : "New payment tool";
    if (!item) { selectedToolKey = ""; field("#tool-edit").disabled = true; field("#tool-delete").disabled = true; renderTools(); }
    if (item) { field("#tool-shop").value = text(item.shop.Shop_Id); ["#tool-name", "#tool-method", "#tool-code", "#tool-shortcut", "#tool-access"].forEach((selector, i) => { field(selector).value = text(item.tool[i]); }); toolFlags.forEach((selector, i) => { field(selector).checked = Boolean(Number(item.tool[i + 5])); }); }
    else if (field("#tool-shop-filter")?.value) field("#tool-shop").value = field("#tool-shop-filter").value;
    setMessage(field("#tool-message"), ""); field("#tool-editor").showModal();
  }
  async function saveTool(event) {
    event.preventDefault(); const button = field("#tool-form [type=submit]"); button.disabled = true;
    try { await api("shop_payment_tools", { method: "POST", body: { operation: editingTool ? "update" : "create", shop_id: field("#tool-shop").value, index: editingTool?.index, tool: toolPayload() } }); state.shops = (await api("list", { query: { resource: "shops" } })).items || state.shops; field("#tool-editor").close(); editingTool = null; renderTools(); showToast("Payment tool saved."); }
    catch (error) { setMessage(field("#tool-message"), error.message, "error"); } finally { button.disabled = false; }
  }
  async function handleToolClick(event) {
    const row = event.target.closest("tr[data-tool-row]"); if (!row) return; const item = paymentTools[Number(row.dataset.toolRow)]; if (!item) return;
    selectedToolKey = `${item.shop_Id || item.shop.Shop_Id}:${item.index}`; renderTools();
  }
  function selectedTool() { return paymentTools.find(item => `${item.shop_Id || item.shop.Shop_Id}:${item.index}` === selectedToolKey); }
  async function deleteSelectedTool() {
    const item = selectedTool(); if (!item || !window.confirm(`Delete ${item.tool[0]} from ${item.shop.Shop_name}?`)) return;
    try { await api("shop_payment_tools", { method: "POST", body: { operation: "delete", shop_id: item.shop.Shop_Id, index: item.index } }); state.shops = (await api("list", { query: { resource: "shops" } })).items || state.shops; selectedToolKey = ""; renderTools(); showToast("Payment tool deleted."); } catch (error) { showToast(error.message, true); }
  }

  function bindToolEvents() {
    field("#tool-add")?.addEventListener("click", () => openToolEditor());
    field("#tool-edit")?.addEventListener("click", () => { const item = selectedTool(); if (item) openToolEditor(item); });
    field("#tool-delete")?.addEventListener("click", deleteSelectedTool);
    field("#tool-cancel")?.addEventListener("click", () => { field("#tool-editor").close(); editingTool = null; });
    field("#tool-cancel-footer")?.addEventListener("click", () => { field("#tool-editor").close(); editingTool = null; });
    field("#tool-editor")?.addEventListener("click", event => { if (event.target === field("#tool-editor")) field("#tool-editor").close(); });
    field("#tool-form")?.addEventListener("submit", saveTool);
    field("#tools-body")?.addEventListener("click", handleToolClick);
    field("#tool-shop-filter")?.addEventListener("change", renderTools);
    field("#tool-search")?.addEventListener("input", renderTools);
  }
  return { renderTools, renderPromotions, bindEvents };
})();
