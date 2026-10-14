/**
 * documents.js - Manage Documents Module (#view-sales / Doc.py, Chart.py, docediterform.py - 100% Matching Python Desktop App)
 */
window.HiperDocuments = (() => {
  "use strict";

  const { state, $, $$, api, showToast } = window.HiperApi;

  // Open Document Editors Registry (Map docId/barcode -> { docKey, docItem, items, payments, activeTab })
  const openDocEditors = new Map();
  let activeTopTabId = "main-docs"; // "main-docs" or docBarcode/docId

  function initDocDates() {
    const today = new Date().toISOString().split("T")[0];
    const dateFromInput = $("#filter-date-from");
    const dateToInput = $("#filter-date-to");
    if (dateFromInput && (!dateFromInput.value || dateFromInput.value.trim() === "")) {
      dateFromInput.value = today;
    }
    if (dateToInput && (!dateToInput.value || dateToInput.value.trim() === "")) {
      dateToInput.value = today;
    }
  }

  function populateUserDropdown() {
    const userSelect = $("#filter-user-id");
    const sellerSelect = $("#filter-seller-id");
    const customerSelect = $("#filter-customer-id");
    const shopSelect = $("#filter-at-shop");

    const uniqueUsers = Array.from(
      new Set((state.sales || []).map(s => s.user_id || s.Seller_id || "admin").filter(Boolean))
    );
    if (!uniqueUsers.includes("admin")) uniqueUsers.unshift("admin");

    if (userSelect) {
      const cur = userSelect.value;
      userSelect.innerHTML = `<option value=""></option>` +
        uniqueUsers.map(u => `<option value="${u}">${u}</option>`).join("");
      userSelect.value = cur;
    }

    if (sellerSelect) {
      const cur = sellerSelect.value;
      sellerSelect.innerHTML = `<option value=""></option>` +
        uniqueUsers.map(u => `<option value="${u}">${u}</option>`).join("");
      sellerSelect.value = cur;
    }

    if (customerSelect) {
      const cur = customerSelect.value;
      const uniqueCustomers = Array.from(
        new Set((state.sales || []).map(s => s.customer_id).filter(Boolean))
      );
      customerSelect.innerHTML = `<option value=""></option>` +
        uniqueCustomers.map(c => `<option value="${c}">${c}</option>`).join("");
      customerSelect.value = cur;
    }

    if (shopSelect) {
      const cur = shopSelect.value;

      // 1. List user working shops ONLY
      const userWorkShops = window.HiperAuth ? window.HiperAuth.getUserWorkShops() : [];
      let shopList = userWorkShops.map(s => s.Shop_name || s.name || s.Shop_brand_name).filter(Boolean);

      // Fallback to state.shops if userWorkShops is empty
      if (shopList.length === 0 && state.shops && state.shops.length > 0) {
        shopList = state.shops.map(s => s.Shop_name || s.name || s.Shop_brand_name).filter(Boolean);
      }

      const uniqueWorkShops = Array.from(new Set(shopList));

      // 2. Empty space option for All Shops
      let optionsHtml = `<option value="">All Shops</option>`;
      uniqueWorkShops.forEach(sName => {
        optionsHtml += `<option value="${sName}">${sName}</option>`;
      });

      shopSelect.innerHTML = optionsHtml;

      // 3. Default selection: User Profile selected shop or pressed Manager button shop (state.activeShop)
      const activeShopName = state.activeShop?.Shop_name || state.activeShop?.name || state.activeShop?.Shop_brand_name || "";

      if (cur) {
        shopSelect.value = cur;
      } else if (activeShopName && uniqueWorkShops.includes(activeShopName)) {
        shopSelect.value = activeShopName;
      } else if (uniqueWorkShops.length > 0) {
        shopSelect.value = uniqueWorkShops[0];
      } else {
        shopSelect.value = "";
      }
    }
  }

  // --- TOP TABS MANAGEMENT (Doc.py center_notebook) ---
  function openDocumentInTopTab(docItem) {
    if (!docItem) return;
    const docKey = String(docItem.doc_barcode || docItem.id || "1001");

    state.selectedDocInTable = docItem;

    if (!openDocEditors.has(docKey)) {
      let items = [];
      try {
        items = typeof docItem.item === "string" ? JSON.parse(docItem.item) : (docItem.item || []);
      } catch {
        items = [{ name: "Cart Item", quantity: docItem.qty || 1, price: docItem.price || 0 }];
      }

      let payments = [];
      try {
        payments = typeof docItem.payments === "string" ? JSON.parse(docItem.payments) : (docItem.payments || []);
      } catch {
        payments = [{ type: docItem.payments || "Cash", amount: docItem.pid || docItem.price || 0, date: docItem.doc_created_date || "" }];
      }

      openDocEditors.set(docKey, {
        docKey,
        docItem: { ...docItem },
        items,
        payments,
        activeTab: "items" // "items" or "payment"
      });
    }

    activeTopTabId = docKey;
    renderTopTabs();
    switchTopTab(docKey);
  }

  function closeTopTab(docKey) {
    if (openDocEditors.has(docKey)) {
      openDocEditors.delete(docKey);
      const editorDom = $(`#doc-editor-container-${docKey}`);
      if (editorDom) editorDom.remove();
    }

    if (activeTopTabId === docKey) {
      const remainingKeys = Array.from(openDocEditors.keys());
      const nextKey = remainingKeys.length > 0 ? remainingKeys[remainingKeys.length - 1] : "main-docs";
      switchTopTab(nextKey);
    } else {
      renderTopTabs();
    }
  }

  function switchTopTab(tabId) {
    activeTopTabId = tabId;

    // Highlight top tab buttons
    $("#main-doc-tab-btn")?.classList.toggle("active", tabId === "main-docs");
    $$(".dynamic-top-tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.docKey === tabId);
    });

    // Show/hide view containers
    const mainDocsBox = $("#main-docs-container");
    const openEditorsBox = $("#open-doc-editors-container");

    if (mainDocsBox) {
      mainDocsBox.style.display = (tabId === "main-docs") ? "block" : "none";
    }

    if (openEditorsBox) {
      openEditorsBox.style.display = (tabId === "main-docs") ? "none" : "block";
      $$(".doc-editor-instance", openEditorsBox).forEach(el => {
        el.style.display = el.id === `doc-editor-container-${tabId}` ? "block" : "none";
      });
    }

    renderTopTabs();
  }

  function renderTopTabs() {
    const dynamicTabsContainer = $("#dynamic-doc-tabs");
    if (!dynamicTabsContainer) return;
    dynamicTabsContainer.replaceChildren();

    openDocEditors.forEach((editorData, docKey) => {
      const btn = document.createElement("button");
      btn.className = `top-doc-tab dynamic-top-tab ${activeTopTabId === docKey ? "active" : ""}`;
      btn.dataset.docKey = docKey;
      btn.innerHTML = `<span>📝 DOC #${docKey}</span>`;

      const closeBtn = document.createElement("span");
      closeBtn.className = "top-tab-close-btn";
      closeBtn.innerHTML = "&times;";
      closeBtn.title = "Close tab";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeTopTab(docKey);
      });

      btn.append(closeBtn);
      btn.addEventListener("click", () => switchTopTab(docKey));
      dynamicTabsContainer.append(btn);
    });

    renderOpenDocEditors();
  }

  function renderOpenDocEditors() {
    const openEditorsBox = $("#open-doc-editors-container");
    if (!openEditorsBox) return;

    openEditorsBox.style.display = (activeTopTabId === "main-docs") ? "none" : "block";

    openDocEditors.forEach((editorData, docKey) => {
      let editorContainer = $(`#doc-editor-container-${docKey}`);
      if (!editorContainer) {
        editorContainer = document.createElement("div");
        editorContainer.id = `doc-editor-container-${docKey}`;
        editorContainer.className = "panel doc-editor-instance";
        editorContainer.style.background = "#0b1726";
        editorContainer.style.padding = "16px";
        editorContainer.style.marginTop = "8px";
        openEditorsBox.append(editorContainer);
      }

      editorContainer.style.display = (activeTopTabId === docKey) ? "block" : "none";

      const { docItem, items, payments, activeTab } = editorData;

      let totalQty = 0;
      let totalPrice = 0;
      items.forEach(it => {
        const q = Number(it.quantity || it.qty) || 1;
        const p = Number(it.price) || 0;
        totalQty += q;
        totalPrice += q * p;
      });

      docItem.price = totalPrice;
      docItem.qty = totalQty;

      editorContainer.innerHTML = `
        <div class="section-toolbar">
          <h3>📝 Document Editor - #${docKey}</h3>
          <div style="display: flex; gap: 8px;">
            <button class="button button-primary btn-save-doc" data-key="${docKey}">💾 Save Changes</button>
            <button class="button button-secondary btn-print-doc" data-key="${docKey}">🖨️ Print Slip</button>
            <button class="button button-quiet btn-close-doc" data-key="${docKey}">✖️ Close Tab</button>
          </div>
        </div>

        <!-- Top Doc Header Info Panel (docediterform.py) -->
        <div class="panel margin-top-sm" style="background: #08111e; padding: 14px; border: 1px solid var(--line);">
          <div class="form-grid compact">
            <label class="field"><span>Customer:</span><input class="input doc-inp-customer" value="${docItem.customer_id || ''}" placeholder="+ Customer"></label>
            <label class="field"><span>User / Seller:</span><input class="input doc-inp-user" value="${docItem.user_id || docItem.Seller_id || 'admin'}" placeholder="User ID"></label>
            <label class="field"><span>At Shop:</span><input class="input doc-inp-shop" value="${docItem.At_Shop_Id || 'Main Shop'}" readonly></label>
            <label class="field"><span>Extension Barcode:</span><input class="input doc-inp-ext" value="${docItem.extension_barcode || ''}"></label>
            <label class="field"><span>Received / Paid ($):</span><input class="input doc-inp-received" type="number" step="0.01" value="${docItem.pid || docItem.price || 0}"></label>
            <label class="field"><span>Expire / Due Date:</span><input class="input doc-inp-due" type="date" value="${(docItem.doc_expire_date || '').slice(0, 10)}"></label>
          </div>
          <div class="margin-top-sm" style="display: flex; gap: 16px; font-size: 12px; color: var(--muted); flex-wrap: wrap;">
            <span>Created Date: <strong style="color: #4dd0e1;">${docItem.doc_created_date || '-'}</strong></span>
            <span>Updated Date: <strong style="color: #4dd0e1;">${docItem.doc_updated_date || '-'}</strong></span>
            <span>Total QTY: <strong style="color: #ffffff;">${totalQty}</strong></span>
            <span>Total Profit: <strong style="color: #16a34a;">$${(totalPrice * 0.35).toFixed(2)}</strong></span>
            <span>Total Discount: <strong style="color: #e94560;">$${(parseFloat(docItem.discount) || 0).toFixed(2)}</strong></span>
            <span>Total Tax: <strong style="color: #e94560;">$${(parseFloat(docItem.tax) || 0).toFixed(2)}</strong></span>
          </div>
        </div>

        <!-- Center Sub-Notebook Tabs (Items & Payment - docediterform.py) -->
        <div class="editor-sub-tabs margin-top-sm">
          <button class="editor-sub-tab ${activeTab === 'items' ? 'active' : ''}" data-subtab="items">📦 Items (${items.length})</button>
          <button class="editor-sub-tab ${activeTab === 'payment' ? 'active' : ''}" data-subtab="payment">💳 Payment Tools</button>
        </div>

        <!-- TAB 1: ITEMS EDITOR PANEL -->
        <div class="editor-tab-panel ${activeTab === 'items' ? '' : 'hidden'}" id="editor-items-panel-${docKey}">
          <div class="section-toolbar margin-top-sm">
            <input class="input search-input doc-add-product-search" placeholder="Search product name, code or scan barcode to add item (press Enter)...">
          </div>
          <div class="table-scroll margin-top-sm">
            <table>
              <thead>
                <tr><th>Item Name</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th><th>Action</th></tr>
              </thead>
              <tbody>
                ${items.map((it, idx) => `
                  <tr>
                    <td><strong>${it.name || 'Cart Item'}</strong></td>
                    <td><input type="number" min="1" class="input cart-qty-inp" data-idx="${idx}" value="${it.quantity || it.qty || 1}" style="width: 70px;"></td>
                    <td>$${(Number(it.price) || 0).toFixed(2)}</td>
                    <td><strong>$${((it.quantity || it.qty || 1) * (it.price || 0)).toFixed(2)}</strong></td>
                    <td><button class="button button-danger button-small btn-remove-item" data-idx="${idx}">✕ Remove</button></td>
                  </tr>
                `).join('')}
                ${items.length === 0 ? `<tr><td colspan="5" class="empty-state">No items in document.</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        </div>

        <!-- TAB 2: PAYMENT TOOLS PANEL -->
        <div class="editor-tab-panel ${activeTab === 'payment' ? '' : 'hidden'}" id="editor-payment-panel-${docKey}">
          <div class="table-scroll margin-top-sm">
            <table>
              <thead>
                <tr><th>Payment Type</th><th>Paid Amount</th><th>Paid Date</th><th>User</th><th>Action</th></tr>
              </thead>
              <tbody>
                ${payments.map((p, pIdx) => `
                  <tr>
                    <td><span class="count-pill">${p.type || 'Cash'}</span></td>
                    <td><strong>$${(Number(p.amount) || 0).toFixed(2)}</strong></td>
                    <td>${p.date || new Date().toLocaleString()}</td>
                    <td>${docItem.user_id || 'admin'}</td>
                    <td><button class="button button-danger button-small btn-remove-payment" data-pidx="${pIdx}">✕</button></td>
                  </tr>
                `).join('')}
                ${payments.length === 0 ? `<tr><td colspan="5" class="empty-state">No recorded payments.</td></tr>` : ''}
              </tbody>
            </table>
          </div>

          <div class="payment-tools-bar margin-top-sm">
            <select class="input compact-select pay-tool-type">
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Credit">Credit</option>
              <option value="Mobile Payment">Mobile Payment</option>
            </select>
            <input class="input pay-tool-amount" type="number" step="0.01" placeholder="Amount ($)" style="width: 110px;">
            <input class="input pay-tool-date" type="datetime-local" style="width: 170px;">
            <button class="button button-primary btn-add-payment">➕ Add Payment</button>
          </div>
        </div>
      `;

      // Event Listeners for Editor Controls
      $(".btn-close-doc", editorContainer)?.addEventListener("click", () => closeTopTab(docKey));
      $(".btn-save-doc", editorContainer)?.addEventListener("click", () => saveEditedDocInstance(docKey));
      $(".btn-print-doc", editorContainer)?.addEventListener("click", () => {
        if (window.HiperPos) window.HiperPos.showReceipt(docItem);
      });

      // Product Add Search listener
      const prodSearchInp = $(".doc-add-product-search", editorContainer);
      if (prodSearchInp) {
        prodSearchInp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            const query = prodSearchInp.value.trim().toLowerCase();
            if (!query) return;
            const foundProd = (state.products || []).find(p =>
              String(p.name || "").toLowerCase().includes(query) ||
              String(p.code || "").toLowerCase() === query ||
              String(p.barcode || "").toLowerCase() === query
            );
            if (foundProd) {
              items.push({
                name: foundProd.name || "Product",
                quantity: 1,
                price: parseFloat(foundProd.price) || 0
              });
              prodSearchInp.value = "";
              renderOpenDocEditors();
              showToast(`Added ${foundProd.name} to document.`);
            } else {
              showToast("Product not found in inventory.", true);
            }
          }
        });
      }

      // Subtab switches
      $$(".editor-sub-tab", editorContainer).forEach(tabBtn => {
        tabBtn.addEventListener("click", () => {
          editorData.activeTab = tabBtn.dataset.subtab;
          renderOpenDocEditors();
        });
      });

      // Quantity change
      $$(".cart-qty-inp", editorContainer).forEach(inp => {
        inp.addEventListener("change", (e) => {
          const idx = Number(e.target.dataset.idx);
          const val = Math.max(1, Number(e.target.value) || 1);
          if (items[idx]) {
            items[idx].quantity = val;
            renderOpenDocEditors();
          }
        });
      });

      // Remove item
      $$(".btn-remove-item", editorContainer).forEach(btn => {
        btn.addEventListener("click", (e) => {
          const idx = Number(e.target.dataset.idx);
          items.splice(idx, 1);
          renderOpenDocEditors();
        });
      });

      // Remove payment
      $$(".btn-remove-payment", editorContainer).forEach(btn => {
        btn.addEventListener("click", (e) => {
          const pIdx = Number(e.target.dataset.pidx);
          payments.splice(pIdx, 1);
          renderOpenDocEditors();
        });
      });

      // Add payment
      $(".btn-add-payment", editorContainer)?.addEventListener("click", () => {
        const type = $(".pay-tool-type", editorContainer)?.value || "Cash";
        const amt = Number($(".pay-tool-amount", editorContainer)?.value) || 0;
        const dt = $(".pay-tool-date", editorContainer)?.value || new Date().toISOString();
        if (amt <= 0) {
          showToast("Enter valid payment amount.", true);
          return;
        }
        payments.push({ type, amount: amt, date: dt });
        renderOpenDocEditors();
      });
    });
  }

  async function saveEditedDocInstance(docKey) {
    const editorData = openDocEditors.get(docKey);
    if (!editorData) return;

    const { docItem, items, payments } = editorData;
    const container = $(`#doc-editor-container-${docKey}`);
    if (!container) return;

    docItem.customer_id = $(".doc-inp-customer", container)?.value.trim() || "";
    docItem.user_id = $(".doc-inp-user", container)?.value.trim() || "admin";
    docItem.extension_barcode = $(".doc-inp-ext", container)?.value.trim() || "";
    docItem.pid = Number($(".doc-inp-received", container)?.value) || docItem.price;
    docItem.doc_expire_date = $(".doc-inp-due", container)?.value || docItem.doc_expire_date;
    docItem.item = JSON.stringify(items);
    docItem.payments = JSON.stringify(payments);

    try {
      await api("save", {
        method: "POST",
        body: {
          resource: "sales",
          id: docItem.id,
          data: {
            customer_id: docItem.customer_id,
            user_id: docItem.user_id,
            extension_barcode: docItem.extension_barcode,
            price: docItem.price,
            pid: docItem.pid,
            qty: docItem.qty,
            doc_expire_date: docItem.doc_expire_date,
            item: docItem.item,
            payments: docItem.payments
          }
        }
      });
      showToast(`Document #${docKey} saved successfully!`);
    } catch {
      showToast(`Document #${docKey} saved locally.`);
    }

    renderSales();
  }

  // --- INTERACTIVE CHART RENDERER (Chart.py & get_with_date) ---
  function getWithDate(docsList) {
    const yearly = {};
    const monthly = {};
    const weekly = {};
    const daily = {};
    const hourly = {};
    const halfHour = {};

    docsList.forEach(d => {
      const rawDate = d.doc_created_date || d.created_at || new Date().toISOString();
      const dt = new Date(rawDate);
      if (isNaN(dt.getTime())) return;

      const val = parseFloat(d.price) || 0;

      // Year
      const yearKey = String(dt.getFullYear());
      yearly[yearKey] = (yearly[yearKey] || 0) + val;

      // Month (e.g. "Apr 26")
      const monthKey = dt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthly[monthKey] = (monthly[monthKey] || 0) + val;

      // Day (e.g. "22 Apr 26")
      const dayKey = dt.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "2-digit" });
      daily[dayKey] = (daily[dayKey] || 0) + val;

      // Week
      const firstJan = new Date(dt.getFullYear(), 0, 1);
      const weekNum = Math.ceil((((dt - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);
      const weekKey = `Wk ${weekNum} ${monthKey}`;
      weekly[weekKey] = (weekly[weekKey] || 0) + val;

      // Hour
      const hourStr = String(dt.getHours()).padStart(2, "0");
      const hourKey = `${dayKey} ${hourStr}:00`;
      hourly[hourKey] = (hourly[hourKey] || 0) + val;

      // 30 Min
      const minStr = dt.getMinutes() < 30 ? "00" : "30";
      const halfKey = `${dayKey} ${hourStr}:${minStr}`;
      halfHour[halfKey] = (halfHour[halfKey] || 0) + val;
    });

    return { yearly, monthly, weekly, daily, hourly, halfHour };
  }

  function renderSalesChart(docsList) {
    const chartBox = $("#doc-chart-container");
    const listbox = $("#doc-chart-listbox");
    if (!chartBox) return;
    chartBox.replaceChildren();

    const connectLine = $("#chart-chk-connect")?.checked ?? true;
    const showLine = $("#chart-chk-showline")?.checked ?? true;
    const showList = $("#chart-chk-showlist")?.checked ?? false;
    const style = $("#chart-style-select")?.value || "Bar Chart";
    const timeGroup = $("#chart-time-select")?.value || "By 30 Min";
    const labelPos = $("#chart-label-select")?.value || "Bottom";

    // Show/hide listbox
    if (listbox) {
      if (showList) listbox.classList.remove("hidden");
      else listbox.classList.add("hidden");
    }

    if (!docsList || docsList.length === 0) {
      chartBox.innerHTML = `<p class="empty-state">No sales data available for chart rendering.</p>`;
      if (listbox) listbox.replaceChildren();
      return;
    }

    const { yearly, monthly, weekly, daily, hourly, halfHour } = getWithDate(docsList);
    let targetMap = halfHour; // Default to By 30 Min
    if (timeGroup === "By hour") targetMap = hourly;
    else if (timeGroup === "By daily") targetMap = daily;
    else if (timeGroup === "By weekly") targetMap = weekly;
    else if (timeGroup === "By monthly") targetMap = monthly;
    else if (timeGroup === "By year") targetMap = yearly;

    const entries = Object.entries(targetMap).slice(-15);
    if (entries.length === 0) {
      chartBox.innerHTML = `<p class="empty-state">No entries in selected date range.</p>`;
      return;
    }

    // Populate Listbox
    if (listbox && showList) {
      listbox.replaceChildren();
      entries.forEach(([lbl, val]) => {
        const item = document.createElement("div");
        item.className = "chart-listbox-item";
        item.innerHTML = `<span>${lbl}</span><strong>$${val.toFixed(2)}</strong>`;
        listbox.append(item);
      });
    }

    const maxVal = Math.max(...entries.map(e => e[1]), 10);
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 650 240");
    svg.style.overflow = "visible";

    const chartHeight = 180;
    const chartWidth = 580;
    const xStart = 50;
    const yBaseline = 200;

    // Y Axis Lines & Scale Numbers if Show Line is on
    if (showLine && style !== "Pie Chart") {
      for (let i = 0; i <= 4; i++) {
        const yPos = yBaseline - (chartHeight / 4) * i;
        const valTick = (maxVal / 4) * i;

        const gridLine = document.createElementNS(svgNs, "line");
        gridLine.setAttribute("x1", String(xStart));
        gridLine.setAttribute("y1", String(yPos));
        gridLine.setAttribute("x2", String(xStart + chartWidth));
        gridLine.setAttribute("y2", String(yPos));
        gridLine.setAttribute("stroke", "rgba(255, 255, 255, 0.08)");
        gridLine.setAttribute("stroke-dasharray", "3,3");

        const tickText = document.createElementNS(svgNs, "text");
        tickText.setAttribute("x", String(xStart - 8));
        tickText.setAttribute("y", String(yPos + 4));
        tickText.setAttribute("fill", "#8a9ba8");
        tickText.setAttribute("font-size", "10");
        tickText.setAttribute("text-anchor", "end");
        tickText.textContent = "$" + valTick.toFixed(0);

        svg.append(gridLine, tickText);
      }

      // X/Y Axis baseline lines
      const xAxis = document.createElementNS(svgNs, "line");
      xAxis.setAttribute("x1", String(xStart));
      xAxis.setAttribute("y1", String(yBaseline));
      xAxis.setAttribute("x2", String(xStart + chartWidth));
      xAxis.setAttribute("y2", String(yBaseline));
      xAxis.setAttribute("stroke", "#1976d2");
      xAxis.setAttribute("stroke-width", "2");

      const yAxis = document.createElementNS(svgNs, "line");
      yAxis.setAttribute("x1", String(xStart));
      yAxis.setAttribute("y1", String(yBaseline));
      yAxis.setAttribute("x2", String(xStart));
      yAxis.setAttribute("y2", String(yBaseline - chartHeight));
      yAxis.setAttribute("stroke", "#1976d2");
      yAxis.setAttribute("stroke-width", "2");

      svg.append(xAxis, yAxis);
    }

    const points = [];
    const colors = ["#1976d2", "#1565c0", "#0288d1", "#0097a7", "#4dd0e1", "#00bcd4", "#0d47a1"];

    if (style === "Bar Chart") {
      const barGap = 12;
      const barWidth = Math.max(10, Math.floor((chartWidth - barGap * entries.length) / entries.length));

      entries.forEach(([k, rev], idx) => {
        const barH = Math.floor((rev / maxVal) * chartHeight);
        const x = xStart + idx * (barWidth + barGap);
        const y = yBaseline - barH;
        const color = colors[idx % colors.length];

        points.push({ x: x + barWidth / 2, y });

        const rect = document.createElementNS(svgNs, "rect");
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", String(barWidth));
        rect.setAttribute("height", String(barH));
        rect.setAttribute("fill", color);
        rect.setAttribute("rx", "4");

        // X Label
        const xText = document.createElementNS(svgNs, "text");
        xText.setAttribute("x", String(x + barWidth / 2));
        xText.setAttribute("y", String(yBaseline + 16));
        xText.setAttribute("fill", "#8a9ba8");
        xText.setAttribute("font-size", "10");
        xText.setAttribute("text-anchor", "middle");
        xText.textContent = k.slice(-6);

        // Value Label based on Label Position setting
        let valY = y - 6;
        if (labelPos === "In Middle") valY = y + barH / 2;
        else if (labelPos === "Top Of The Ege") valY = Math.max(y - 12, 12);
        else if (labelPos === "Oposite") valY = yBaseline + 28;

        const valText = document.createElementNS(svgNs, "text");
        valText.setAttribute("x", String(x + barWidth / 2));
        valText.setAttribute("y", String(valY));
        valText.setAttribute("fill", "#4dd0e1");
        valText.setAttribute("font-size", "10");
        valText.setAttribute("font-weight", "bold");
        valText.setAttribute("text-anchor", "middle");
        valText.textContent = "$" + rev.toFixed(0);

        svg.append(rect, xText, valText);
      });
    } else if (style === "Scatter Plot Chart" || style === "Line Chart") {
      const xGap = chartWidth / (entries.length || 1);

      entries.forEach(([k, rev], idx) => {
        const ptH = Math.floor((rev / maxVal) * chartHeight);
        const x = xStart + idx * xGap + xGap / 2;
        const y = yBaseline - ptH;
        const color = colors[idx % colors.length];

        points.push({ x, y });

        const circle = document.createElementNS(svgNs, "circle");
        circle.setAttribute("cx", String(x));
        circle.setAttribute("cy", String(y));
        circle.setAttribute("r", "6");
        circle.setAttribute("fill", color);

        const xText = document.createElementNS(svgNs, "text");
        xText.setAttribute("x", String(x));
        xText.setAttribute("y", String(yBaseline + 16));
        xText.setAttribute("fill", "#8a9ba8");
        xText.setAttribute("font-size", "10");
        xText.setAttribute("text-anchor", "middle");
        xText.textContent = k.slice(-6);

        const valText = document.createElementNS(svgNs, "text");
        valText.setAttribute("x", String(x));
        valText.setAttribute("y", String(y - 10));
        valText.setAttribute("fill", "#4dd0e1");
        valText.setAttribute("font-size", "10");
        valText.setAttribute("font-weight", "bold");
        valText.setAttribute("text-anchor", "middle");
        valText.textContent = "$" + rev.toFixed(0);

        svg.append(circle, xText, valText);
      });
    } else if (style === "Pie Chart") {
      const cx = 320;
      const cy = 110;
      const radius = 80;
      const totalSum = entries.reduce((s, e) => s + e[1], 0) || 1;
      let startAngle = 0;

      entries.forEach(([k, rev], idx) => {
        const sliceAngle = (rev / totalSum) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy + radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(endAngle);
        const y2 = cy + radius * Math.sin(endAngle);

        const largeArc = sliceAngle > Math.PI ? 1 : 0;
        const dPath = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

        const path = document.createElementNS(svgNs, "path");
        path.setAttribute("d", dPath);
        path.setAttribute("fill", colors[idx % colors.length]);

        // Slice Label
        const midAngle = startAngle + sliceAngle / 2;
        const lx = cx + (radius + 20) * Math.cos(midAngle);
        const ly = cy + (radius + 20) * Math.sin(midAngle);

        const lblText = document.createElementNS(svgNs, "text");
        lblText.setAttribute("x", String(lx));
        lblText.setAttribute("y", String(ly));
        lblText.setAttribute("fill", "#eaeaea");
        lblText.setAttribute("font-size", "10");
        lblText.setAttribute("text-anchor", lx > cx ? "start" : "end");
        lblText.textContent = `${k}: $${rev.toFixed(0)}`;

        svg.append(path, lblText);
        startAngle = endAngle;
      });
    }

    // Draw connecting line if enabled (for Bar / Scatter / Line)
    if (connectLine && points.length > 1 && style !== "Pie Chart") {
      const polyPoints = points.map(p => `${p.x},${p.y}`).join(" ");
      const polyline = document.createElementNS(svgNs, "polyline");
      polyline.setAttribute("points", polyPoints);
      polyline.setAttribute("fill", "none");
      polyline.setAttribute("stroke", "#4dd0e1");
      polyline.setAttribute("stroke-width", "2.5");
      svg.prepend(polyline);
    }

    chartBox.append(svg);
  }

  // --- REPORT FINANCIAL METRICS (Doc.py home_tab) ---
  function calculateFinancialMetrics(docsList) {
    let cashPaid = 0;
    let cardPaid = 0;
    let cardIn = 0;
    let totalPaid = 0;
    let cashOuts = 0;
    let cardOuts = 0;
    let totalProfit = 0;
    let unpaid = 0;
    let totalGross = 0;

    docsList.forEach(doc => {
      const price = parseFloat(doc.price) || 0;
      const pid = parseFloat(doc.pid) || price;
      const profit = parseFloat(doc.Profite) || (price * 0.35);
      const payType = String(doc.payments || "Cash").toLowerCase();

      totalGross += price;
      totalPaid += pid;
      totalProfit += profit;

      if (payType.includes("card")) {
        cardPaid += pid;
      } else {
        cashPaid += pid;
      }

      if (pid < price) {
        unpaid += (price - pid);
      }
    });

    // Expenses calculated from active shops
    let expenses = 0;
    (state.shops || []).forEach(sh => {
      try {
        const exList = typeof sh.Shop_Expenses === "string" ? JSON.parse(sh.Shop_Expenses) : (sh.Shop_Expenses || []);
        exList.forEach(ex => {
          expenses += (parseFloat(ex[2] || ex.amount) || 0);
        });
      } catch {
        // Skip
      }
    });

    const totalOut = cashOuts + cardOuts + expenses;
    const cashStock = Math.max(0, cashPaid - cashOuts - expenses);
    const cardStock = Math.max(0, cardPaid - cardOuts);
    const creditStock = unpaid;
    const totalStock = cashStock + cardStock + creditStock;
    const profitAfterOuts = totalProfit - totalOut;
    const paidAfterOuts = totalPaid - totalOut;

    // Update DOM Metrics (Doc.py)
    if ($("#rep-cash")) $("#rep-cash").textContent = "$" + cashPaid.toFixed(2);
    if ($("#rep-card")) $("#rep-card").textContent = "$" + cardPaid.toFixed(2);
    if ($("#rep-card-in")) $("#rep-card-in").textContent = "$" + cardIn.toFixed(2);
    if ($("#rep-paid")) $("#rep-paid").textContent = "$" + totalPaid.toFixed(2);
    if ($("#rep-cash-outs")) $("#rep-cash-outs").textContent = "$" + cashOuts.toFixed(2);
    if ($("#rep-card-outs")) $("#rep-card-outs").textContent = "$" + cardOuts.toFixed(2);
    if ($("#rep-expenses")) $("#rep-expenses").textContent = "$" + expenses.toFixed(2);
    if ($("#rep-total-out")) $("#rep-total-out").textContent = "$" + totalOut.toFixed(2);
    if ($("#rep-cash-stock")) $("#rep-cash-stock").textContent = "$" + cashStock.toFixed(2);
    if ($("#rep-card-stock")) $("#rep-card-stock").textContent = "$" + cardStock.toFixed(2);
    if ($("#rep-credit-stock")) $("#rep-credit-stock").textContent = "$" + creditStock.toFixed(2);
    if ($("#rep-total-stock")) $("#rep-total-stock").textContent = "$" + totalStock.toFixed(2);
    if ($("#rep-profit")) $("#rep-profit").textContent = "$" + totalProfit.toFixed(2);
    if ($("#rep-profit-after-outs")) $("#rep-profit-after-outs").textContent = "$" + profitAfterOuts.toFixed(2);
    if ($("#rep-paid-after-outs")) $("#rep-paid-after-outs").textContent = "$" + paidAfterOuts.toFixed(2);
    if ($("#rep-unpaid")) $("#rep-unpaid").textContent = "$" + unpaid.toFixed(2);
    if ($("#rep-total")) $("#rep-total").textContent = "$" + totalGross.toFixed(2);
    if ($("#rep-gtotal")) $("#rep-gtotal").textContent = "$" + totalGross.toFixed(2);
  }

  async function performDocSearch() {
    initDocDates();
    try {
      const res = await api("list", { query: { resource: "sales" } });
      if (res && res.items) {
        state.sales = res.items;
      }
    } catch {
      // Keep existing sales
    }

    const userIdVal = $("#filter-user-id")?.value.trim() || "";
    const targetSeller = userIdVal || "";
    if (!state.searchedTabs.includes(targetSeller)) {
      state.searchedTabs.push(targetSeller);
    }
    state.activeSellerTab = targetSeller;
    renderNotebookTabs();
    renderSales();
  }

  function renderNotebookTabs() {
    initDocDates();
    populateUserDropdown();

    const container = $("#seller-notebook-tabs");
    if (!container) return;
    container.replaceChildren();

    if (!state.searchedTabs || state.searchedTabs.length === 0) {
      state.searchedTabs = [""];
    }

    state.searchedTabs.forEach(tabName => {
      const btn = document.createElement("button");
      btn.className = `notebook-tab ${state.activeSellerTab === tabName ? "active" : ""}`;
      const isAll = (tabName === "" || tabName === "ALL Users");
      const label = isAll ? "ALL Users" : tabName;
      btn.innerHTML = `${isAll ? "👥" : "👤"} ${label}`;
      btn.addEventListener("click", () => {
        state.activeSellerTab = tabName;
        if ($("#filter-user-id")) $("#filter-user-id").value = tabName;
        renderNotebookTabs();
        renderSales();
      });

      if (!isAll) {
        const close = document.createElement("span");
        close.className = "notebook-tab-close";
        close.textContent = "✕";
        close.addEventListener("click", (e) => {
          e.stopPropagation();
          state.searchedTabs = state.searchedTabs.filter(t => t !== tabName);
          if (state.activeSellerTab === tabName) state.activeSellerTab = "";
          renderNotebookTabs();
          renderSales();
        });
        btn.append(close);
      }
      container.append(btn);
    });

    const activeTabLabel = (state.activeSellerTab === "" || state.activeSellerTab === "ALL Users") ? "ALL Users" : state.activeSellerTab;
    if ($("#tab-doc-list")) $("#tab-doc-list").textContent = `📄 List Docs (${activeTabLabel})`;
    if ($("#tab-doc-report")) $("#tab-doc-report").textContent = `📊 Report (${activeTabLabel})`;
  }

  function renderSales() {
    initDocDates();

    const body = $("#sales-body");
    if (!body) return;
    body.replaceChildren();

    const docId = $("#filter-doc-id")?.value.trim().toLowerCase() || "";
    const docType = $("#filter-doc-type")?.value.trim().toLowerCase() || "";
    const docBarcode = $("#filter-doc-barcode")?.value.trim().toLowerCase() || "";
    const extBarcode = $("#filter-ext-barcode")?.value.trim().toLowerCase() || "";
    const itemQuery = $("#filter-item")?.value.trim().toLowerCase() || "";
    const soldItemQuery = $("#filter-sold-item")?.value.trim().toLowerCase() || "";
    const discountQuery = $("#filter-discount")?.value.trim().toLowerCase() || "";
    const filterUserId = $("#filter-user-id")?.value.trim().toLowerCase() || "";
    const filterAtShop = $("#filter-at-shop")?.value.trim().toLowerCase() || "";
    const customerId = $("#filter-customer-id")?.value.trim().toLowerCase() || "";
    const sellerId = $("#filter-seller-id")?.value.trim().toLowerCase() || "";
    const dateFrom = $("#filter-date-from")?.value.trim() || "";
    const dateTo = $("#filter-date-to")?.value.trim() || "";

    const chkCreated = $("#chk-created-date")?.checked ?? false;
    const chkExpire = $("#chk-expire-date")?.checked ?? false;
    const chkUpdated = $("#chk-updated-date")?.checked ?? false;

    const docs = (state.sales || []).filter(item => {
      const activeSeller = (state.activeSellerTab !== "" && state.activeSellerTab !== "ALL Users")
        ? state.activeSellerTab.toLowerCase()
        : filterUserId;
      const itemUser = String(item.user_id || "").toLowerCase();
      const itemSeller = String(item.Seller_id || "").toLowerCase();

      const matchesSeller = !activeSeller || itemUser.includes(activeSeller) || itemSeller.includes(activeSeller);
      const matchesId = !docId || String(item.id || "").toLowerCase().includes(docId);
      const matchesType = !docType || String(item.type || "").toLowerCase().includes(docType);
      const matchesBarcode = !docBarcode || String(item.doc_barcode || "").toLowerCase().includes(docBarcode);
      const matchesExtBarcode = !extBarcode || String(item.extension_barcode || "").toLowerCase().includes(extBarcode);
      const matchesItem = !itemQuery || String(item.item || "").toLowerCase().includes(itemQuery);
      const matchesSoldItem = !soldItemQuery || String(item.sold_item_info || item.item || "").toLowerCase().includes(soldItemQuery);
      const matchesDiscount = !discountQuery || String(item.discount || "").includes(discountQuery);
      const matchesShop = !filterAtShop || filterAtShop === "all shops" || String(item.At_Shop_Id || "").toLowerCase().includes(filterAtShop);
      const matchesCustomer = !customerId || String(item.customer_id || "").toLowerCase().includes(customerId);
      const matchesSellerId = !sellerId || String(item.Seller_id || "").toLowerCase().includes(sellerId);

      let matchesDate = true;
      if ((dateFrom || dateTo) && (chkCreated || chkExpire || chkUpdated)) {
        const parseDateOnly = (d) => d ? String(d).split(" ")[0].slice(0, 10) : "";
        const cDate = parseDateOnly(item.doc_created_date);
        const eDate = parseDateOnly(item.doc_expire_date);
        const uDate = parseDateOnly(item.doc_updated_date);

        const inRange = (dStr) => {
          if (!dStr) return false;
          if (dateFrom && dStr < dateFrom) return false;
          if (dateTo && dStr > dateTo) return false;
          return true;
        };

        let dateMatched = false;
        if (chkCreated && inRange(cDate)) dateMatched = true;
        if (chkExpire && inRange(eDate)) dateMatched = true;
        if (chkUpdated && inRange(uDate)) dateMatched = true;

        matchesDate = dateMatched;
      }

      return matchesSeller && matchesId && matchesType && matchesBarcode &&
             matchesExtBarcode && matchesItem && matchesSoldItem && matchesDiscount &&
             matchesShop && matchesCustomer && matchesSellerId && matchesDate;
    });

    renderSalesChart(docs);
    calculateFinancialMetrics(docs);

    for (const item of docs) {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${item.id}</td>
        <td><span class="cell-title">${item.doc_barcode || "DOC"}</span><span class="cell-subtitle">${item.type || "Sale"}</span></td>
        <td>${item.extension_barcode || "-"}</td>
        <td>${item.user_id || "admin"}</td>
        <td>${item.customer_id || "-"}</td>
        <td>${item.type || "Sale"}</td>
        <td>${item.item ? "Cart Items" : "Items"}</td>
        <td>${item.qty || 1}</td>
        <td>$${(Number(item.price) || 0).toFixed(2)}</td>
        <td>$${(Number(item.discount) || 0).toFixed(2)}</td>
        <td>$${(Number(item.tax) || 0).toFixed(2)}</td>
        <td>${item.payments || "Cash"}</td>
        <td>${item.doc_created_date || "-"}</td>
        <td>${item.doc_expire_date || "-"}</td>
      `;

      row.addEventListener("click", () => {
        $$("#sales-body tr").forEach(r => r.style.background = "");
        row.style.background = "rgba(21, 101, 192, 0.35)";
        state.selectedDocInTable = item;
      });

      // DOUBLE CLICK opens document in a NEW TOP TAB next to Documents (Doc.py)
      row.addEventListener("dblclick", () => {
        openDocumentInTopTab(item);
      });

      body.append(row);
    }

    const totalDocCount = docs.length;
    const totalItemCount = docs.reduce((sum, d) => sum + (parseFloat(d.qty) || 1), 0);
    const totalGrandTotal = docs.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0);

    const summaryHeader = $("#doc-summary-header");
    if (summaryHeader) {
      summaryHeader.textContent = `TOTAL DOC : ${totalDocCount} ITEMS : ${totalItemCount} COUNTED Grand Total : $${totalGrandTotal.toFixed(2)}`;
    }

    if (!docs.length) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `<td colspan="14" class="empty-state">No documents found matching search criteria.</td>`;
      body.append(emptyRow);
    }
  }

  function bindDocEvents() {
    initDocDates();

    // Top Main Documents Tab Switcher
    $("#main-doc-tab-btn")?.addEventListener("click", () => {
      switchTopTab("main-docs");
    });

    const filterSelectors = [
      "#filter-doc-id", "#filter-doc-type", "#filter-doc-barcode",
      "#filter-ext-barcode", "#filter-item", "#filter-sold-item",
      "#filter-discount", "#filter-customer-id", "#filter-seller-id",
      "#filter-date-from", "#filter-date-to"
    ];

    filterSelectors.forEach(sel => {
      $(sel)?.addEventListener("input", renderSales);
      $(sel)?.addEventListener("change", renderSales);
    });

    $("#filter-at-shop")?.addEventListener("change", renderSales);
    $("#chk-created-date")?.addEventListener("change", renderSales);
    $("#chk-expire-date")?.addEventListener("change", renderSales);
    $("#chk-updated-date")?.addEventListener("change", renderSales);

    // Chart Control Events (Chart.py)
    ["#chart-chk-connect", "#chart-chk-showline", "#chart-chk-showlist",
     "#chart-style-select", "#chart-time-select", "#chart-label-select"].forEach(id => {
      $(id)?.addEventListener("change", () => renderSales());
    });

    $("#filter-user-id")?.addEventListener("change", (e) => {
      const selected = e.target.value || "";
      if (!state.searchedTabs.includes(selected)) {
        state.searchedTabs.push(selected);
      }
      state.activeSellerTab = selected;
      renderNotebookTabs();
      renderSales();
    });

    $("#btn-doc-search")?.addEventListener("click", performDocSearch);

    // Click "Veiw" button opens document in NEW TOP TAB next to Documents
    $("#btn-doc-view")?.addEventListener("click", () => {
      if (state.selectedDocInTable) {
        openDocumentInTopTab(state.selectedDocInTable);
      } else {
        if (window.HiperApi) window.HiperApi.showToast("Select a document row from the table first.", true);
      }
    });

    $("#btn-end-day")?.addEventListener("click", openEndDayDialog);
    $("#pos-endday-btn")?.addEventListener("click", openEndDayDialog);

    $("#btn-doc-delete")?.addEventListener("click", () => {
      if (state.selectedDocInTable) {
        state.sales = (state.sales || []).filter(s => s.id !== state.selectedDocInTable.id);
        state.selectedDocInTable = null;
        renderSales();
        if (window.HiperApi) window.HiperApi.showToast("Document deleted.");
      } else {
        if (window.HiperApi) window.HiperApi.showToast("Select a document row to delete.", true);
      }
    });

    $("#btn-doc-undo")?.addEventListener("click", () => {
      if (window.HiperApp) window.HiperApp.refreshWorkspace();
    });

    $("#btn-doc-getdate")?.addEventListener("click", () => {
      const today = new Date().toISOString().split("T")[0];
      if ($("#filter-date-from")) $("#filter-date-from").value = today;
      if ($("#filter-date-to")) $("#filter-date-to").value = today;
      if ($("#chk-created-date")) $("#chk-created-date").checked = true;
      renderSales();
    });

    $("#tab-doc-list")?.addEventListener("click", () => {
      $("#tab-doc-list")?.classList.add("active");
      $("#tab-doc-report")?.classList.remove("active");
      $("#doc-list-view")?.classList.remove("hidden");
      $("#doc-report-view")?.classList.add("hidden");
    });

    $("#tab-doc-report")?.addEventListener("click", () => {
      $("#tab-doc-report")?.classList.add("active");
      $("#tab-doc-list")?.classList.remove("active");
      $("#doc-report-view")?.classList.remove("hidden");
      $("#doc-list-view")?.classList.add("hidden");
    });
  }

  function openEndDayDialog() {
    const dialog = $("#end-day-dialog");
    if (!dialog) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const docs = state.sales || [];

    const todayDocs = docs.filter(d => {
      const cDate = String(d.doc_created_date || "").split(" ")[0];
      return !cDate || cDate === todayStr;
    });

    const totalSalesToday = todayDocs.reduce((s, d) => s + (parseFloat(d.price) || 0), 0);
    const transCount = todayDocs.length;
    const totalProducts = (state.products || []).length;
    const lowStockCount = (state.products || []).filter(p => (parseFloat(p.quantity) || 0) <= 5).length;
    const activeShopsCount = (state.shops || []).length || 1;

    // Update Metric Cards in End Day Frame (Moved from Home)
    if ($("#endday-metric-sales")) $("#endday-metric-sales").textContent = "$" + totalSalesToday.toFixed(2);
    if ($("#endday-metric-count")) $("#endday-metric-count").textContent = `${transCount} transactions`;
    if ($("#endday-metric-products")) $("#endday-metric-products").textContent = String(totalProducts);
    if ($("#endday-metric-stock")) $("#endday-metric-stock").textContent = String(lowStockCount);
    if ($("#endday-metric-shops")) $("#endday-metric-shops").textContent = String(activeShopsCount);

    // Calculate Expenses & Payouts (Doc.py)
    let totalExpenses = 0;
    (state.shops || []).forEach(sh => {
      try {
        const exList = typeof sh.Shop_Expenses === "string" ? JSON.parse(sh.Shop_Expenses) : (sh.Shop_Expenses || []);
        exList.forEach(ex => totalExpenses += (parseFloat(ex[2] || ex.amount) || 0));
      } catch {}
    });

    let cashReceived = 0;
    let cardReceived = 0;
    let grossProfit = 0;

    todayDocs.forEach(d => {
      const price = parseFloat(d.price) || 0;
      const pid = parseFloat(d.pid) || price;
      const profit = parseFloat(d.Profite) || (price * 0.35);
      const payType = String(d.payments || "Cash").toLowerCase();

      grossProfit += profit;
      if (payType.includes("card")) cardReceived += pid;
      else cashReceived += pid;
    });

    const totalReceived = cashReceived + cardReceived;
    const cashOuts = 0;
    const totalDeductions = totalExpenses + cashOuts;
    const profitAfterExpenses = grossProfit - totalDeductions;
    const totalAfterExpenses = totalReceived - totalDeductions;

    // Update Doc.py Financial Summary Labels
    if ($("#endday-date-label")) $("#endday-date-label").textContent = `DATE : ${todayStr}`;
    if ($("#endday-val-expenses")) $("#endday-val-expenses").textContent = `-$${totalExpenses.toFixed(2)}`;
    if ($("#endday-val-cashouts")) $("#endday-val-cashouts").textContent = `-$${cashOuts.toFixed(2)}`;
    if ($("#endday-val-cash")) $("#endday-val-cash").textContent = `$${cashReceived.toFixed(2)}`;
    if ($("#endday-val-card")) $("#endday-val-card").textContent = `$${cardReceived.toFixed(2)}`;
    if ($("#endday-val-received")) $("#endday-val-received").textContent = `$${totalReceived.toFixed(2)}`;
    if ($("#endday-val-profit")) $("#endday-val-profit").textContent = `$${grossProfit.toFixed(2)}`;
    if ($("#endday-val-profit-after")) $("#endday-val-profit-after").textContent = `$${profitAfterExpenses.toFixed(2)}`;
    if ($("#endday-val-total-after")) $("#endday-val-total-after").textContent = `$${totalAfterExpenses.toFixed(2)}`;

    // Populate Tab 2 Documents List (Doc.py)
    const docsBody = $("#endday-docs-body");
    if (docsBody) {
      docsBody.replaceChildren();
      todayDocs.forEach((doc, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td><strong>${doc.doc_barcode || doc.id}</strong></td>
          <td>${doc.At_Shop_Id || "Main Shop"}</td>
          <td>${doc.customer_id || "-"}</td>
          <td>${doc.user_id || "admin"}</td>
          <td>$${(parseFloat(doc.price) || 0).toFixed(2)}</td>
          <td>${doc.doc_created_date || todayStr}</td>
        `;
        docsBody.append(tr);
      });
      if (todayDocs.length === 0) {
        docsBody.innerHTML = `<tr><td colspan="7" class="empty-state">No documents for today.</td></tr>`;
      }
    }

    // Bind Tab Switches inside End Day Dialog
    $("#endday-tab-total")?.onclick = () => {
      $("#endday-tab-total")?.classList.add("active");
      $("#endday-tab-docs")?.classList.remove("active");
      $("#endday-view-total")?.classList.remove("hidden");
      $("#endday-view-docs")?.classList.add("hidden");
    };

    $("#endday-tab-docs")?.onclick = () => {
      $("#endday-tab-docs")?.classList.add("active");
      $("#endday-tab-total")?.classList.remove("active");
      $("#endday-view-docs")?.classList.remove("hidden");
      $("#endday-view-total")?.classList.add("hidden");
    };

    $("#close-endday-dialog")?.onclick = () => {
      dialog.close();
    };

    $("#btn-endday-refresh")?.onclick = () => {
      openEndDayDialog();
      showToast("End Day summary refreshed.");
    };

    $("#btn-endday-print")?.onclick = () => {
      const printStr = [
        "END DAY SUMMARY REPORT",
        `Date: ${todayStr}`,
        "----------------------------------------",
        `Sales Today: $${totalSalesToday.toFixed(2)} (${transCount} transactions)`,
        `Cash Received: $${cashReceived.toFixed(2)}`,
        `Card Received: $${cardReceived.toFixed(2)}`,
        `Total Received: $${totalReceived.toFixed(2)}`,
        `Expenses: -$${totalExpenses.toFixed(2)}`,
        `Gross Profit: $${grossProfit.toFixed(2)}`,
        `Profit After Exp: $${profitAfterExpenses.toFixed(2)}`,
        `Total After Exp: $${totalAfterExpenses.toFixed(2)}`,
        "----------------------------------------",
        "Printed from Hiper Market Web"
      ].join("\n");

      if ($("#receipt-title")) $("#receipt-title").textContent = "End Day Report";
      if ($("#receipt-content")) $("#receipt-content").textContent = printStr;
      const receiptDialog = $("#sale-detail-dialog");
      if (receiptDialog) receiptDialog.showModal();
    };

    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    }
  }

  return {
    populateUserDropdown,
    performDocSearch,
    renderNotebookTabs,
    renderSales,
    openDocumentInTopTab,
    closeTopTab,
    switchTopTab,
    openEndDayDialog,
    bindDocEvents
  };
})();
    renderNotebookTabs,
    renderSales,
    openDocumentInTopTab,
    closeTopTab,
    switchTopTab,
    bindDocEvents
  };
})();
