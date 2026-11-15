"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const totalOutput = document.querySelector("#grand-total");
const discountInput = document.querySelector("#discount-rate");
const vatInput = document.querySelector("#vat-rate");
const currencyInput = document.querySelector("#currency");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

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

function addItem(focus = true) {
  const row = template.content.firstElementChild.cloneNode(true);
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  recalculate();
}

document.querySelector("#add-item").addEventListener("click", () => addItem());
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
});

items.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing && event.target.matches("input") &&
      event.target.closest("tr") === items.lastElementChild) {
    event.preventDefault();
    addItem();
  }
});

const today = new Date();
document.querySelector("#estimate-date").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
addItem(false);
