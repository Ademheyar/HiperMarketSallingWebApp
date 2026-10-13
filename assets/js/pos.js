/**
 * pos.js - POS Terminal & Checkout Module (#view-pos)
 */
window.HiperPos = (() => {
  "use strict";

  const { state, $, api, showToast, setMessage } = window.HiperApi;

  function renderShopOptions() {
    const select = $("#sale-shop");
    if (!select) return;

    const workShops = window.HiperAuth ? window.HiperAuth.getUserWorkShops() : (state.shops || []);
    const activeName = state.activeShop?.Shop_name || state.activeShop?.name || select.value || "Main Shop";

    select.replaceChildren();

    for (const shop of workShops) {
      const option = document.createElement("option");
      const name = shop.Shop_name || shop.name || shop.Shop_brand_name || "Main Shop";
      option.value = name;
      option.textContent = shop.Shop_brand_name ? `${name} (${shop.Shop_brand_name})` : name;
      select.append(option);
    }

    if (workShops.length === 0) {
      const opt = document.createElement("option");
      opt.value = "Main Shop";
      opt.textContent = "Main Shop";
      select.append(opt);
    }

    select.value = activeName;
  }

  function bindPosShopEvents() {
    $("#sale-shop")?.addEventListener("change", (e) => {
      const selectedName = e.target.value;
      const workShops = window.HiperAuth ? window.HiperAuth.getUserWorkShops() : [];
      const found = workShops.find(s => (s.Shop_name || s.name || s.Shop_brand_name) === selectedName);
      if (found && window.HiperAuth) {
        window.HiperAuth.selectActiveShop(found);
      }
    });
  }

  function renderProductSearch(searchTerm = "") {
    const results = $("#pos-results");
    if (!results) return;
    results.replaceChildren();
    const term = searchTerm.trim().toLowerCase();
    const matches = (state.products || []).filter((item) => {
      const found = !term || [item.name, item.code, item.barcode, item.description]
        .some((value) => String(value || "").toLowerCase().includes(term));
      return found && (item.service || Number(item.quantity) > 0);
    }).slice(0, 80);

    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = term ? "No matching in-stock products." : "No in-stock products found.";
      results.append(empty);
      return;
    }

    for (const item of matches) {
      const row = document.createElement("div");
      row.className = "product-result";
      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.name || "Unnamed Product";
      const meta = document.createElement("small");
      meta.textContent = `${item.service ? "Service" : `${item.quantity || 0} in stock`} · $${item.price}${item.code ? ` · ${item.code}` : ""}`;
      details.append(title, meta);
      const add = document.createElement("button");
      add.className = "button button-secondary";
      add.textContent = "Add";
      add.addEventListener("click", () => addToCart(item));
      row.append(details, add);
      results.append(row);
    }
  }

  function addToCart(product) {
    const existing = state.cart.find((line) => String(line.product.id) === String(product.id));
    if (existing) {
      existing.quantity += 1;
    } else {
      state.cart.push({ product, quantity: 1, price: Number(product.price) || 0 });
    }
    renderCart();
  }

  function cartTotal() {
    return state.cart.reduce((total, line) => total + line.quantity * line.price, 0);
  }

  function renderCart() {
    const container = $("#cart-items");
    if (!container) return;
    container.replaceChildren();
    if (!state.cart.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Your active cart is empty.";
      container.append(empty);
    } else {
      for (const [index, line] of state.cart.entries()) {
        const row = document.createElement("div");
        row.className = "cart-row";
        const details = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = line.product.name || "Product";
        const price = document.createElement("small");
        price.textContent = `$${line.price} each`;
        details.append(title, price);
        const quantity = document.createElement("input");
        quantity.className = "input cart-qty";
        quantity.type = "number";
        quantity.min = "1";
        quantity.value = String(line.quantity);
        quantity.addEventListener("change", () => {
          const value = Number(quantity.value);
          if (value <= 0 || !Number.isFinite(value)) {
            quantity.value = String(line.quantity);
            return;
          }
          line.quantity = value;
          renderCart();
        });
        const lineTotal = document.createElement("span");
        lineTotal.className = "cart-line-total";
        lineTotal.textContent = "$" + (line.quantity * line.price).toFixed(2);
        const remove = document.createElement("button");
        remove.className = "remove-line";
        remove.type = "button";
        remove.textContent = "×";
        remove.addEventListener("click", () => {
          state.cart.splice(index, 1);
          renderCart();
        });
        row.append(details, quantity, lineTotal, remove);
        container.append(row);
      }
    }
    const total = cartTotal();
    if ($("#cart-count")) $("#cart-count").textContent = String(state.cart.reduce((sum, line) => sum + line.quantity, 0));
    if ($("#cart-subtotal")) $("#cart-subtotal").textContent = "$" + total.toFixed(2);
    if ($("#cart-tax")) $("#cart-tax").textContent = "$0.00";
    if ($("#cart-total")) $("#cart-total").textContent = "$" + total.toFixed(2);
    if ($("#sale-received")) $("#sale-received").value = String(total.toFixed(2));
  }

  async function completeSale() {
    const button = $("#complete-sale");
    const message = $("#pos-message");
    if (!state.cart.length) {
      setMessage(message, "Add at least one item to the sale.", "error");
      return;
    }
    const received = Number($("#sale-received").value) || cartTotal();
    button.disabled = true;
    setMessage(message, "Saving sale and updating stock…");
    try {
      const result = await api("sale", {
        method: "POST",
        body: {
          shop_id: $("#sale-shop").value || "Main Shop",
          customer_id: $("#sale-customer").value.trim() || "Walk-in Customer",
          received,
          payments: [[
            $("#sale-method").value || "Cash", $("#sale-method").value || "Cash", received
          ]],
          items: state.cart.map((line) => ({
            product_id: line.product.id,
            quantity: line.quantity,
            price: line.price,
            name: line.product.name
          }))
        }
      });

      const receipt = {
        doc_barcode: result.sale.doc_barcode,
        doc_created_date: new Date().toISOString().replace("T", " ").substring(0, 19),
        At_Shop_Id: $("#sale-shop").value || "Main Shop",
        item: JSON.stringify(state.cart.map((line) => ({
          name: line.product.name,
          quantity: line.quantity,
          price: line.price
        }))),
        price: result.sale.total,
        pid: received,
        payments: JSON.stringify([[$("#sale-method").value || "Cash", "Paid", received]])
      };

      state.cart = [];
      renderCart();
      setMessage(message, `Sale ${result.sale.doc_barcode} saved successfully.`, "success");
      showReceipt(receipt);
      if (window.HiperApp) await window.HiperApp.refreshWorkspace();
    } catch (error) {
      setMessage(message, error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  function showReceipt(sale) {
    let items = [];
    try { items = JSON.parse(sale.item || "[]"); } catch { items = []; }
    const width = 42;
    const lines = [
      "HIPER MARKET STORE",
      "-".repeat(width),
      `Receipt: ${sale.doc_barcode || "PREVIEW"}`,
      `Date: ${sale.doc_created_date || ""}`,
      `Shop: ${sale.At_Shop_Id || "Main Shop"}`,
      "-".repeat(width),
      "ITEM                         QTY       PRICE"
    ];
    for (const item of items) {
      const title = String(item.name || "Item");
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      lines.push(`${title.slice(0, 25).padEnd(25)} ${String(qty).padStart(5)} $${(price * qty).toFixed(2).padStart(9)}`);
    }
    const total = Number(sale.price) || 0;
    const received = Number(sale.pid) || 0;
    lines.push("-".repeat(width), `Total: $${total.toFixed(2)}`, `Received: $${received.toFixed(2)}`, `Balance: $${Math.max(total - received, 0).toFixed(2)}`);
    lines.push("-".repeat(width), "Thank you for shopping with us!");

    if ($("#receipt-title")) $("#receipt-title").textContent = sale.doc_barcode || "Sale details";
    if ($("#receipt-content")) $("#receipt-content").textContent = lines.join("\n");
    const dialog = $("#sale-detail-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  return {
    renderShopOptions,
    bindPosShopEvents,
    renderProductSearch,
    renderCart,
    completeSale,
    showReceipt
  };
})();