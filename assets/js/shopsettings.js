/** Shop settings tabs modeled on Setting.py and the three shop settings forms. */
window.HiperShopSettings = (() => {
  "use strict";
  const { state, $, api, showToast, setMessage, formatMoney } = window.HiperApi;
  let selectedExpense = null;
  let selectedWorkerId = "";
  let selectedCategoryPath = [];
  let categoryTree = [];
  let slipSettings = ["40", "20", []];
  let shopLists = { phones: [], social: [], locations: [], rules: [] };
  const ACCESS_TYPES = [
    "USER CAN INITIALIZE SYSTEM", "USER CAN SEE PAYMENT TOOL BUTTONS", "USER CAN USE CASH PAYMENT TOOL", "USER CAN USE CARD PAYMENT TOOL", "USER CAN USE CREADIT PAYMENT TOOL", "USER CAN USE CASHOUT PAYMENT TOOL", "USER CAN USE CASHIN PAYMENT TOOL", "USER CAN USE OTHER PAYMENT TOOL", "USER CAN CREATE UKNOWN ITEMS", "USER CAN SEARCH PRODUCTS", "USER CAN CREATE NEW ORDER", "USER CAN VOIDE ORDER", "USER CAN CHANGE ORDER", "USER CAN DELETE ITEM FROM ORDER", "USER CAN CHANGE ITEM QTY", "USER CAN CHANGE ITEM PRICE", "USER CAN CHANGE ITEM DISCOUNT", "USER CAN CHANGE ITEM TYPE", "USER CAN APPLY TOTAL DISCOUNT", "USER CAN FINALIZE ORDER", "USER CAN CREATE USER/COSTUMER INFO", "USER CAN SEARCH USER/COSTUMER INFO", "USER CAN SALL ORDER", "USER CAN SEARCH DOCUMENTS", "USER CAN SEARCH ACTIONS", "USER CAN UPLOAD", "USER CAN SEE MANAGER", "USER CAN SEE DOCUMENT MANAGER", "USER CAN SEE PRODUCTE MANAGER", "USER CAN SEE USER MANAGER", "USER CAN SEE TOOL MANAGER", "USER CAN SEE ACTIONS MANAGER", "USER CAN SEARCH TOOLS", "USER CAN CREATE OR CHANGE PRODUCT", "USER CAN CHANGE PRODUCTS NAME", "USER CAN CHANGE PRODUCT PRICE", "USER CAN CHANGE PRODUCTS TYPE", "USER CAN CHANGE PRODUCTS IMAGE", "USER CAN CREATE NEW TOOLS", "USER CAN CHANGE TOOLS ACTIONS", "USER CAN CHANGE USER/COSTUMER INFO", "USER CAN CREATE NEW ACTIONS", "USER CAN FILTER ACTIONS", "USER CAN EXPORT ACTIONS", "USER CAN CHANGE RECORDED DOCUMENTS", "USER CAN SEE TOTAL SALE", "USER CAN CHANGE PRODUCT COST", "USER CAN CHANGE PRODUCTS TAX", "USER CAN CHANGE PRODUCTS PROFITE PERSENT", "USER CAN CHANGE PRODUCTS STOCK QTY", "USER CAN CHANGE TOOLS TYPE", "USER CAN DELETE TOOLS", "USER CAN SEE DOCUMENT MANAGER"
  ];
  const SLIP_FIELDS = ["*", "#", "-", "_", "=", "~", "LOGO", "Information", "About", "Phone_No", "Receipt_no", "Extnsion_Receipt_no", "Date", "Updated_date", "Due_date", "User", "Seller", "Customer", "Item", "Rules"];
  const DEFAULT_CATEGORIES = [["MANS",[["ACCESSORIES",[["BAG",[["BACKPACK BAG",[]],["DUFFLE BAG",[]],["LAPTOP BAG",[]],["WALLET BAG",[]],["BELT BAG",[]],["HAND BAG",[]],["TOTE",[]],["CLUTCH BAG",[]],["CROSSBODY",[]]]],["JEWELRY",[["WATCH",[]],["BRACELET",[]],["RING",[]],["CUFFLINKS",[]],["EARING",[]],["NECKLACE",[]],["ANKLET",[]]]],["HEADWEAR",[["CAP",[]],["HAT",[]],["BEANIE",[]],["DURAG",[]],["HIJAB",[]],["SCARF",[]],["HEADBAND",[]]]],["EYEWEAR",[["SUNGLASSES",[]],["GLASSES",[]],["EYELASH",[]],["EYELANCE",[]]]],["BELT",[]],["HAIR ACCESSORIES",[]],["OTHERS",[["SOCKS",[]],["GLOVES",[]],["SHOELACE",[]],["TIE",[]],["BOWTIE",[]],["SHAWL",[]],["TIGHTS",[]]]]]],["SHOES",[["CASUAL",[["SNEAKERS",[]],["LOAFERS",[]],["FLATS",[]],["SANDALS",[]]]],["FORMAL",[["OXFORD",[]],["DERBY",[]],["SUIT SHOES",[]],["HEELS",[]],["PUMPS",[]],["WEDGES",[]]]],["SPORT SHOES",[["RUNNING SHOES",[]],["TRAINING SHOES",[]]]],["BOOTS",[["CHELSEA",[]],["COMBAT",[]],["WORK BOOTS",[]],["ANKLE BOOTS",[]],["KNEE HIGH BOOTS",[]],["FORMAL BOOTS",[]]]]]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]],["CROP TOP",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]],["CHINOS",[]],["TROUSERS",[]],["SUIT PANT",[]],["JOGGERS",[]],["PALAZZO",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["PARKA",[]],["WINDBREAKER",[]],["LEZER JACKET",[]],["RIN COAT JACKET",[]],["BOMBER JACKET",[]],["CARDIGAN",[]],["DENIM JACKET",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]],["TRADITIONAL",[["KURTA",[]],["SHERWANI",[]],["THOBE",[]],["KURTI",[]],["SAREE",[]],["HIJAB DRESS",[]],["ABAYA",[]],["KAFTAN",[]]]],["DRESS",[["CASUAL DRESS",[]],["MAXI DRESS",[]],["EVENING DRESS",[]],["SUMMER DRESS",[]],["ABAYA DRESS",[]]]]]],["WOMANS",[["ACCESSORIES",[["BAG",[["BACKPACK BAG",[]],["DUFFLE BAG",[]],["LAPTOP BAG",[]],["WALLET BAG",[]],["BELT BAG",[]],["HAND BAG",[]],["TOTE",[]],["CLUTCH BAG",[]],["CROSSBODY",[]]]],["JEWELRY",[["WATCH",[]],["BRACELET",[]],["RING",[]],["CUFFLINKS",[]],["EARING",[]],["NECKLACE",[]],["ANKLET",[]]]],["HEADWEAR",[["CAP",[]],["HAT",[]],["BEANIE",[]],["DURAG",[]],["HIJAB",[]],["SCARF",[]],["HEADBAND",[]]]],["EYEWEAR",[["SUNGLASSES",[]],["GLASSES",[]],["EYELASH",[]],["EYELANCE",[]]]],["BELT",[]],["HAIR ACCESSORIES",[]],["OTHERS",[["SOCKS",[]],["GLOVES",[]],["SHOELACE",[]],["TIE",[]],["BOWTIE",[]],["SHAWL",[]],["TIGHTS",[]]]]]],["SHOES",[["CASUAL",[["SNEAKERS",[]],["LOAFERS",[]],["FLATS",[]],["SANDALS",[]]]],["FORMAL",[["OXFORD",[]],["DERBY",[]],["SUIT SHOES",[]],["HEELS",[]],["PUMPS",[]],["WEDGES",[]]]],["SPORT SHOES",[["RUNNING SHOES",[]],["TRAINING SHOES",[]]]],["BOOTS",[["CHELSEA",[]],["COMBAT",[]],["WORK BOOTS",[]],["ANKLE BOOTS",[]],["KNEE HIGH BOOTS",[]],["FORMAL BOOTS",[]]]]]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]],["CROP TOP",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]],["CHINOS",[]],["TROUSERS",[]],["SUIT PANT",[]],["JOGGERS",[]],["PALAZZO",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["PARKA",[]],["WINDBREAKER",[]],["LEZER JACKET",[]],["RIN COAT JACKET",[]],["BOMBER JACKET",[]],["CARDIGAN",[]],["DENIM JACKET",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]],["TRADITIONAL",[["KURTA",[]],["SHERWANI",[]],["THOBE",[]],["KURTI",[]],["SAREE",[]],["HIJAB DRESS",[]],["ABAYA",[]],["KAFTAN",[]]]],["DRESS",[["CASUAL DRESS",[]],["MAXI DRESS",[]],["EVENING DRESS",[]],["SUMMER DRESS",[]],["ABAYA DRESS",[]]]]]],["KIDS",[["GIRLS",[["ACCESSORIES",[["BAG",[["BACKPACK BAG",[]],["DUFFLE BAG",[]],["LAPTOP BAG",[]],["WALLET BAG",[]],["BELT BAG",[]],["HAND BAG",[]],["TOTE",[]],["CLUTCH BAG",[]],["CROSSBODY",[]]]],["JEWELRY",[["WATCH",[]],["BRACELET",[]],["RING",[]],["CUFFLINKS",[]],["EARING",[]],["NECKLACE",[]],["ANKLET",[]]]],["HEADWEAR",[["CAP",[]],["HAT",[]],["BEANIE",[]],["DURAG",[]],["HIJAB",[]],["SCARF",[]],["HEADBAND",[]]]],["EYEWEAR",[["SUNGLASSES",[]],["GLASSES",[]],["EYELASH",[]],["EYELANCE",[]]]],["BELT",[]],["HAIR ACCESSORIES",[]],["OTHERS",[["SOCKS",[]],["GLOVES",[]],["SHOELACE",[]],["TIE",[]],["BOWTIE",[]],["SHAWL",[]],["TIGHTS",[]]]]]],["SHOES",[["CASUAL",[["SNEAKERS",[]],["LOAFERS",[]],["FLATS",[]],["SANDALS",[]]]],["FORMAL",[["OXFORD",[]],["DERBY",[]],["SUIT SHOES",[]],["HEELS",[]],["PUMPS",[]],["WEDGES",[]]]],["SPORT SHOES",[["RUNNING SHOES",[]],["TRAINING SHOES",[]]]],["BOOTS",[["CHELSEA",[]],["COMBAT",[]],["WORK BOOTS",[]],["ANKLE BOOTS",[]],["KNEE HIGH BOOTS",[]],["FORMAL BOOTS",[]]]]]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]],["CROP TOP",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]],["CHINOS",[]],["TROUSERS",[]],["SUIT PANT",[]],["JOGGERS",[]],["PALAZZO",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["PARKA",[]],["WINDBREAKER",[]],["LEZER JACKET",[]],["RIN COAT JACKET",[]],["BOMBER JACKET",[]],["CARDIGAN",[]],["DENIM JACKET",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]],["TRADITIONAL",[["KURTA",[]],["SHERWANI",[]],["THOBE",[]],["KURTI",[]],["SAREE",[]],["HIJAB DRESS",[]],["ABAYA",[]],["KAFTAN",[]]]],["DRESS",[["CASUAL DRESS",[]],["MAXI DRESS",[]],["EVENING DRESS",[]],["SUMMER DRESS",[]],["ABAYA DRESS",[]]]]]],["BOYS",[["ACCESSORIES",[["BAG",[["BACKPACK BAG",[]],["DUFFLE BAG",[]],["LAPTOP BAG",[]],["WALLET BAG",[]],["BELT BAG",[]],["HAND BAG",[]],["TOTE",[]],["CLUTCH BAG",[]],["CROSSBODY",[]]]],["JEWELRY",[["WATCH",[]],["BRACELET",[]],["RING",[]],["CUFFLINKS",[]],["EARING",[]],["NECKLACE",[]],["ANKLET",[]]]],["HEADWEAR",[["CAP",[]],["HAT",[]],["BEANIE",[]],["DURAG",[]],["HIJAB",[]],["SCARF",[]],["HEADBAND",[]]]],["EYEWEAR",[["SUNGLASSES",[]],["GLASSES",[]],["EYELASH",[]],["EYELANCE",[]]]],["BELT",[]],["HAIR ACCESSORIES",[]],["OTHERS",[["SOCKS",[]],["GLOVES",[]],["SHOELACE",[]],["TIE",[]],["BOWTIE",[]],["SHAWL",[]],["TIGHTS",[]]]]]],["SHOES",[["CASUAL",[["SNEAKERS",[]],["LOAFERS",[]],["FLATS",[]],["SANDALS",[]]]],["FORMAL",[["OXFORD",[]],["DERBY",[]],["SUIT SHOES",[]],["HEELS",[]],["PUMPS",[]],["WEDGES",[]]]],["SPORT SHOES",[["RUNNING SHOES",[]],["TRAINING SHOES",[]]]],["BOOTS",[["CHELSEA",[]],["COMBAT",[]],["WORK BOOTS",[]],["ANKLE BOOTS",[]],["KNEE HIGH BOOTS",[]],["FORMAL BOOTS",[]]]]]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]],["CROP TOP",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]],["CHINOS",[]],["TROUSERS",[]],["SUIT PANT",[]],["JOGGERS",[]],["PALAZZO",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["PARKA",[]],["WINDBREAKER",[]],["LEZER JACKET",[]],["RIN COAT JACKET",[]],["BOMBER JACKET",[]],["CARDIGAN",[]],["DENIM JACKET",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]],["TRADITIONAL",[["KURTA",[]],["SHERWANI",[]],["THOBE",[]],["KURTI",[]],["SAREE",[]],["HIJAB DRESS",[]],["ABAYA",[]],["KAFTAN",[]]]],["DRESS",[["CASUAL DRESS",[]],["MAXI DRESS",[]],["EVENING DRESS",[]],["SUMMER DRESS",[]],["ABAYA DRESS",[]]]]]],["FORKIDS",[["ACCESSORIES",[["BAG",[["BACKPACK BAG",[]],["DUFFLE BAG",[]],["LAPTOP BAG",[]],["WALLET BAG",[]],["BELT BAG",[]],["HAND BAG",[]],["TOTE",[]],["CLUTCH BAG",[]],["CROSSBODY",[]]]],["JEWELRY",[["WATCH",[]],["BRACELET",[]],["RING",[]],["CUFFLINKS",[]],["EARING",[]],["NECKLACE",[]],["ANKLET",[]]]],["HEADWEAR",[["CAP",[]],["HAT",[]],["BEANIE",[]],["DURAG",[]],["HIJAB",[]],["SCARF",[]],["HEADBAND",[]]]],["EYEWEAR",[["SUNGLASSES",[]],["GLASSES",[]],["EYELASH",[]],["EYELANCE",[]]]],["BELT",[]],["HAIR ACCESSORIES",[]],["OTHERS",[["SOCKS",[]],["GLOVES",[]],["SHOELACE",[]],["TIE",[]],["BOWTIE",[]],["SHAWL",[]],["TIGHTS",[]]]]]],["SHOES",[["CASUAL",[["SNEAKERS",[]],["LOAFERS",[]],["FLATS",[]],["SANDALS",[]]]],["FORMAL",[["OXFORD",[]],["DERBY",[]],["SUIT SHOES",[]],["HEELS",[]],["PUMPS",[]],["WEDGES",[]]]],["SPORT SHOES",[["RUNNING SHOES",[]],["TRAINING SHOES",[]]]],["BOOTS",[["CHELSEA",[]],["COMBAT",[]],["WORK BOOTS",[]],["ANKLE BOOTS",[]],["KNEE HIGH BOOTS",[]],["FORMAL BOOTS",[]]]]]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]],["CROP TOP",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]],["CHINOS",[]],["TROUSERS",[]],["SUIT PANT",[]],["JOGGERS",[]],["PALAZZO",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["PARKA",[]],["WINDBREAKER",[]],["LEZER JACKET",[]],["RIN COAT JACKET",[]],["BOMBER JACKET",[]],["CARDIGAN",[]],["DENIM JACKET",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]],["TRADITIONAL",[["KURTA",[]],["SHERWANI",[]],["THOBE",[]],["KURTI",[]],["SAREE",[]],["HIJAB DRESS",[]],["ABAYA",[]],["KAFTAN",[]]]],["DRESS",[["CASUAL DRESS",[]],["MAXI DRESS",[]],["EVENING DRESS",[]],["SUMMER DRESS",[]],["ABAYA DRESS",[]]]]]]]],["FOREVERYONE",[["ACCESSORIES",[["BAG",[["BACKPACK BAG",[]],["DUFFLE BAG",[]],["LAPTOP BAG",[]],["WALLET BAG",[]],["BELT BAG",[]],["HAND BAG",[]],["TOTE",[]],["CLUTCH BAG",[]],["CROSSBODY",[]]]],["JEWELRY",[["WATCH",[]],["BRACELET",[]],["RING",[]],["CUFFLINKS",[]],["EARING",[]],["NECKLACE",[]],["ANKLET",[]]]],["HEADWEAR",[["CAP",[]],["HAT",[]],["BEANIE",[]],["DURAG",[]],["HIJAB",[]],["SCARF",[]],["HEADBAND",[]]]],["EYEWEAR",[["SUNGLASSES",[]],["GLASSES",[]],["EYELASH",[]],["EYELANCE",[]]]],["BELT",[]],["HAIR ACCESSORIES",[]],["OTHERS",[["SOCKS",[]],["GLOVES",[]],["SHOELACE",[]],["TIE",[]],["BOWTIE",[]],["SHAWL",[]],["TIGHTS",[]]]]]],["SHOES",[["CASUAL",[["SNEAKERS",[]],["LOAFERS",[]],["FLATS",[]],["SANDALS",[]]]],["FORMAL",[["OXFORD",[]],["DERBY",[]],["SUIT SHOES",[]],["HEELS",[]],["PUMPS",[]],["WEDGES",[]]]],["SPORT SHOES",[["RUNNING SHOES",[]],["TRAINING SHOES",[]]]],["BOOTS",[["CHELSEA",[]],["COMBAT",[]],["WORK BOOTS",[]],["ANKLE BOOTS",[]],["KNEE HIGH BOOTS",[]],["FORMAL BOOTS",[]]]]]],["TOP",[["T-SHIRT",[]],["SHIRT",[]],["BLOUSES",[]],["POLO SHIRT",[]],["TANK",[]],["SWEATER",[]],["HOODIES",[]],["JACKET",[]],["BLAZER",[]],["CROP TOP",[]]]],["BOTTOM",[["JEAN",[]],["PANT",[]],["SHORT",[]],["SKIRT",[]],["LEGGING",[]],["CULOTTE",[]],["CHINOS",[]],["TROUSERS",[]],["SUIT PANT",[]],["JOGGERS",[]],["PALAZZO",[]]]],["OUTERWEAR",[["COAT",[]],["TRENCH COAT",[]],["PARKA",[]],["WINDBREAKER",[]],["LEZER JACKET",[]],["RIN COAT JACKET",[]],["BOMBER JACKET",[]],["CARDIGAN",[]],["DENIM JACKET",[]]]],["ACTIVEWEAR",[["ATHLETICSHORTS",[]],["JOGGINGPANT",[]],["SPORTJACKET",[]],["YOGAPANT",[]],["PREFORMANCETOP",[]]]],["TRADITIONAL",[["KURTA",[]],["SHERWANI",[]],["THOBE",[]],["KURTI",[]],["SAREE",[]],["HIJAB DRESS",[]],["ABAYA",[]],["KAFTAN",[]]]],["DRESS",[["CASUAL DRESS",[]],["MAXI DRESS",[]],["EVENING DRESS",[]],["SUMMER DRESS",[]],["ABAYA DRESS",[]]]]]]];
  const shopId = shop => String(shop?.Shop_Id ?? shop?.Shop_id ?? shop?.Id ?? "");
  const currentShop = () => (state.shops || []).find(shop => shopId(shop) === $("#ss-shop-select")?.value) || state.activeShop || (state.shops || [])[0] || null;
  const parseArray = value => { try { const result = typeof value === "string" ? JSON.parse(value || "[]") : value; return Array.isArray(result) ? result : []; } catch { return []; } };
  const field = selector => $(selector);
  const text = value => String(value ?? "");

  function updateShop(shop) {
    if (!shop) return;
    state.shops = (state.shops || []).map(item => shopId(item) === shopId(shop) ? { ...item, ...shop } : item);
    if (state.activeShop && shopId(state.activeShop) === shopId(shop)) state.activeShop = { ...state.activeShop, ...shop };
  }
  async function saveShopData(shop, data) {
    const response = await api("save", { method: "POST", body: { resource: "shops", id: shopId(shop), data } });
    updateShop(response.item || { ...shop, ...data });
    return response.item || { ...shop, ...data };
  }
  function refreshShopSelector() {
    const select = field("#ss-shop-select"); if (!select) return;
    const previous = select.value || shopId(state.activeShop);
    select.replaceChildren();
    (state.shops || []).forEach(shop => select.add(new Option(shop.Shop_name || shop.Shop_brand_name || `Shop ${shopId(shop)}`, shopId(shop))));
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
  function readAddress(shop) {
    const result = { phones: [], locations: [] };
    const raw = text(shop?.Shop_Adress_Information);
    raw.split("+").forEach(part => {
      const ix = part.indexOf("="); if (ix < 0) return;
      const key = part.slice(0, ix).trim(); const value = part.slice(ix + 1).replace(/=$/, "");
      if (key === "Phone Number") result.phones = value ? value.split("=").filter(Boolean) : [];
      if (key === "Location") result.locations = value ? value.split("=").filter(Boolean) : [];
    });
    return result;
  }
  function renderList(name, values) {
    const list = field(`#si-${name}-list`); if (!list) return;
    list.replaceChildren(); values.forEach((value, index) => { const item = document.createElement("li"); item.textContent = value; item.dataset.index = String(index); item.tabIndex = 0; item.addEventListener("click", () => { list.querySelectorAll("li").forEach(li => li.classList.remove("selected")); item.classList.add("selected"); }); list.append(item); });
  }
  function loadShopInfo() {
    refreshShopSelector(); const shop = currentShop(); if (!shop) return;
    const ownerSelect = field("#si-shop-owner"); ownerSelect.replaceChildren(new Option("Choose owner", ""));
    (state.users || []).forEach(user => ownerSelect.add(new Option([user.User_fname, user.User_Lname].filter(Boolean).join(" ") || user.User_name || `User ${user.User_id}`, text(user.User_id))));
    const owner = shop.Shop_owners_id ?? shop.Shop_oweners_id ?? "";
    const set = (selector, value) => { const el = field(selector); if (el) el.value = text(value); };
    set("#si-shop-name", shop.Shop_name); set("#si-brand-name", shop.Shop_brand_name); set("#si-shop-type", shop.Shop_type); set("#si-shop-owner", owner);
    set("#si-shop-email", shop.Shop_email); set("#si-shop-country", shop.Shop_country); set("#si-shop-currency", shop.Shop_currency || "ETB"); set("#si-shop-link", shop.Shop_link); set("#si-shop-contact", shop.Shop_contact); set("#si-shop-password", shop.Shop_password); set("#si-shop-about", shop.Shop_about);
    set("#si-shop-enabled", ""); field("#si-shop-enabled").checked = ["1", "true", "yes"].includes(text(shop.Shop_isenabled).toLowerCase());
    set("#si-shop-rate", shop.Shop_rate || 0);
    set("#ss-started-date", shop.Company_Started_Date ? `Since ${text(shop.Company_Started_Date).split(" ")[0].split("-")[0]}` : "");
    const address = readAddress(shop); shopLists = { phones: address.phones, locations: address.locations, social: text(shop.Shop_SocLinks).split("+").filter(Boolean), rules: text(shop.Shop_rules).split("+").filter(Boolean) };
    Object.entries(shopLists).forEach(([name, values]) => renderList(name, values));
    setMessage(field("#si-message"), "");
  }
  function addShopListValue(kind) {
    const inputId = { phones: "#si-phone-input", social: "#si-social-input", locations: "#si-location-input", rules: "#si-rule-input" }[kind];
    const value = field(inputId)?.value.trim(); if (!value) return;
    shopLists[kind].push(value); field(inputId).value = ""; renderList(kind, shopLists[kind]);
  }
  function removeShopListValue(kind) {
    const list = field(`#si-${kind}-list`); const chosen = list?.querySelector("li.selected"); if (!chosen) return;
    shopLists[kind].splice(Number(chosen.dataset.index), 1); renderList(kind, shopLists[kind]);
  }
  async function saveShopInfo() {
    const shop = currentShop(); if (!shop) return;
    const country = field("#si-shop-country").value.trim(); const currency = field("#si-shop-currency").value.trim().toUpperCase();
    if (!currency) return setMessage(field("#si-message"), "Shop currency is required.", "error");
    const address = `Phone Number=${shopLists.phones.join("=")}+Location=${shopLists.locations.join("=")}`;
    const data = {
      Shop_name: field("#si-shop-name").value.trim(), Shop_brand_name: field("#si-brand-name").value.trim(), Shop_type: field("#si-shop-type").value,
      Shop_owners_id: field("#si-shop-owner").value, Shop_email: field("#si-shop-email").value.trim(), Shop_country: country, Shop_currency: currency,
      Shop_link: field("#si-shop-link").value.trim(), Shop_contact: field("#si-shop-contact").value.trim(), Shop_password: field("#si-shop-password").value,
      Shop_about: field("#si-shop-about").value.trim(), Shop_isenabled: field("#si-shop-enabled").checked ? "1" : "0", Shop_rate: field("#si-shop-rate").value,
      Shop_SocLinks: shopLists.social.join("+"), Shop_rules: shopLists.rules.join("+"), Shop_Adress_Information: address
    };
    try { await saveShopData(shop, data); showToast("Shop information saved."); setMessage(field("#si-message"), "Shop information saved.", "success"); }
    catch (error) { setMessage(field("#si-message"), error.message, "error"); }
  }

  function allExpenses() {
    return (state.shops || []).flatMap(shop => parseArray(shop.Shop_Expenses).map((expense, index) => ({ shop, expense, index })));
  }
  function renderExpenses() {
    const body = field("#expenses-body"); if (!body) return;
    const shop = currentShop(); const query = (field("#expense-search")?.value || "").trim().toLowerCase();
    const rows = allExpenses().filter(item => shopId(item.shop) === shopId(shop) && (!query || item.expense.some(value => text(value).toLowerCase().includes(query))));
    body.replaceChildren();
    if (selectedExpense && !rows.some(row => shopId(row.shop) === selectedExpense.shopId && row.index === selectedExpense.index)) selectedExpense = null;
    rows.forEach((item, shownIndex) => {
      const row = document.createElement("tr"); row.dataset.expenseRow = String(shownIndex); if (selectedExpense && selectedExpense.shopId === shopId(item.shop) && selectedExpense.index === item.index) row.classList.add("manager-selected-row");
      const expense = item.expense; [item.index + 1, expense[0], formatMoney(Number(expense[2]) || 0, item.shop), expense[3] || "Other", expense[4], expense[5], expense[1], Number(expense[8]) ? `${expense[7] || "Monthly"} × ${expense[9] || 1}` : "No", item.shop.Shop_name].forEach(value => { const cell = document.createElement("td"); cell.textContent = text(value) || "-"; row.append(cell); }); body.append(row);
    });
    if (!rows.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 9; cell.className = "empty-state"; cell.textContent = "No expenses for this shop match the search."; row.append(cell); body.append(row); }
    field("#btn-edit-expense").disabled = !selectedExpense; field("#btn-delete-expense").disabled = !selectedExpense;
    const select = field("#expense-shop"); const chosen = select?.value || shopId(shop); if (select) { select.replaceChildren(); (state.shops || []).forEach(entry => select.add(new Option(entry.Shop_name, shopId(entry)))); if ([...select.options].some(option => option.value === chosen)) select.value = chosen; }
  }
  function openExpense(item = null) {
    selectedExpense = item ? { shopId: shopId(item.shop), index: item.index } : null;
    const form = field("#expense-form"); form.reset(); field("#expense-editor-title").textContent = item ? "Change Expense" : "New Expense";
    field("#expense-date").value = new Date().toISOString().slice(0, 10); field("#expense-shop").value = item ? shopId(item.shop) : (shopId(currentShop()) || "");
    if (item) { const e = item.expense; field("#expense-title").value = text(e[0]); field("#expense-description").value = text(e[1]); field("#expense-amount").value = text(e[2]); field("#expense-category").value = text(e[3] || "Other"); field("#expense-date").value = text(e[4]); field("#expense-ref").value = text(e[5]); field("#expense-notes").value = text(e[6]); field("#expense-frequency").value = text(e[7] || "Monthly"); field("#expense-repeats").checked = Boolean(Number(e[8])); field("#expense-interval").value = text(e[9] || 1); field("#expense-end").value = text(e[10]); }
    ["#expense-frequency", "#expense-interval", "#expense-end"].forEach(selector => { field(selector).disabled = !field("#expense-repeats").checked; });
    field("#expense-editor").hidden = false;
  }
  function selectedExpenseEntry() { return selectedExpense && allExpenses().find(row => shopId(row.shop) === selectedExpense.shopId && row.index === selectedExpense.index); }
  async function saveExpense(event) {
    event.preventDefault(); const entry = selectedExpenseEntry(); const shop = selectedExpense ? entry?.shop : (state.shops || []).find(s => shopId(s) === field("#expense-shop").value);
    if (!shop) return setMessage(field("#expense-message"), "Choose a shop.", "error");
    const repeats = field("#expense-repeats").checked ? 1 : 0;
    const value = [field("#expense-title").value.trim(), field("#expense-description").value.trim(), field("#expense-amount").value, field("#expense-category").value, field("#expense-date").value, field("#expense-ref").value.trim(), field("#expense-notes").value.trim(), field("#expense-frequency").value, repeats, repeats ? field("#expense-interval").value : 0, repeats ? field("#expense-end").value : ""];
    const list = parseArray(shop.Shop_Expenses);
    if (selectedExpense && entry) list[entry.index] = value; else list.push(value);
    try { await saveShopData(shop, { Shop_Expenses: JSON.stringify(list) }); field("#expense-editor").hidden = true; selectedExpense = null; renderExpenses(); showToast("Expense saved."); }
    catch (error) { setMessage(field("#expense-message"), error.message, "error"); }
  }
  async function deleteExpense() {
    const entry = selectedExpenseEntry(); if (!entry || !window.confirm(`Delete expense “${entry.expense[0]}”?`)) return;
    const list = parseArray(entry.shop.Shop_Expenses); list.splice(entry.index, 1);
    try { await saveShopData(entry.shop, { Shop_Expenses: JSON.stringify(list) }); selectedExpense = null; renderExpenses(); showToast("Expense deleted."); }
    catch (error) { showToast(error.message, true); }
  }

  function securityLevels(shop) {
    const saved = parseArray(shop?.Shop_Security_Levels);
    return ACCESS_TYPES.map((_, index) => Number.isFinite(Number(saved[index])) ? Number(saved[index]) : (index < 26 ? 0 : index < 33 ? 1 : index < 46 ? 2 : 3));
  }
  async function saveSecurityLevel(index, level) {
    const shop = currentShop(); const levels = securityLevels(shop); levels[index] = Number(level);
    try { await saveShopData(shop, { Shop_Security_Levels: JSON.stringify(levels) }); }
    catch (error) { showToast(error.message, true); }
  }
  function renderMatrix() {
    const body = field("#matrix-body"); if (!body) return;
    const shop = currentShop(); const levels = securityLevels(shop); body.replaceChildren();
    ACCESS_TYPES.forEach((permission, index) => {
      const row = document.createElement("tr"); const label = document.createElement("td"); label.textContent = permission;
      const cell = document.createElement("td"); const select = document.createElement("select"); select.className = "input permission-level"; [0,1,2,3,4].forEach(level => select.add(new Option(`Level ${level}`, level))); select.value = String(levels[index]); cell.append(select); row.append(label, cell); body.append(row);
    });
  }
  function shopWorkers(shop) { return parseArray(shop?.Shop_workers).filter(Array.isArray); }
  function accessValue(worker) { const value = worker?.[6]; return Array.isArray(value) ? value[0] : value; }
  function renderWorkers() {
    const body = field("#workers-body"); if (!body) return;
    const shop = currentShop(); const roster = shopWorkers(shop); const ownerId = String(shop?.Shop_owners_id ?? shop?.Shop_oweners_id ?? "");
    const users = state.users || []; const select = field("#worker-user-select"); const chosen = select.value;
    select.replaceChildren(new Option("Select a user to join", "")); users.forEach(user => select.add(new Option(`${user.User_fname || ""} ${user.User_Lname || ""} (${user.User_name || user.User_id})`.trim(), text(user.User_id))));
    if ([...select.options].some(option => option.value === chosen)) select.value = chosen;
    const rows = [];
    const owner = users.find(user => text(user.User_id) === ownerId);
    if (owner) rows.push({ id: owner.User_id, name: `${owner.User_fname || ""} ${owner.User_Lname || ""}`.trim(), user: owner.User_name, role: "OWNER", level: "10", owner: true });
    roster.forEach((worker, index) => { rows.push({ id: worker[0], name: worker[1], user: worker[2], role: worker[3] || "WORKER", level: accessValue(worker), index, owner: false }); });
    if (!rows.some(row => String(row.id) === selectedWorkerId)) selectedWorkerId = "";
    const query = (field("#worker-search")?.value || "").trim().toLowerCase();
    const visibleRows = rows.filter(worker => !query || [worker.id, worker.name, worker.user, worker.role, shop?.Shop_name, worker.level].some(value => text(value).toLowerCase().includes(query)));
    if (!visibleRows.some(row => String(row.id) === selectedWorkerId)) selectedWorkerId = "";
    body.replaceChildren(); visibleRows.forEach(worker => {
      const row = document.createElement("tr"); row.dataset.workerId = text(worker.id); row.dataset.workerIndex = text(worker.index); if (String(worker.id) === selectedWorkerId) row.classList.add("manager-selected-row");
      [worker.id, worker.name, worker.user, worker.role, shop.Shop_name, worker.level === -2 || worker.level === "-2" ? "Request pending" : `Level ${worker.level ?? -1}`].forEach(value => { const cell = document.createElement("td"); cell.textContent = text(value); row.append(cell); }); body.append(row);
    });
    field("#btn-change-worker-level").disabled = !selectedWorkerId || selectedWorkerId === ownerId; field("#btn-remove-worker").disabled = !selectedWorkerId || selectedWorkerId === ownerId;
    field("#worker-level").disabled = !selectedWorkerId || selectedWorkerId === ownerId;
    if (selectedWorkerId) { const worker = roster.find(item => text(item[0]) === selectedWorkerId); if (worker) field("#worker-level").value = text(accessValue(worker) ?? -2); }
  }
  async function joinWorker() {
    const shop = currentShop(); const user = (state.users || []).find(item => text(item.User_id) === field("#worker-user-select").value);
    if (!shop || !user) return showToast("Choose a user to add to this shop.", true);
    const roster = shopWorkers(shop); if (roster.some(worker => text(worker[0]) === text(user.User_id))) return showToast("This user is already assigned to the shop.", true);
    roster.push([user.User_id, `${user.User_fname || ""} ${user.User_Lname || ""}`.trim() || user.User_name, user.User_name, "WORKER", shop.Shop_name, shop.Shop_brand_name, [-2]]);
    const userWork = parseArray(user.User_work_shop); const placeIndex = userWork.findIndex(item => Array.isArray(item) && text(item[0]) === shopId(shop));
    const assignment = [shop.Shop_Id, shop.Shop_name, shop.Shop_brand_name, [-1]]; if (placeIndex >= 0) userWork[placeIndex] = assignment; else userWork.push(assignment);
    try { const updated = await saveShopData(shop, { Shop_workers: JSON.stringify(roster) }); const userResult = await api("save", { method: "POST", body: { resource: "users", id: user.User_id, data: { User_work_shop: JSON.stringify(userWork) } } }); state.users = state.users.map(item => text(item.User_id) === text(user.User_id) ? { ...item, ...(userResult.item || {}), User_work_shop: JSON.stringify(userWork) } : item); selectedWorkerId = text(user.User_id); renderWorkers(); showToast("Worker added to the shop."); }
    catch (error) { showToast(error.message, true); }
  }
  async function changeWorkerLevel() {
    const shop = currentShop(); const roster = shopWorkers(shop); const worker = roster.find(item => text(item[0]) === selectedWorkerId); if (!worker) return;
    const level = field("#worker-level").value; worker[6] = level;
    const user = (state.users || []).find(item => text(item.User_id) === selectedWorkerId); const work = parseArray(user?.User_work_shop);
    const match = work.find(item => Array.isArray(item) && text(item[0]) === shopId(shop)); if (match) match[3] = [level];
    try { await saveShopData(shop, { Shop_workers: JSON.stringify(roster) }); if (user) { const res = await api("save", { method: "POST", body: { resource: "users", id: user.User_id, data: { User_work_shop: JSON.stringify(work) } } }); state.users = state.users.map(item => text(item.User_id) === selectedWorkerId ? { ...item, ...(res.item || {}), User_work_shop: JSON.stringify(work) } : item); } renderWorkers(); showToast("Worker access level updated."); }
    catch (error) { showToast(error.message, true); }
  }
  async function removeWorker() {
    const shop = currentShop(); const user = (state.users || []).find(item => text(item.User_id) === selectedWorkerId); if (!shop || !user || !window.confirm(`Remove ${user.User_name} from ${shop.Shop_name}?`)) return;
    const roster = shopWorkers(shop).filter(worker => text(worker[0]) !== selectedWorkerId); const work = parseArray(user.User_work_shop).filter(item => !Array.isArray(item) || text(item[0]) !== shopId(shop));
    try { await saveShopData(shop, { Shop_workers: JSON.stringify(roster) }); const res = await api("save", { method: "POST", body: { resource: "users", id: user.User_id, data: { User_work_shop: JSON.stringify(work) } } }); state.users = state.users.map(item => text(item.User_id) === selectedWorkerId ? { ...item, ...(res.item || {}), User_work_shop: JSON.stringify(work) } : item); selectedWorkerId = ""; renderWorkers(); showToast("Worker removed from the shop."); }
    catch (error) { showToast(error.message, true); }
  }

  function nestedCategories(shop) { const data = parseArray(shop?.Shop_Items_type); return data.length ? data : structuredClone(DEFAULT_CATEGORIES); }
  function getAtPath(list, path) { let current = list; for (const index of path) { if (!current[index]) return null; current = current[index][1]; } return current; }
  async function saveCategories(shop) {
    try { await saveShopData(shop, { Shop_Items_type: JSON.stringify(categoryTree) }); setMessage(field("#other-settings-message"), "Category tree saved.", "success"); }
    catch (error) { setMessage(field("#other-settings-message"), error.message, "error"); }
  }
  function renderCategoryNodes(list, parent, path = []) {
    list.forEach(([name, children], index) => {
      const li = document.createElement("li"); li.textContent = name; li.tabIndex = 0; li.dataset.path = JSON.stringify([...path, index]);
      if (JSON.stringify([...path, index]) === JSON.stringify(selectedCategoryPath)) li.classList.add("selected");
      li.addEventListener("click", event => { event.stopPropagation(); selectedCategoryPath = JSON.parse(li.dataset.path); field("#category-path").textContent = `\\${selectedCategoryPath.map((part, depth) => { let cur = categoryTree; let value = ""; for (let i = 0; i <= depth; i++) { value = cur[selectedCategoryPath[i]][0]; cur = cur[selectedCategoryPath[i]][1]; } return value; }).join("\\")}`; renderOthers(false); });
      parent.append(li); if (children?.length) { const ul = document.createElement("ul"); ul.className = "simple-list category-tree-children"; li.append(ul); renderCategoryNodes(children, ul, [...path, index]); }
    });
  }
  async function saveSlipSettings(shop) {
    try { await saveShopData(shop, { Shop_Slip_Settings: JSON.stringify(slipSettings) }); }
    catch (error) { showToast(error.message, true); }
  }
  function loadSlipSettings(shop) {
    const saved = parseArray(shop?.Shop_Slip_Settings);
    slipSettings = saved.length >= 3 ? saved : ["40", "20", []];
    if (!Array.isArray(slipSettings[2])) slipSettings[2] = [];
    field("#slip-width").value = text(slipSettings[0] || 40); field("#slip-height").value = text(slipSettings[1] || 20);
  }
  function renderSlipList() {
    const list = field("#slip-layout-list"); if (!list) return; list.replaceChildren();
    slipSettings[2].forEach((entry, index) => { const id = Array.isArray(entry) ? Number(entry[0]) : Number(entry); const li = document.createElement("li"); li.textContent = `${index + 1}. ${SLIP_FIELDS[id] || "Unknown"}`; li.dataset.index = String(index); li.tabIndex = 0; li.addEventListener("click", () => { list.querySelectorAll("li").forEach(row => row.classList.remove("selected")); li.classList.add("selected"); }); list.append(li); });
  }
  function renderOthers(reset = true) {
    const shop = currentShop(); if (!shop) return;
    if (reset || !categoryTree.length) { categoryTree = nestedCategories(shop); selectedCategoryPath = []; field("#category-path").textContent = "No selection"; }
    const tree = field("#category-tree-list"); if (tree) { tree.replaceChildren(); renderCategoryNodes(categoryTree, tree); }
    const select = field("#slip-field"); if (select && !select.options.length) SLIP_FIELDS.forEach((name, index) => select.add(new Option(name, index)));
    loadSlipSettings(shop); renderSlipList();
  }
  async function addCategory() {
    const name = field("#category-value").value.trim(); if (!name) return;
    const target = getAtPath(categoryTree, selectedCategoryPath); (target || categoryTree).push([name, []]); field("#category-value").value = ""; renderOthers(false); await saveCategories(currentShop());
  }
  async function deleteCategory() {
    if (!selectedCategoryPath.length) return showToast("Select a category to delete.", true);
    const parent = getAtPath(categoryTree, selectedCategoryPath.slice(0, -1)); (parent || categoryTree).splice(selectedCategoryPath.at(-1), 1); selectedCategoryPath = []; field("#category-path").textContent = "No selection"; renderOthers(false); await saveCategories(currentShop());
  }
  async function resetCategories() { categoryTree = structuredClone(DEFAULT_CATEGORIES); selectedCategoryPath = []; renderOthers(false); await saveCategories(currentShop()); }

  function bindShopSettingsEvents() {
    ["info", "expenses", "workers", "others"].forEach(tab => $(`#tab-shop-${tab}`)?.addEventListener("click", () => {
      ["info", "expenses", "workers", "others"].forEach(name => { $(`#tab-shop-${name}`)?.classList.toggle("active", name === tab); $(`#panel-shop-${name}`)?.classList.toggle("hidden", name !== tab); });
      if (tab === "info") loadShopInfo(); if (tab === "expenses") renderExpenses(); if (tab === "workers") { renderMatrix(); renderWorkers(); } if (tab === "others") renderOthers();
    }));
    field("#ss-shop-select")?.addEventListener("change", () => { selectedExpense = null; selectedWorkerId = ""; categoryTree = []; loadShopInfo(); renderExpenses(); renderMatrix(); renderWorkers(); renderOthers(); });
    field("#si-save-btn")?.addEventListener("click", saveShopInfo);
    document.querySelector("#panel-shop-info")?.addEventListener("click", event => { const add = event.target.closest("[data-shop-list-add]"); if (add) addShopListValue(add.dataset.shopListAdd); const remove = event.target.closest("[data-shop-list-remove]"); if (remove) removeShopListValue(remove.dataset.shopListRemove); });
    field("#btn-add-expense")?.addEventListener("click", () => openExpense()); field("#btn-edit-expense")?.addEventListener("click", () => { const entry = selectedExpenseEntry(); if (entry) openExpense(entry); }); field("#btn-delete-expense")?.addEventListener("click", deleteExpense);
    field("#expense-search")?.addEventListener("input", renderExpenses); field("#expenses-body")?.addEventListener("click", event => { const row = event.target.closest("tr[data-expense-row]"); if (!row) return; const entries = allExpenses().filter(item => shopId(item.shop) === shopId(currentShop()) && (!(field("#expense-search")?.value || "").trim() || item.expense.some(value => text(value).toLowerCase().includes(field("#expense-search").value.trim().toLowerCase())))); const item = entries[Number(row.dataset.expenseRow)]; if (item) selectedExpense = { shopId: shopId(item.shop), index: item.index }; renderExpenses(); });
    field("#expense-form")?.addEventListener("submit", saveExpense); field("#expense-cancel")?.addEventListener("click", () => { field("#expense-editor").hidden = true; selectedExpense = null; }); field("#expense-repeats")?.addEventListener("change", event => { ["#expense-frequency", "#expense-interval", "#expense-end"].forEach(selector => { field(selector).disabled = !event.target.checked; }); });
    field("#matrix-body")?.addEventListener("change", event => { if (event.target.matches(".permission-level")) { const index = [...field("#matrix-body").querySelectorAll("select")].indexOf(event.target); saveSecurityLevel(index, event.target.value); } });
    field("#workers-body")?.addEventListener("click", event => { const row = event.target.closest("tr[data-worker-id]"); if (!row) return; selectedWorkerId = row.dataset.workerId; renderWorkers(); });
    field("#worker-search")?.addEventListener("input", renderWorkers); field("#btn-join-worker")?.addEventListener("click", joinWorker); field("#btn-change-worker-level")?.addEventListener("click", changeWorkerLevel); field("#btn-remove-worker")?.addEventListener("click", removeWorker);
    field("#category-add")?.addEventListener("click", addCategory); field("#category-delete")?.addEventListener("click", deleteCategory); field("#category-default")?.addEventListener("click", resetCategories);
    field("#slip-add")?.addEventListener("click", async () => { slipSettings[2].push([Number(field("#slip-field").value)]); renderSlipList(); await saveSlipSettings(currentShop()); });
    field("#slip-delete")?.addEventListener("click", async () => { const selected = field("#slip-layout-list li.selected"); if (!selected) return; slipSettings[2].splice(Number(selected.dataset.index), 1); renderSlipList(); await saveSlipSettings(currentShop()); });
    field("#slip-up")?.addEventListener("click", () => moveSlip(-1)); field("#slip-down")?.addEventListener("click", () => moveSlip(1));
    field("#slip-width")?.addEventListener("change", () => { slipSettings[0] = field("#slip-width").value; saveSlipSettings(currentShop()); }); field("#slip-height")?.addEventListener("change", () => { slipSettings[1] = field("#slip-height").value; saveSlipSettings(currentShop()); });
  }
  async function moveSlip(direction) { const selected = field("#slip-layout-list li.selected"); if (!selected) return; const index = Number(selected.dataset.index); const next = index + direction; if (next < 0 || next >= slipSettings[2].length) return; [slipSettings[2][index], slipSettings[2][next]] = [slipSettings[2][next], slipSettings[2][index]]; renderSlipList(); field(`#slip-layout-list li[data-index="${next}"]`)?.classList.add("selected"); await saveSlipSettings(currentShop()); }

  return { loadShopInfo, renderExpenses, renderMatrix, renderWorkers, renderOthers, bindShopSettingsEvents };
})();
