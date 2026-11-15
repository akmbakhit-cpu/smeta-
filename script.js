"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const totalOutput = document.querySelector("#grand-total");
const discountInput = document.querySelector("#discount-rate");
const vatInput = document.querySelector("#vat-rate");
const currencyInput = document.querySelector("#currency");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const draftKey = "smeta-five-minutes-draft-v1";
const draftFieldIds = ["sender", "recipient", "estimate-number", "estimate-date", "discount-rate", "vat-rate", "currency", "comment"];
const itemFields = { name: ".item-name", quantity: ".item-quantity", unit: ".item-unit", price: ".item-price" };
let copyStatusTimer;

function parseNumber(value) {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) && number <= Number.MAX_SAFE_INTEGER ? number : 0;
}

function formatMoney(value) {
  return `${moneyFormatter.format(Number.isFinite(value) ? value : 0).replace(/[\u00a0\u202f]/g, " ")} ${currencyInput.value}`;
}

function roundAmount(value) {
  const rounded = Math.round(value);
  return Number.isSafeInteger(rounded) ? rounded : 0;
}

function updateSummary(outputId, value, rowId) {
  document.querySelector(outputId).textContent = formatMoney(value);
  if (rowId) document.querySelector(rowId).hidden = value === 0;
}

function recalculate() {
  let subtotal = 0;
  for (const row of items.rows) {
    const quantity = parseNumber(row.querySelector(".item-quantity").value);
    const price = parseNumber(row.querySelector(".item-price").value);
    const lineAmount = roundAmount(quantity * price);
    row.querySelector(".line-total").textContent = formatMoney(lineAmount);
    subtotal += lineAmount;
  }
  subtotal = roundAmount(subtotal);
  const discountRate = Math.min(100, parseNumber(discountInput.value));
  const discount = roundAmount(subtotal * (discountRate / 100));
  const discountedSubtotal = subtotal - discount;
  const vat = roundAmount(discountedSubtotal * (parseNumber(vatInput.value) / 100));
  updateSummary("#subtotal", subtotal);
  updateSummary("#discount-amount", discount, "#discount-row");
  updateSummary("#discounted-subtotal", discountedSubtotal, "#discounted-row");
  updateSummary("#vat-amount", vat, "#vat-row");
  totalOutput.textContent = formatMoney(roundAmount(discountedSubtotal + vat));
  document.querySelectorAll("[data-currency-symbol]").forEach((label) => {
    label.textContent = currencyInput.value;
  });
}

function addItem(focus = true, values = {}) {
  const row = template.content.firstElementChild.cloneNode(true);
  for (const [key, selector] of Object.entries(itemFields)) {
    if (typeof values[key] === "string" && (key !== "unit" || ["шт", "час", "услуга"].includes(values[key]))) {
      row.querySelector(selector).value = values[key];
    }
  }
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  recalculate();
}

document.querySelector("#add-item").addEventListener("click", () => {
  addItem();
  saveDraft();
});
items.addEventListener("input", recalculate);
discountInput.addEventListener("input", recalculate);
vatInput.addEventListener("input", recalculate);
currencyInput.addEventListener("change", recalculate);

items.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-button");
  if (!button) return;
  const row = button.closest("tr");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  if (nextRow) {
    nextRow.querySelector(".item-name").focus();
    recalculate();
  } else {
    addItem();
  }
  saveDraft();
});

items.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing && event.target.matches("input") &&
      event.target.closest("tr") === items.lastElementChild) {
    event.preventDefault();
    addItem();
    saveDraft();
  }
});

function todayValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function estimateHeading() {
  const number = document.querySelector("#estimate-number").value.trim() || "—";
  const date = document.querySelector("#estimate-date").value;
  const formattedDate = date ? date.split("-").reverse().join(".") : "—";
  return `Смета № ${number} от ${formattedDate}`;
}

function preparePrint() {
  recalculate();
  document.querySelector("#print-title").textContent = estimateHeading();

  // Text copies wrap on paper, so long names and comments are not clipped by controls.
  document.querySelectorAll(".details-grid input, #items input, #items select, #comment").forEach((field) => {
    let value = field.nextElementSibling;
    if (!value || !value.classList.contains("print-value")) {
      value = document.createElement("span");
      value.className = "print-value";
      value.setAttribute("aria-hidden", "true");
      field.after(value);
    }
    value.textContent = field.value;
  });
}

