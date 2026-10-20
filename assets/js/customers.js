/** Users & Customers directory, aligned with M/Users.py. */
window.HiperCustomers = (() => {
  "use strict";
  const { state, $, api, showToast } = window.HiperApi;
  let selectedId = null;
  let selectedUserId = null;

  const fullName = user => [user.User_fname, user.User_Lname].filter(Boolean).join(" ") || user.User_name || "User";
  const addCell = (row, value, className = "") => {
    const cell = document.createElement("td"); cell.textContent = value == null || value === "" ? "-" : String(value);
    if (className) cell.className = className; row.append(cell); return cell;
  };
  const historyFor = user => (state.sales || []).filter(doc => {
    const ids = [doc.customer_id, doc.user_id, doc.User_id].filter(value => value != null).map(String);
    const names = [doc.customer_name, doc.user_name, doc.User_name].filter(Boolean).map(String);
    return (user.User_id != null && ids.includes(String(user.User_id))) || names.includes(String(user.User_name || "")) || names.includes(fullName(user));
  });

  function renderDetails(user) {
    const panel = $("#user-details-panel"); if (!panel) return;
    selectedId = user.User_id;
    $("#user-details-title").textContent = `${fullName(user)} · ${user.User_type || "Customer"}`;
    const fields = $("#user-details-fields"); fields.replaceChildren();
    fields.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px";
    const values = [
      ["Username", user.User_name], ["Gender", user.User_gender], ["Country", user.User_country], ["City / address", user.User_address],
      ["Phone", user.User_phone_num], ["Email", user.User_email], ["Home number", user.User_home_no], ["ID / passport", user.User_id_pp_num],
      ["Role", user.User_type], ["Access", user.User_access], ["Customer shops", user.User_shop], ["Workplace assignments", user.User_work_shop], ["About", user.User_about]
    ];
    for (const [label, value] of values) {
      const block = document.createElement("div"); block.className = "user-profile-item";
      const title = document.createElement("strong"); title.textContent = label;
      const content = document.createElement("span"); content.textContent = value || "-";
      block.append(title, content); fields.append(block);
    }
    const body = $("#user-documents-body"); body.replaceChildren();
    for (const doc of historyFor(user)) {
      const row = document.createElement("tr");
      addCell(row, doc.doc_barcode); addCell(row, doc.type); addCell(row, doc.item); addCell(row, doc.qty);
      addCell(row, window.HiperApi.formatMoney(Number(doc.price) || 0, doc.At_Shop_Id)); addCell(row, doc.payments);
      addCell(row, doc.doc_created_date);
      const action = document.createElement("td"); const view = document.createElement("button");
      view.className = "text-button"; view.type = "button"; view.textContent = "View"; view.dataset.docKey = String(doc.doc_barcode || doc.id || "");
      action.append(view); row.append(action); body.append(row);
    }
    if (!body.children.length) { const row = document.createElement("tr"); addCell(row, "No documents found for this user.").colSpan = 8; row.firstChild.className = "empty-state"; body.append(row); }
    panel.hidden = false;
  }

  function renderUsers() {
    const body = $("#users-body"); if (!body) return;
    body.replaceChildren();
    const query = $("[data-search=users]")?.value.trim().toLowerCase() || "";
    const items = (state.users || []).filter(item => !query || Object.values(item).some(value => String(value ?? "").toLowerCase().includes(query)));
    if (!items.some(item => String(item.User_id ?? "") === String(selectedUserId ?? ""))) selectedUserId = null;
    for (const item of items) {
      const row = document.createElement("tr"); row.dataset.userId = String(item.User_id ?? "");
      if (String(selectedUserId) === row.dataset.userId) row.classList.add("manager-selected-row");
      addCell(row, fullName(item)); addCell(row, item.User_name); addCell(row, item.User_phone_num); addCell(row, item.User_email);
      addCell(row, [item.User_type, item.User_access && `Access ${item.User_access}`].filter(Boolean).join(" · "));
      addCell(row, [item.User_country, item.User_address].filter(Boolean).join(" · "));
      const actions = document.createElement("td");
      const details = document.createElement("button"); details.className = "text-button"; details.type = "button"; details.textContent = "Details"; details.dataset.userAction = "details";
      actions.append(details);
      row.append(actions); body.append(row);
    }
    if (!items.length) { const row = document.createElement("tr"); addCell(row, "No users match this search.", "empty-state").colSpan = 7; body.append(row); }
    const selected = items.some(item => String(item.User_id ?? "") === String(selectedUserId ?? ""));
    $("#user-edit-selected").disabled = !selected;
    $("#user-delete-selected").disabled = !selected || !window.HiperAuth?.isManager?.();
  }

  async function onAction(event) {
    const row = event.target.closest("tr[data-user-id]"); if (!row) return;
    selectedUserId = row.dataset.userId; renderUsers();
    const button = event.target.closest("[data-user-action]"); if (!button) return;
    const user = (state.users || []).find(item => String(item.User_id ?? "") === row.dataset.userId);
    if (!user) return;
    if (button.dataset.userAction === "details") return renderDetails(user);
  }

  async function deleteSelectedUser() {
    const user = (state.users || []).find(item => String(item.User_id ?? "") === String(selectedUserId ?? ""));
    if (!user || !window.confirm(`Delete ${fullName(user)}?`)) return;
    try {
      await api("delete", { method: "POST", body: { resource: "users", id: user.User_id } });
      state.users = state.users.filter(item => String(item.User_id) !== String(user.User_id));
      if (String(selectedId) === String(user.User_id)) $("#user-details-panel").hidden = true;
      selectedUserId = null; renderUsers(); showToast("User deleted.");
    } catch (error) { showToast(error.message, true); }
  }

  function viewUserDocument(event) {
    const button = event.target.closest("[data-doc-key]"); if (!button) return;
    const doc = (state.sales || []).find(item => String(item.doc_barcode || item.id || "") === button.dataset.docKey);
    if (!doc) return;
    window.HiperManager?.switchManagerTab("sales");
    window.HiperDocuments?.openDocumentInTopTab(doc);
  }

  function bindEvents() {
    $("[data-search=users]")?.addEventListener("input", renderUsers);
    $("#users-body")?.addEventListener("click", onAction);
    $("#user-add")?.addEventListener("click", () => { selectedUserId = null; renderUsers(); window.HiperApp.openRecordDialog("users"); });
    $("#user-edit-selected")?.addEventListener("click", () => { const user = (state.users || []).find(item => String(item.User_id ?? "") === String(selectedUserId ?? "")); if (user) window.HiperApp.openRecordDialog("users", user); });
    $("#user-delete-selected")?.addEventListener("click", deleteSelectedUser);
    $("#user-documents-body")?.addEventListener("click", viewUserDocument);
    $("#user-details-close")?.addEventListener("click", () => { $("#user-details-panel").hidden = true; selectedId = null; });
  }
  return { renderUsers, bindEvents };
})();
