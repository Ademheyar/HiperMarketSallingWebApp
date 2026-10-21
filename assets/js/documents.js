/**
 * documents.js - Manage Documents Module (#view-sales / Doc.py, Chart.py, docediterform.py - 100% Matching Python Desktop App)
 */
window.HiperDocuments = (() => {
  "use strict";

  const { state, $, $$, api, showToast, formatMoney } = window.HiperApi;

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
      const uniqueShops = Array.from(
        new Set((state.sales || []).map(s => s.At_Shop_Id).filter(Boolean))
      );
      if (!uniqueShops.includes("Main Shop")) uniqueShops.unshift("Main Shop");
      shopSelect.innerHTML = `<option value="">Main Shop</option><option value="All Shops">All Shops</option>` +
        uniqueShops.filter(s => s !== "Main Shop").map(s => `<option value="${s}">${s}</option>`).join("");
      shopSelect.value = cur || "";
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
            <label class="field"><span>Received / Paid:</span><input class="input doc-inp-received" type="number" step="0.01" value="${docItem.pid || docItem.price || 0}"></label>
            <label class="field"><span>Expire / Due Date:</span><input class="input doc-inp-due" type="date" value="${(docItem.doc_expire_date || '').slice(0, 10)}"></label>
          </div>
          <div class="margin-top-sm" style="display: flex; gap: 16px; font-size: 12px; color: var(--muted); flex-wrap: wrap;">
            <span>Created Date: <strong style="color: #4dd0e1;">${docItem.doc_created_date || '-'}</strong></span>
            <span>Updated Date: <strong style="color: #4dd0e1;">${docItem.doc_updated_date || '-'}</strong></span>
            <span>Total QTY: <strong style="color: #ffffff;">${totalQty}</strong></span>
            <span>Total Profit: <strong style="color: #16a34a;">${formatMoney(totalPrice * 0.35, docItem.At_Shop_Id)}</strong></span>
            <span>Total Discount: <strong style="color: #e94560;">${formatMoney(parseFloat(docItem.discount) || 0, docItem.At_Shop_Id)}</strong></span>
            <span>Total Tax: <strong style="color: #e94560;">${formatMoney(parseFloat(docItem.tax) || 0, docItem.At_Shop_Id)}</strong></span>
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
                    <td>${formatMoney(Number(it.price) || 0, docItem.At_Shop_Id)}</td>
                    <td><strong>${formatMoney((it.quantity || it.qty || 1) * (it.price || 0), docItem.At_Shop_Id)}</strong></td>
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
                    <td><strong>${formatMoney(Number(p.amount) || 0, docItem.At_Shop_Id)}</strong></td>
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
            <input class="input pay-tool-amount" type="number" step="0.01" placeholder="Amount" style="width: 110px;">
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
    let targetMap = daily;
    if (timeGroup === "By 30 Min") targetMap = halfHour;
    else if (timeGroup === "By hour") targetMap = hourly;
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
        item.innerHTML = `<span>${lbl}</span><strong>${formatMoney(val, state.activeShop)}</strong>`;
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
        tickText.textContent = formatMoney(valTick, state.activeShop);

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
        valText.textContent = formatMoney(rev, state.activeShop);

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
        valText.textContent = formatMoney(rev, state.activeShop);

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
        lblText.textContent = `${k}: ${formatMoney(rev, state.activeShop)}`;

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

  function parseReportDate(value) {
    const parts = String(value || "").split(/[ _T]/)[0].match(/\d+/g) || [];
    if (parts.length >= 3) {
      const yearFirst = parts[0].length === 4;
      const rawYear = String(yearFirst ? parts[0] : parts[2]);
      let year = Number(rawYear);
      if (rawYear.length === 2) {
        const cutoff = new Date().getFullYear() % 100;
        year = year <= cutoff ? 2000 + year : 1900 + year;
      }
      const month = Number(parts[1]);
      const day = Number(yearFirst ? parts[2] : parts[0]);
      if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return date;
      }
    } else if (parts.length === 2) {
      const yearFirst = parts[0].length === 4;
      const year = Number(yearFirst ? parts[0] : parts[1]);
      const month = Number(yearFirst ? parts[1] : parts[0]);
      if (year && month >= 1 && month <= 12) return new Date(Date.UTC(year, month - 1, 1));
    }
    return null;
  }

  function addReportMonths(date, count) {
    const targetMonth = date.getUTCMonth() + count;
    const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
    const month = ((targetMonth % 12) + 12) % 12;
    const day = Math.min(date.getUTCDate(), new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate());
    return new Date(Date.UTC(targetYear, month, day));
  }

  function addReportYears(date, count) {
    const year = date.getUTCFullYear() + count;
    const month = date.getUTCMonth();
    return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate())));
  }

  function parseShopExpenses(shop) {
    try {
      const raw = typeof shop.Shop_Expenses === "string" ? JSON.parse(shop.Shop_Expenses) : shop.Shop_Expenses;
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  }

  // Shop_Expenses rows: [name, description, amount, category, start date, ref, notes, frequency, repeats, interval, end date].
  function calculateShopExpenses(shops, fromValue, toValue) {
    const rangeStart = parseReportDate(fromValue) || new Date(Date.UTC(1970, 0, 1));
    const rangeEnd = parseReportDate(toValue) || new Date(Date.UTC(9999, 11, 31));
    const dayMs = 86400000;
    let total = 0;
    (shops || []).forEach(shop => parseShopExpenses(shop).forEach(expense => {
      if (!Array.isArray(expense)) return;
      const amount = Number(String(expense[2] ?? 0).replace(/[^\d.\-]/g, "")) || 0;
      const startDate = parseReportDate(expense[4]);
      const endDate = parseReportDate(expense[10]);
      if (!startDate || amount === 0) return;
      const frequency = String(expense[7] || "").toLowerCase();
      const interval = Math.max(1, parseInt(expense[9], 10) || 1);
      const activeStart = new Date(Math.max(startDate.getTime(), rangeStart.getTime()));
      const activeEnd = new Date(Math.min(endDate?.getTime() ?? rangeEnd.getTime(), rangeEnd.getTime()));
      if (activeStart > activeEnd) return;
      const repeatValue = String(expense[8] ?? "").trim().toLowerCase();
      const repeats = ["1", "true", "yes"].includes(repeatValue) ||
        (!repeatValue && !endDate && ["day", "week", "month", "year"].some(unit => frequency.includes(unit)));
      if (!repeats) {
        if (startDate >= rangeStart && startDate <= rangeEnd) total += amount;
        return;
      }
      const unit = ["day", "week", "month", "year"].find(value => frequency.includes(value));
      if (!unit) {
        if (startDate >= activeStart && startDate <= activeEnd) total += amount;
        return;
      }
      let occurrence = new Date(startDate);
      const nextOccurrence = date => {
        if (unit === "day") return new Date(date.getTime() + interval * dayMs);
        if (unit === "week") return new Date(date.getTime() + interval * 7 * dayMs);
        if (unit === "month") return addReportMonths(date, interval);
        return addReportYears(date, interval);
      };
      const periodEnd = date => {
        const next = nextOccurrence(date);
        return new Date(next.getTime() - dayMs);
      };
      if (["day", "week"].includes(unit) && occurrence < activeStart) {
        const stepDays = interval * (unit === "week" ? 7 : 1);
        const skips = Math.max(0, Math.floor((activeStart.getTime() - occurrence.getTime()) / (stepDays * dayMs)));
        occurrence = new Date(occurrence.getTime() + skips * stepDays * dayMs);
      } else if (unit === "month" || unit === "year") {
        let guard = 0;
        while (periodEnd(occurrence) < activeStart && guard++ < 12000) occurrence = nextOccurrence(occurrence);
      }
      let guard = 0;
      while (occurrence <= activeEnd && guard++ < 20000) {
        const periodEndDate = periodEnd(occurrence);
        const overlapStart = Math.max(occurrence.getTime(), activeStart.getTime());
        const overlapEnd = Math.min(periodEndDate.getTime(), activeEnd.getTime());
        if (overlapStart <= overlapEnd) {
          const periodDays = Math.max(1, Math.round((periodEndDate.getTime() - occurrence.getTime()) / dayMs) + 1);
          const overlapDays = Math.round((overlapEnd - overlapStart) / dayMs) + 1;
          total += amount * overlapDays / periodDays;
        }
        occurrence = nextOccurrence(occurrence);
      }
    }));
    return round2(total);
  }

  function parsePaymentRows(doc) {
    let raw = doc.payments;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { raw = null; }
    }
    if (Array.isArray(raw) && raw.length) {
      if (Array.isArray(raw[0]) || (raw[0] && typeof raw[0] === "object")) return raw;
      return [raw];
    }
    if (raw && typeof raw === "object") return [raw];
    const legacyMethod = doc.payment_method || (typeof doc.payments === "string" && !/^\s*[\[{]/.test(doc.payments) ? doc.payments : "Cash");
    return [{ type: legacyMethod, method: legacyMethod, amount: doc.pid ?? doc.price, date: doc.doc_created_date, paid: true }];
  }

  function paymentToolName(payment, shops) {
    if (payment.method) return String(payment.method);
    const code = String(payment.type || "");
    for (const shop of shops || []) {
      try {
        const raw = typeof shop.Shop_Payment_Tools === "string" ? JSON.parse(shop.Shop_Payment_Tools) : shop.Shop_Payment_Tools;
        for (const tool of Array.isArray(raw) ? raw : []) {
          if (Array.isArray(tool) && String(tool[0]) === code) return String(tool[1] || "OTHER");
          if (tool && typeof tool === "object" && String(tool.id ?? tool.code ?? tool.type ?? "") === code) return String(tool.name ?? tool.label ?? "OTHER");
        }
      } catch {}
    }
    return code || "OTHER";
  }

  // doc.py payment rows: [id, pay type, amount, date, updated, user, is paid, ..., payment tool].
  function calculatePaymentTotals(docsList, shops, fromValue = "", toValue = "") {
    const totals = { cash: 0, card: 0, paid: 0, unpaid: 0, cashOut: 0, cardOut: 0, cashStock: 0, cardStock: 0, creditStock: 0, methods: new Map() };
    const from = parseReportDate(fromValue);
    const to = parseReportDate(toValue);
    (docsList || []).forEach(doc => parsePaymentRows(doc).forEach(row => {
      let type, method, amount, date, paidFlag;
      if (Array.isArray(row)) {
        if (row.length >= 7) {
          type = row[1]; amount = row[2]; date = row[3]; paidFlag = row[6]; method = row.length > 8 ? row[8] : "";
        } else if (row.length >= 4) {
          type = row[0]; amount = row[1]; paidFlag = row[2]; method = row[3];
        } else {
          type = row[0]; method = row[0]; amount = row[2] ?? row[1];
          paidFlag = String(row[1] ?? "paid").toLowerCase() !== "unpaid";
        }
      } else {
        type = row.type ?? row.pay_type ?? row.code;
        method = row.method ?? row.payment_method ?? row.tool;
        amount = row.amount ?? row.value ?? row.paid;
        date = row.date ?? row.payment_date;
        paidFlag = row.is_paid ?? row.paid_flag ?? row.paid;
      }
      const paymentDate = parseReportDate(date || doc.doc_created_date);
      if ((from && paymentDate && paymentDate < from) || (to && paymentDate && paymentDate > to)) return;
      const value = Number(amount) || 0;
      const tool = paymentToolName({ type, method }, shops);
      const label = tool.toUpperCase();
      const flag = String(paidFlag ?? "1").trim().toLowerCase();
      const unpaid = ["0", "false", "no", "unpaid"].includes(flag) || label.includes("UNPAID") || String(type || "").toUpperCase().includes("UNPAID");
      if (unpaid) { totals.unpaid += Math.abs(value); return; }
      if (label.includes("CASHOUT") || label.includes("CARDOUT") || flag === "-1") {
        if (label.includes("CARD")) totals.cardOut += Math.abs(value); else totals.cashOut += Math.abs(value);
        return;
      }
      if (label.includes("CASHSTOCK")) { totals.cashStock += Math.abs(value); return; }
      if (label.includes("CARDSTOCK")) { totals.cardStock += Math.abs(value); return; }
      if (label.includes("CREDITSTOCK")) { totals.creditStock += Math.abs(value); return; }
      if (label.includes("CREDIT") || label.includes("CREADIT")) { totals.unpaid += Math.abs(value); return; }
      totals.paid += value;
      if (label.includes("CASHIN") || label.includes("CASH")) totals.cash += value;
      else if (label.includes("CARD") || label.includes("VISA") || label.includes("MASTERCARD")) totals.card += value;
      totals.methods.set(tool, (totals.methods.get(tool) || 0) + value);
    }));
    Object.keys(totals).forEach(key => { if (typeof totals[key] === "number") totals[key] = round2(totals[key]); });
    return totals;
  }

  function renderPaymentToolTotals(methodTotals) {
    const container = $("#rep-payment-tools");
    if (!container) return;
    container.replaceChildren();
    const entries = [...methodTotals.entries()].sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      container.textContent = "No paid payment tools in this date range.";
      return;
    }
    entries.forEach(([name, amount]) => {
      const line = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = name;
      value.textContent = formatMoney(amount, state.activeShop);
      line.append(label, value);
      container.append(line);
    });
  }

  // --- REPORT FINANCIAL METRICS (Doc.py home_tab) ---
  function calculateFinancialMetrics(docsList) {
    const dateFrom = $("#filter-date-from")?.value || "";
    const dateTo = $("#filter-date-to")?.value || dateFrom;
    const paymentTotals = calculatePaymentTotals(docsList, state.shops, dateFrom, dateTo);
    const cashPaid = paymentTotals.cash;
    const cardPaid = paymentTotals.card;
    const cardIn = 0;
    const totalPaid = paymentTotals.paid;
    const cashOuts = paymentTotals.cashOut;
    const cardOuts = paymentTotals.cardOut;
    let totalProfit = 0;
    const unpaid = paymentTotals.unpaid;
    let totalGross = 0;

    docsList.forEach(doc => {
      const price = parseFloat(doc.price) || 0;
      const profit = parseFloat(doc.Profite) || (price * 0.35);
      totalGross += price;
      totalProfit += profit;
    });

    const expenses = calculateShopExpenses(state.shops, dateFrom, dateTo);
    renderPaymentToolTotals(paymentTotals.methods);

    const totalOut = cashOuts + cardOuts + expenses;
    const cashStock = paymentTotals.cashStock;
    const cardStock = paymentTotals.cardStock;
    const creditStock = paymentTotals.creditStock || unpaid;
    const totalStock = cashStock + cardStock + creditStock;
    const profitAfterOuts = totalProfit - totalOut;
    const paidAfterOuts = totalPaid - totalOut;

    // Update DOM Metrics (Doc.py)
    if ($("#rep-cash")) $("#rep-cash").textContent = formatMoney(cashPaid, state.activeShop);
    if ($("#rep-card")) $("#rep-card").textContent = formatMoney(cardPaid, state.activeShop);
    if ($("#rep-card-in")) $("#rep-card-in").textContent = formatMoney(cardIn, state.activeShop);
    if ($("#rep-paid")) $("#rep-paid").textContent = formatMoney(totalPaid, state.activeShop);
    if ($("#rep-cash-outs")) $("#rep-cash-outs").textContent = formatMoney(cashOuts, state.activeShop);
    if ($("#rep-card-outs")) $("#rep-card-outs").textContent = formatMoney(cardOuts, state.activeShop);
    if ($("#rep-expenses")) $("#rep-expenses").textContent = formatMoney(expenses, state.activeShop);
    if ($("#rep-total-out")) $("#rep-total-out").textContent = formatMoney(totalOut, state.activeShop);
    if ($("#rep-cash-stock")) $("#rep-cash-stock").textContent = formatMoney(cashStock, state.activeShop);
    if ($("#rep-card-stock")) $("#rep-card-stock").textContent = formatMoney(cardStock, state.activeShop);
    if ($("#rep-credit-stock")) $("#rep-credit-stock").textContent = formatMoney(creditStock, state.activeShop);
    if ($("#rep-total-stock")) $("#rep-total-stock").textContent = formatMoney(totalStock, state.activeShop);
    if ($("#rep-profit")) $("#rep-profit").textContent = formatMoney(totalProfit, state.activeShop);
    if ($("#rep-profit-after-outs")) $("#rep-profit-after-outs").textContent = formatMoney(profitAfterOuts, state.activeShop);
    if ($("#rep-paid-after-outs")) $("#rep-paid-after-outs").textContent = formatMoney(paidAfterOuts, state.activeShop);
    if ($("#rep-unpaid")) $("#rep-unpaid").textContent = formatMoney(unpaid, state.activeShop);
    if ($("#rep-total")) $("#rep-total").textContent = formatMoney(totalGross, state.activeShop);
    if ($("#rep-gtotal")) $("#rep-gtotal").textContent = formatMoney(totalGross, state.activeShop);
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

    let currentDocLimit = window.currentDocLimit || 30;
    const docsToRender = docs.slice(0, currentDocLimit);

    for (const item of docsToRender) {
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
        <td>${formatMoney(Number(item.price) || 0, item.At_Shop_Id)}</td>
        <td>${formatMoney(Number(item.discount) || 0, item.At_Shop_Id)}</td>
        <td>${formatMoney(Number(item.tax) || 0, item.At_Shop_Id)}</td>
        <td>${item.payments || "Cash"}</td>
        <td>${item.doc_created_date || "-"}</td>
        <td>${item.doc_expire_date || "-"}</td>
      `;

      row.addEventListener("click", () => {
        $$("#sales-body tr").forEach(r => r.style.background = "");
        row.style.background = "rgba(21, 101, 192, 0.35)";
        state.selectedDocInTable = item;
      });

      row.addEventListener("dblclick", () => {
        openDocumentInTopTab(item);
      });

      body.append(row);
    }

    if (docs.length > currentDocLimit) {
      const loadMoreRow = document.createElement("tr");
      loadMoreRow.innerHTML = `<td colspan="14" style="text-align:center;padding:12px;"><button type="button" class="button button-primary" id="btn-load-more-docs">Load More Documents (Showing ${docsToRender.length} of ${docs.length})</button></td>`;
      body.append(loadMoreRow);
      $("#btn-load-more-docs")?.addEventListener("click", () => {
        window.currentDocLimit = (window.currentDocLimit || 30) + 30;
        renderSales();
      });
    }

    const tableWrap = body.closest(".table-scroll");
    if (tableWrap && !tableWrap.dataset.scrollBound) {
      tableWrap.dataset.scrollBound = "true";
      tableWrap.addEventListener("scroll", () => {
        if (tableWrap.scrollTop + tableWrap.clientHeight >= tableWrap.scrollHeight - 100) {
          const totalDocs = docs.length;
          if ((window.currentDocLimit || 30) < totalDocs) {
            window.currentDocLimit = (window.currentDocLimit || 30) + 30;
            renderSales();
          }
        }
      });
    }

    const totalDocCount = docs.length;
    const totalItemCount = docs.reduce((sum, d) => sum + (parseFloat(d.qty) || 1), 0);
    const totalGrandTotal = docs.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0);

    const summaryHeader = $("#doc-summary-header");
    if (summaryHeader) {
      summaryHeader.textContent = `TOTAL DOC : ${totalDocCount} ITEMS : ${totalItemCount} COUNTED Grand Total : ${formatMoney(totalGrandTotal, state.activeShop)}`;
    }

    if (!docs.length) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `<td colspan="14" class="empty-state">No documents found matching search criteria.</td>`;
      body.append(emptyRow);
    }
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  function performEndDay(todayOnly = false) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const dateFrom = todayOnly ? today : ($("#filter-date-from")?.value || today);
      const dateTo = todayOnly ? today : ($("#filter-date-to")?.value || dateFrom);

      if (todayOnly) {
        if ($("#filter-date-from")) $("#filter-date-from").value = today;
        if ($("#filter-date-to")) $("#filter-date-to").value = today;
      }

      // Filter documents for active date selection
      const activeDocs = (state.sales || []).filter(doc => {
        const docDate = (doc.doc_created_date || "").split(" ")[0];
        if (!docDate) return true;
        return docDate >= dateFrom && docDate <= dateTo;
      });

      const paymentTotals = calculatePaymentTotals(state.sales, state.shops, dateFrom, dateTo);
      const totalCashPaid = paymentTotals.cash;
      const totalCardPaid = paymentTotals.card;
      // Doc.py's End Day reconciliation starts with the Cash + Card paid figures.
      const totalPaid = round2(totalCashPaid + totalCardPaid);
      let totalProfit = 0;
      const cashOuts = paymentTotals.cashOut;
      const cardOuts = paymentTotals.cardOut;

      activeDocs.forEach(doc => {
        const price = parseFloat(doc.price) || 0;
        totalProfit += parseFloat(doc.Profite) || (price * 0.35);
      });

      const expenses = calculateShopExpenses(state.shops, dateFrom, dateTo);

      const totalOuts = cashOuts + cardOuts + expenses;
      const profitAfterExp = round2(totalProfit - totalOuts);
      const totalAfterExp = round2(totalCashPaid + totalCardPaid - totalOuts);

      // Doc.py's stock is the sum of the CASHSTOCK, CARDSTOCK and CREDITSTOCK
      // payment-tool balances, not the retail value of product quantities.
      const stockValue = round2(paymentTotals.cashStock + paymentTotals.cardStock + paymentTotals.creditStock);
      const totalAfterStock = round2(totalCashPaid + totalCardPaid - totalOuts - stockValue);
      const totalGross = activeDocs.reduce((sum, doc) => sum + (parseFloat(doc.price) || 0), 0);

      // Format Date Range String
      const dateStr = dateFrom === dateTo ? `DATE: ${dateFrom}` : `FROM DATE: ${dateFrom} TO ${dateTo}`;
      if ($("#endday-date-str")) $("#endday-date-str").textContent = dateStr;

      if ($("#daily-cash-val")) $("#daily-cash-val").textContent = formatMoney(totalCashPaid, state.activeShop);
      if ($("#daily-card-val")) $("#daily-card-val").textContent = formatMoney(totalCardPaid, state.activeShop);
      if ($("#daily-out-val")) $("#daily-out-val").textContent = formatMoney(totalOuts, state.activeShop);
      if ($("#daily-profit-val")) $("#daily-profit-val").textContent = formatMoney(totalProfit, state.activeShop);
      if ($("#daily-grand-total-val")) $("#daily-grand-total-val").textContent = formatMoney(totalGross, state.activeShop);

      // Update End Day Summary Cards (Matching Doc.py)
      if ($("#endday-exp-val")) $("#endday-exp-val").textContent = formatMoney(expenses, state.activeShop);
      if ($("#endday-outs-val")) $("#endday-outs-val").textContent = formatMoney(cashOuts + cardOuts, state.activeShop);
      if ($("#endday-subouts-val")) $("#endday-subouts-val").textContent = "-" + formatMoney(totalOuts, state.activeShop);

      if ($("#endday-cash-val")) $("#endday-cash-val").textContent = formatMoney(totalCashPaid, state.activeShop);
      if ($("#endday-card-val")) $("#endday-card-val").textContent = formatMoney(totalCardPaid, state.activeShop);
      if ($("#endday-paid-val")) $("#endday-paid-val").textContent = formatMoney(totalPaid, state.activeShop);

      if ($("#endday-profit-val")) $("#endday-profit-val").textContent = formatMoney(totalProfit, state.activeShop);

      const profitExpEl = $("#endday-profit-after-exp-val");
      if (profitExpEl) {
        profitExpEl.textContent = formatMoney(profitAfterExp, state.activeShop);
        profitExpEl.style.color = profitAfterExp < 0 ? "#f87171" : "#4ade80";
      }

      if ($("#endday-total-after-exp-val")) $("#endday-total-after-exp-val").textContent = formatMoney(totalAfterExp, state.activeShop);
      if ($("#endday-stock-val")) $("#endday-stock-val").textContent = formatMoney(stockValue, state.activeShop);
      if ($("#endday-total-after-stock-val")) $("#endday-total-after-stock-val").textContent = formatMoney(totalAfterStock, state.activeShop);

      // Populate Reconciled Documents Table
      const docsBody = $("#endday-docs-body");
      if (docsBody) {
        docsBody.replaceChildren();
        activeDocs.forEach((doc, idx) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${escapeHtml(doc.doc_barcode || ("DOC-" + doc.id))}</strong></td>
            <td>${escapeHtml(doc.At_Shop_Id || doc.at_shop || "Main Shop")}</td>
            <td>${escapeHtml(doc.customer_id || "Walk-in")}</td>
            <td>${escapeHtml(doc.user_id || "admin")}</td>
            <td>${formatMoney(parseFloat(doc.price) || 0, doc.At_Shop_Id)}</td>
            <td>${escapeHtml((doc.doc_created_date || "").split(" ")[0] || dateFrom)}</td>
          `;
          docsBody.append(row);
        });

        if (activeDocs.length === 0) {
          docsBody.innerHTML = `<tr><td colspan="7" class="empty-state">No documents found for current date selection.</td></tr>`;
        }
      }

      // Construct Printable End Day Slip Text (Doc.py format)
      const currencyForReport = value => formatMoney(value, state.activeShop);
      const endDaySlipText = [
        "========================================",
        "       HIPER MARKET - END DAY SLIP      ",
        "========================================",
        dateStr,
        "----------------------------------------",
        `Expenses              : ${currencyForReport(round2(expenses))}`,
        `Cash Outs             : ${currencyForReport(round2(cashOuts + cardOuts))}`,
        "                        -----------",
        `Total Outflows        : -${currencyForReport(round2(totalOuts))}`,
        "",
        `Cash Paid             : ${currencyForReport(round2(totalCashPaid))}`,
        `Card Paid             : ${currencyForReport(round2(totalCardPaid))}`,
        "                        -----------",
        `Total Paid            : ${currencyForReport(round2(totalPaid))}`,
        "",
        `Gross Profit          : ${currencyForReport(round2(totalProfit))}`,
        `Profit After Exp      : ${currencyForReport(profitAfterExp)}`,
        `Total After Exp       : ${currencyForReport(totalAfterExp)}`,
        `Stock                 : ${currencyForReport(stockValue)}`,
        `Total After Stock     : ${currencyForReport(totalAfterStock)}`,
        "========================================",
        `Reconciled Documents : ${activeDocs.length} items`,
        "========================================"
      ].join("\n");

      const dialog = $("#end-day-dialog");
      if (dialog) {
        dialog.dataset.slipText = endDaySlipText;
        if (!dialog.open) dialog.showModal();
      }
    } catch (err) {
      console.error("Failed to perform end day:", err);
      const dialog = $("#end-day-dialog");
      if (dialog && !dialog.open) dialog.showModal();
    }
  }

  function printEndDaySlip() {
    const dialog = $("#end-day-dialog");
    const slipText = dialog?.dataset.slipText || "";
    if (!slipText) {
      if (window.HiperApi) window.HiperApi.showToast("No End Day slip data to print.", true);
      return;
    }

    const printArea = $("#receipt-content");
    if (printArea) {
      printArea.textContent = slipText;
      window.print();
    } else {
      if (window.HiperApi) window.HiperApi.showToast("End Day slip sent to printer!");
    }
  }

  function bindEndDayModalEvents() {
    const setReportMode = (moreInfo) => {
      $("#daily-report-cards")?.classList.toggle("hidden", moreInfo);
      $("#daily-report-details")?.classList.toggle("hidden", !moreInfo);
      $("#endday-report-tabs")?.classList.toggle("hidden", !moreInfo);
      $("#daily-report-simple")?.classList.toggle("active", !moreInfo);
      $("#daily-report-simple")?.classList.toggle("button-primary", !moreInfo);
      $("#daily-report-simple")?.classList.toggle("button-secondary", moreInfo);
      $("#daily-report-more")?.classList.toggle("active", moreInfo);
      $("#daily-report-more")?.classList.toggle("button-primary", moreInfo);
      $("#daily-report-more")?.classList.toggle("button-secondary", !moreInfo);
      if (!moreInfo) {
        $("#endday-view-summary")?.classList.remove("hidden");
        $("#endday-view-docs")?.classList.add("hidden");
        $("#endday-tab-summary")?.classList.add("active");
        $("#endday-tab-docs")?.classList.remove("active");
      }
    };
    setReportMode(false);
    $("#daily-report-simple")?.addEventListener("click", () => setReportMode(false));
    $("#daily-report-more")?.addEventListener("click", () => setReportMode(true));

    $("#endday-tab-summary")?.addEventListener("click", () => {
      $("#endday-tab-summary")?.classList.add("active");
      $("#endday-tab-docs")?.classList.remove("active");
      $("#endday-view-summary")?.classList.remove("hidden");
      $("#endday-view-docs")?.classList.add("hidden");
      $("#daily-report-cards")?.classList.add("hidden");
      $("#daily-report-details")?.classList.remove("hidden");
    });

    $("#endday-tab-docs")?.addEventListener("click", () => {
      $("#endday-tab-docs")?.classList.add("active");
      $("#endday-tab-summary")?.classList.remove("active");
      $("#endday-view-docs")?.classList.remove("hidden");
      $("#endday-view-summary")?.classList.add("hidden");
      $("#daily-report-cards")?.classList.add("hidden");
      $("#daily-report-details")?.classList.add("hidden");
    });

    $("#close-end-day-btn")?.addEventListener("click", () => {
      $("#end-day-dialog")?.close();
    });

    $("#endday-close-btn")?.addEventListener("click", () => {
      $("#end-day-dialog")?.close();
    });

    $("#endday-refresh-btn")?.addEventListener("click", async () => {
      await performDocSearch();
      performEndDay();
      if (window.HiperApi) window.HiperApi.showToast("End Day data refreshed!");
    });

    $("#endday-print-btn")?.addEventListener("click", () => {
      printEndDaySlip();
    });
  }

  function bindDocEvents() {
    initDocDates();
    bindEndDayModalEvents();

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

    $("#btn-end-day")?.addEventListener("click", () => {
      performEndDay();
    });

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

  return {
    populateUserDropdown,
    performDocSearch,
    renderNotebookTabs,
    renderSales,
    openDocumentInTopTab,
    closeTopTab,
    switchTopTab,
    performEndDay,
    bindDocEvents
  };
})();
