/**
 * getvalue.js - Keypad Calculator Modal / GetValueDialog
 */
window.HiperGetValue = (() => {
  "use strict";

  const { $, $$ } = window.HiperApi;

  let keypadTarget = null;
  let justCalculated = false;

  function openKeypadDialog(title, initialVal, onConfirm) {
    if ($("#keypad-title")) $("#keypad-title").textContent = title;
    if ($("#keypad-input")) $("#keypad-input").value = String(initialVal ?? "0");
    justCalculated = false;
    keypadTarget = onConfirm;
    const dialog = $("#keypad-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function calculateExpression(expression) {
    const source = String(expression).replace(/\s+/g, "");
    const tokens = source.match(/(?:\d+\.?\d*|\.\d+)|[+*/-]/g) || [];
    if (!source || tokens.join("") !== source) return null;
    const values = [];
    const operators = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };
    const apply = () => {
      const op = operators.pop();
      const right = values.pop();
      const left = values.pop();
      if (left === undefined || right === undefined || (op === "/" && right === 0)) return false;
      values.push(op === "+" ? left + right : op === "-" ? left - right : op === "*" ? left * right : left / right);
      return true;
    };
    let expectingNumber = true;
    for (const token of tokens) {
      if (/^(?:\d+\.?\d*|\.\d+)$/.test(token)) {
        if (!expectingNumber) return null;
        values.push(Number(token));
        expectingNumber = false;
      } else {
        if (expectingNumber) return null;
        while (operators.length && precedence[operators[operators.length - 1]] >= precedence[token]) if (!apply()) return null;
        operators.push(token);
        expectingNumber = true;
      }
    }
    if (expectingNumber) return null;
    while (operators.length) if (!apply()) return null;
    return values.length === 1 && Number.isFinite(values[0]) ? String(Number(values[0].toFixed(8))) : null;
  }

  function bindKeypadEvents() {
    $$(".keypad-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        const input = $("#keypad-input");
        if (!input) return;
        if (key === "clear") {
          input.value = "0";
          justCalculated = false;
        } else if (key === "=") {
          const result = calculateExpression(input.value);
          if (result !== null) { input.value = result; justCalculated = true; }
          else { input.setCustomValidity("Enter a valid calculation."); justCalculated = false; }
        } else {
          input.setCustomValidity("");
          if ("+-*/".includes(key)) {
            if (/[+*/-]$/.test(input.value)) input.value = input.value.slice(0, -1) + key;
            else input.value += key;
            justCalculated = false;
          } else if (key === ".") {
            if (justCalculated) { input.value = "0"; justCalculated = false; }
            const currentNumber = input.value.split(/[+*/-]/).pop();
            if (!currentNumber.includes(".")) input.value += currentNumber ? "." : "0.";
          } else if (justCalculated || input.value === "0") {
            input.value = key;
            justCalculated = false;
          } else input.value += key;
        }
      });
    });

    $("#keypad-input")?.addEventListener("input", () => {
      justCalculated = false;
      $("#keypad-input").setCustomValidity("");
    });

    $("#keypad-confirm-btn")?.addEventListener("click", () => {
      if (typeof keypadTarget === "function") {
        const input = $("#keypad-input");
        const expression = input ? input.value : "0";
        const result = calculateExpression(expression);
        if (result === null) {
          input?.setCustomValidity("Enter a valid calculation.");
          input?.reportValidity();
          return;
        }
        keypadTarget(result);
      }
      $("#keypad-dialog")?.close();
    });
  }

  return {
    openKeypadDialog,
    bindKeypadEvents
  };
})();