window.addEventListener("beforeprint", preparePrint);
document.querySelector("#save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});

function saveDraft() {
  const fields = Object.fromEntries(draftFieldIds.map((id) => [id, document.getElementById(id).value]));
  const rows = Array.from(items.rows, (row) => Object.fromEntries(
    Object.entries(itemFields).map(([key, selector]) => [key, row.querySelector(selector).value])
  ));
  try {
    localStorage.setItem(draftKey, JSON.stringify({ fields, rows }));
    document.querySelector("#draft-status").textContent = "Черновик сохраняется в этом браузере. Данные не отправляются в интернет.";
  } catch {
    document.querySelector("#draft-status").textContent = "Браузер не разрешает сохранить черновик. Перед закрытием сохраните PDF или скопируйте смету.";
  }
}

function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey));
    if (!draft || !draft.fields || !Array.isArray(draft.rows)) return false;
    for (const id of draftFieldIds) {
      const value = draft.fields[id];
      if (typeof value === "string" && (id !== "currency" || ["₸", "₽", "$", "€"].includes(value))) {
        document.getElementById(id).value = value;
      }
    }
    for (const row of draft.rows) {
      if (row && typeof row === "object") addItem(false, row);
    }
    if (!items.rows.length) addItem(false);
    recalculate();
    return true;
  } catch {
    return false;
  }
}

for (const eventName of ["input", "change"]) {
  document.addEventListener(eventName, (event) => {
    if (draftFieldIds.includes(event.target.id) || event.target.closest("#items")) saveDraft();
  });
}

function clearCopyFeedback() {
  clearTimeout(copyStatusTimer);
  document.querySelector("#copy-status").textContent = "";
  document.querySelector("#share-fallback").hidden = true;
  document.querySelector("#share-text").value = "";
}

document.querySelector("#new-estimate").addEventListener("click", () => {
  if (!window.confirm("Создать новую смету? Текущий черновик будет очищен.")) return;
  const currentNumber = document.querySelector("#estimate-number").value.trim();
  // Keep a prefix and leading zeroes, for example КП-009 → КП-010.
  const match = currentNumber.match(/^(.*?)(\d+)$/);
  const nextNumber = match ? match[1] + String(BigInt(match[2]) + 1n).padStart(match[2].length, "0") : "1";
  for (const id of draftFieldIds) document.getElementById(id).value = "";
  discountInput.value = "0";
  vatInput.value = "0";
  currencyInput.value = "₸";
  document.querySelector("#estimate-number").value = nextNumber;
  document.querySelector("#estimate-date").value = todayValue();
  items.replaceChildren();
  document.querySelectorAll(".print-value").forEach((value) => value.remove());
  document.querySelector("#print-title").textContent = "";
  clearCopyFeedback();
  addItem();
  saveDraft();
});

function buildShareText() {
  recalculate();
  const lines = [estimateHeading()];
  for (const [id, label] of [["sender", "От кого"], ["recipient", "Для кого"]]) {
    const value = document.getElementById(id).value.trim();
    if (value) lines.push(`${label}: ${value}`);
  }
  lines.push("");
  const quantityFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 20 });
  for (const row of items.rows) {
    const name = row.querySelector(".item-name").value.trim();
    const quantity = row.querySelector(".item-quantity").value;
    const price = row.querySelector(".item-price").value;
    if (!name && !quantity.trim() && !price.trim()) continue;
    const formattedQuantity = quantityFormatter.format(parseNumber(quantity)).replace(/[\u00a0\u202f]/g, " ");
    lines.push(`• ${name || "Без названия"} — ${formattedQuantity} ${row.querySelector(".item-unit").value} × ${formatMoney(parseNumber(price))} = ${row.querySelector(".line-total").textContent}`);
  }
  lines.push("", `Сумма: ${document.querySelector("#subtotal").textContent}`);
  for (const [rowId, label, outputId] of [
    ["discount-row", "Скидка", "discount-amount"],
    ["discounted-row", "Сумма со скидкой", "discounted-subtotal"],
    ["vat-row", "НДС", "vat-amount"]
  ]) {
    if (!document.getElementById(rowId).hidden) lines.push(`${label}: ${document.getElementById(outputId).textContent}`);
  }
  lines.push(`Итого к оплате: ${totalOutput.textContent}`);
  const comment = document.querySelector("#comment").value.trim();
  if (comment) lines.push("", `Комментарий: ${comment}`);
  return lines.join("\n");
}

document.querySelector("#copy-whatsapp").addEventListener("click", async () => {
  const text = buildShareText();
  clearCopyFeedback();
  try {
    await navigator.clipboard.writeText(text);
    document.querySelector("#copy-status").textContent = "Скопировано ✓";
    copyStatusTimer = setTimeout(() => {
      document.querySelector("#copy-status").textContent = "";
    }, 2000);
  } catch {
    const field = document.querySelector("#share-text");
    field.value = text;
    document.querySelector("#share-fallback").hidden = false;
    field.focus();
    field.select();
  }
});

document.querySelector("#estimate-date").value = todayValue();
if (!restoreDraft()) addItem(false);
saveDraft();
