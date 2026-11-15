"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const totalOutput = document.querySelector("#grand-total");
const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

function parseNumber(value) {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) && number <= Number.MAX_SAFE_INTEGER ? number : 0;
}

function formatMoney(value) {
  return `${moneyFormatter.format(Number.isFinite(value) ? value : 0).replace(/[\u00a0\u202f]/g, " ")} ₸`;
}

function recalculate() {
  let totalCents = 0;
  for (const row of items.rows) {
    const quantity = parseNumber(row.querySelector(".item-quantity").value);
    const price = parseNumber(row.querySelector(".item-price").value);
    const cents = Math.round(quantity * price * 100);
    const lineCents = Number.isSafeInteger(cents) ? cents : 0;
    row.querySelector(".line-total").textContent = formatMoney(lineCents / 100);
    totalCents += lineCents;
  }
  totalOutput.textContent = formatMoney(totalCents / 100);
}

function addItem(focus = true) {
  const row = template.content.firstElementChild.cloneNode(true);
  items.append(row);
  if (focus) row.querySelector(".item-name").focus();
  recalculate();
}

document.querySelector("#add-item").addEventListener("click", () => addItem());
items.addEventListener("input", recalculate);

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
