/**
 * pos.js - POS Terminal & Checkout Module (#view-pos)
 */
window.HiperPos = (() => {
  "use strict";

  const { state, $, api, showToast, setMessage, formatMoney } = window.HiperApi;
  let pendingPayments = [];
  const heldSalesKey = "hiper_pos_held_sales";

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
    populateCustomerOptions();
  }

  function triggerPosEndDay() {
    if (window.HiperDocuments && typeof window.HiperDocuments.performEndDay === "function") {
      window.HiperDocuments.performEndDay(true);
    } else {
      if (window.HiperApi) window.HiperApi.showToast("End Day module loading...", true);
    }
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

    $("#pos-activities-btn")?.addEventListener("click", triggerPosEndDay);
    $("#pos-payment-btn")?.addEventListener("click", openPaymentDialog);
    $("#pos-calc-btn")?.addEventListener("click", toggleCartSummaryDetails);
    $("#cart-summary-more")?.addEventListener("click", toggleCartSummaryDetails);
    $("#pos-none-item-btn")?.addEventListener("click", clearCart);
    $("#pos-drawer-btn")?.addEventListener("click", () => showToast("Cash drawer hardware is not connected to this POS.", true));
    $("#pos-fullscreen-btn")?.addEventListener("click", toggleFullscreen);
    $("#pos-hold-btn")?.addEventListener("click", holdCurrentSale);
    $("#pos-held-list-btn")?.addEventListener("click", openHeldSales);
    $("#pos-held-close")?.addEventListener("click", () => $("#pos-held-dialog")?.close());
    document.addEventListener("fullscreenchange", () => {
      const button = $("#pos-fullscreen-btn");
      if (button) button.textContent = document.fullscreenElement ? "⛶ Exit Full Screen" : "⛶ Full Screen";
    });
    $("#pos-payment-close")?.addEventListener("click", closePaymentDialog);
    $("#pos-payment-cancel")?.addEventListener("click", closePaymentDialog);
    $("#pos-payment-add")?.addEventListener("click", addPaymentLine);
    $("#pos-payment-keypad")?.addEventListener("click", openPaymentKeypad);
    $("#pos-payment-confirm")?.addEventListener("click", submitSale);
    $("#pos-payment-amount")?.addEventListener("keydown", event => { if (event.key === "Enter") addPaymentLine(); });
    $("#pos-search")?.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const input = event.currentTarget;
      const query = input.value.trim().toLowerCase();
      const match = (state.products || []).find(item => [item.barcode, item.code, item.name].some(value => String(value || "").toLowerCase() === query));
      if (match && (match.service || Number(match.quantity) > 0)) {
        addToCart(match);
        input.value = "";
        renderProductSearch("");
      }
    });
    populateCustomerOptions();

    // POS Keyboard Shortcuts (F1, F2, F6, F10)
    window.addEventListener("keydown", (e) => {
      if (state.activeView !== "pos") return;

      if (e.key === "F6") {
        e.preventDefault();
        triggerPosEndDay();
      } else if (e.key === "F10") {
        e.preventDefault();
        if ($("#pos-payment-dialog")?.open) submitSale();
        else openPaymentDialog();
      } else if (e.key === "F1") {
        e.preventDefault();
        toggleCartSummaryDetails();
      } else if (e.key === "F2") {
        e.preventDefault();
        clearCart();
      }
    });
  }

  function populateCustomerOptions() {
    const list = $("#pos-customer-options");
    if (!list) return;
    list.replaceChildren();
    (state.users || []).filter(user => /customer|costumer|client/i.test(String(user.User_type || ""))).forEach(user => {
      const option = document.createElement("option");
      option.value = [user.User_fname, user.User_Lname].filter(Boolean).join(" ") || user.User_name || "Customer";
      list.append(option);
    });
  }

  function clearCart() {
    state.cart = [];
    pendingPayments = [];
    renderCart();
    if (window.HiperHome?.renderHomeCart) window.HiperHome.renderHomeCart();
  }

  function readHeldSales() {
    try { const held = JSON.parse(localStorage.getItem(heldSalesKey) || "[]"); return Array.isArray(held) ? held : []; }
    catch { return []; }
  }

  function holdCurrentSale() {
    if (!state.cart?.length) { showToast("Add items before holding a sale.", true); return; }
    const heldSales = readHeldSales();
    heldSales.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), shop: $("#sale-shop")?.value || "Main Shop", customer: $("#sale-customer")?.value || "", cart: state.cart.map(line => ({ product: { ...line.product }, quantity: line.quantity, price: line.price })) });
    localStorage.setItem(heldSalesKey, JSON.stringify(heldSales));
    clearCart();
    if ($("#sale-customer")) $("#sale-customer").value = "";
    showToast("Sale held. You can recall it from Held Sales.");
  }

  function openHeldSales() {
    renderHeldSales();
    const dialog = $("#pos-held-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function renderHeldSales() {
    const container = $("#pos-held-list");
    if (!container) return;
    container.replaceChildren();
    const heldSales = readHeldSales();
    if (!heldSales.length) { container.innerHTML = `<p class="empty-state">No held sales to recall.</p>`; return; }
    heldSales.forEach((held, index) => {
      const row = document.createElement("article");
      row.className = "pos-held-row";
      const summary = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `${held.customer || "Walk-in Customer"} · ${held.shop || "Main Shop"}`;
      const details = document.createElement("small");
      const itemCount = (held.cart || []).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
      const total = (held.cart || []).reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.price) || 0), 0);
      details.textContent = `${itemCount} items · ${formatMoney(total, held.shop)} · ${new Date(held.createdAt).toLocaleString()}`;
      summary.append(title, details);
      const restore = document.createElement("button");
      restore.type = "button"; restore.className = "button button-primary button-small"; restore.textContent = "Recall";
      restore.addEventListener("click", () => {
        if (state.cart?.length && !window.confirm("Replace the current cart with this held sale?")) return;
        state.cart = (held.cart || []).map(line => ({ ...line, product: { ...line.product } }));
        if ($("#sale-shop")) {
          $("#sale-shop").value = held.shop || "Main Shop";
          $("#sale-shop").dispatchEvent(new Event("change", { bubbles: true }));
        }
        if ($("#sale-customer")) $("#sale-customer").value = held.customer || "";
        heldSales.splice(index, 1);
        localStorage.setItem(heldSalesKey, JSON.stringify(heldSales));
        renderCart();
        if (window.HiperHome?.renderHomeCart) window.HiperHome.renderHomeCart();
        $("#pos-held-dialog")?.close();
        showToast("Held sale restored to the active cart.");
      });
      const remove = document.createElement("button");
      remove.type = "button"; remove.className = "button button-quiet button-small"; remove.textContent = "Delete";
      remove.addEventListener("click", () => { heldSales.splice(index, 1); localStorage.setItem(heldSalesKey, JSON.stringify(heldSales)); renderHeldSales(); });
      row.append(summary, restore, remove);
      container.append(row);
    });
  }

  function toggleCartSummaryDetails() {
    const details = $("#cart-summary-details");
    const button = $("#cart-summary-more");
    if (!details) return;
    details.hidden = !details.hidden;
    if (button) {
      button.setAttribute("aria-expanded", String(!details.hidden));
      button.textContent = details.hidden ? "More total details" : "Hide total details";
    }
  }

  function openPaymentKeypad() {
    const amount = $("#pos-payment-amount");
    if (window.HiperGetValue) {
      window.HiperGetValue.openKeypadDialog("Payment amount", amount?.value || "0", value => {
        if (amount) amount.value = value;
      });
    } else amount?.focus();
  }

  function toggleFullscreen() {
    const target = $("#view-pos");
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (target?.requestFullscreen) target.requestFullscreen().catch(() => showToast("Full screen is not available in this browser.", true));
    else showToast("Full screen is not available in this browser.", true);
  }

  function closePaymentDialog() {
    $("#pos-payment-dialog")?.close();
  }

  function refreshPaymentSummary() {
    const total = cartTotal();
    const paid = pendingPayments.reduce((sum, line) => sum + line.amount, 0);
    const shop = $("#sale-shop")?.value;
    if ($("#pos-payment-total")) $("#pos-payment-total").textContent = formatMoney(total, shop);
    if ($("#pos-payment-remaining")) $("#pos-payment-remaining").textContent = formatMoney(Math.max(0, total - paid), shop);
    if ($("#pos-payment-amount")) $("#pos-payment-amount").value = Math.max(0, total - paid).toFixed(2);
    const confirm = $("#pos-payment-confirm");
    if (confirm) confirm.disabled = paid + 0.00001 < total || !state.cart.length;
    const lines = $("#pos-payment-lines");
    if (!lines) return;
    lines.replaceChildren();
    if (!pendingPayments.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Add one or more payment methods to cover the sale total.";
      lines.append(empty);
    }
    pendingPayments.forEach((payment, index) => {
      const row = document.createElement("div");
      row.className = "pos-payment-line";
      const label = document.createElement("span");
      label.textContent = payment.method;
      const amount = document.createElement("strong");
      amount.textContent = formatMoney(payment.amount, shop);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button button-quiet button-small";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => { pendingPayments.splice(index, 1); refreshPaymentSummary(); });
      row.append(label, amount, remove);
      lines.append(row);
    });
  }

  function openPaymentDialog() {
    if (!state.cart.length) {
      setMessage($("#pos-message"), "Add at least one item to the sale.", "error");
      return;
    }
    const method = "Cash";
    pendingPayments = cartTotal() > 0 ? [{ method, amount: cartTotal() }] : [];
    if ($("#pos-payment-method")) $("#pos-payment-method").value = method;
    if ($("#pos-payment-dialog") && !$("#pos-payment-dialog").open) $("#pos-payment-dialog").showModal();
    refreshPaymentSummary();
    setMessage($("#pos-payment-message"), pendingPayments.length ? "Remove the suggested payment to enter split amounts." : "Add payment methods to cover the sale total.");
  }

  function addPaymentLine() {
    const method = $("#pos-payment-method")?.value || "Cash";
    const amount = Number($("#pos-payment-amount")?.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage($("#pos-payment-message"), "Enter a payment amount greater than zero.", "error");
      return;
    }
    pendingPayments.push({ method, amount: Math.round(amount * 100) / 100 });
    refreshPaymentSummary();
    setMessage($("#pos-payment-message"), "Payment added.", "success");
  }

  function renderProductSearch(searchTerm = "") {
    const results = $("#pos-results");
    if (!results) return;
    results.replaceChildren();
    const term = searchTerm.trim().toLowerCase();
    results.hidden = true;
    if (!term) return;
    const matches = (state.products || []).filter((item) => {
      const found = [item.name, item.code, item.barcode, item.description]
        .some((value) => String(value || "").toLowerCase().includes(term));
      return found && (item.service || Number(item.quantity) > 0);
    }).slice(0, 80);

    if (!matches.length) return;
    results.hidden = false;

    for (const item of matches) {
      const row = document.createElement("div");
      row.className = "product-result";
      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.name || "Unnamed Product";
      const meta = document.createElement("small");
      meta.textContent = `${item.service ? "Service" : `${item.quantity || 0} in stock`} · ${formatMoney(item.price, item.at_shop)}${item.code ? ` · ${item.code}` : ""}`;
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
    if (!Array.isArray(state.cart)) state.cart = [];
    const existing = state.cart.find((line) => String(line.product.id) === String(product.id));
    if (existing) {
      existing.quantity += 1;
    } else {
      state.cart.push({ product, quantity: 1, price: Number(product.price) || 0 });
    }
    renderCart();
    if (window.HiperHome && window.HiperHome.renderHomeCart) window.HiperHome.renderHomeCart();
  }

  function cartTotal() {
    return (state.cart || []).reduce((total, line) => total + line.quantity * line.price, 0);
  }

  function renderCart() {
    if (!Array.isArray(state.cart)) state.cart = [];
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
        const choices = [line.product.size && `Size ${line.product.size}`, line.product.color && `Color ${line.product.color}`].filter(Boolean).join(" · ");
        price.textContent = `${formatMoney(line.price, line.product.at_shop)} each${choices ? ` · ${choices}` : ""}`;
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
        lineTotal.textContent = formatMoney(line.quantity * line.price, line.product.at_shop);
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
    const itemCount = state.cart.reduce((sum, line) => sum + line.quantity, 0);
    if ($("#cart-count")) $("#cart-count").textContent = String(itemCount);
    if ($("#cart-total-items")) $("#cart-total-items").textContent = String(itemCount);
    if ($("#cart-subtotal")) $("#cart-subtotal").textContent = formatMoney(total);
    if ($("#cart-tax")) $("#cart-tax").textContent = formatMoney(0);
    if ($("#cart-item-discount")) $("#cart-item-discount").textContent = formatMoney(0);
    if ($("#cart-discount")) $("#cart-discount").textContent = formatMoney(0);
    if ($("#cart-total")) $("#cart-total").textContent = formatMoney(total);
    if ($("#cart-total-detail")) $("#cart-total-detail").textContent = formatMoney(total);
    if ($("#pos-payment-dialog")?.open) refreshPaymentSummary();
  }

  async function submitSale() {
    const button = $("#complete-sale");
    const message = $("#pos-message");
    if (!state.cart.length) {
      setMessage(message, "Add at least one item to the sale.", "error");
      return;
    }
    const received = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);
    if (received + 0.00001 < cartTotal()) {
      setMessage($("#pos-payment-message"), "Payments must cover the sale total before checkout.", "error");
      return;
    }
    button.disabled = true;
    setMessage(message, "Saving sale and updating stock…");
    try {
      const result = await api("sale", {
        method: "POST",
        body: {
          shop_id: $("#sale-shop").value || "Main Shop",
          customer_id: $("#sale-customer").value.trim() || "Walk-in Customer",
          received,
          payments: pendingPayments.map(payment => [payment.method, payment.method, payment.amount]),
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
        payments: JSON.stringify(pendingPayments.map(payment => [payment.method, "Paid", payment.amount]))
      };

      state.cart = [];
      pendingPayments = [];
      renderCart();
      closePaymentDialog();
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
    const currencyShop = sale.At_Shop_Id || $("#sale-shop")?.value;
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
      lines.push(`${title.slice(0, 25).padEnd(25)} ${String(qty).padStart(5)} ${formatMoney(price * qty, currencyShop).padStart(9)}`);
    }
    const total = Number(sale.price) || 0;
    const received = Number(sale.pid) || 0;
    let payments = [];
    try { payments = JSON.parse(sale.payments || "[]"); } catch { payments = []; }
    lines.push("-".repeat(width), `Total: ${formatMoney(total, currencyShop)}`);
    payments.forEach(payment => lines.push(`${String(payment[0] || "Payment")}: ${formatMoney(Number(payment[2]) || 0, currencyShop)}`));
    lines.push(`Received: ${formatMoney(received, currencyShop)}`, `Change: ${formatMoney(Math.max(received - total, 0), currencyShop)}`);
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
    completeSale: openPaymentDialog,
    openPaymentDialog,
    clearCart,
    showReceipt
  };
})();
