/**
 * reports.js - Sales Reports & Chart Visualizer Module (#view-reports)
 */
window.HiperReports = (() => {
  "use strict";

  const { state, $, api, formatMoney } = window.HiperApi;

  async function loadReports() {
    try {
      const result = await api("reports");
      state.reports = result.items || [];
      return state.reports;
    } catch {
      return [];
    }
  }

  function renderReports() {
    const body = $("#reports-body");
    if (!body) return;
    body.replaceChildren();
    for (const report of state.reports || []) {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${report.date}</td><td>${report.sales}</td><td>${formatMoney(report.gross || 0, state.activeShop)}</td>`;
      body.append(row);
    }
    if (!(state.reports || []).length) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `<td colspan="3" class="empty-state">No sales reports available.</td>`;
      body.append(emptyRow);
    }
  }

  return {
    loadReports,
    renderReports
  };
})();
