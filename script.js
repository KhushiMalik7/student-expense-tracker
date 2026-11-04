const STORAGE_KEY = 'pennywise.transactions.v1';
const BUDGET_KEY = 'pennywise.budget.v1';
const categories = {
    Food: { icon: '☕', color: '#75b48e', tint: '#e8f4ec' },
    Transport: { icon: '⌁', color: '#f1c69f', tint: '#fcf2e9' },
    Books: { icon: '▤', color: '#b8acd8', tint: '#f1eef8' },
    Housing: { icon: '⌂', color: '#a8ced1', tint: '#eaf4f4' },
    Entertainment: { icon: '✳', color: '#e6a992', tint: '#faefeb' },
    Other: { icon: '•', color: '#c7cec8', tint: '#f0f2ef' },
    Income: { icon: '↙', color: '#75b48e', tint: '#e8f4ec' }
};
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const shortMoney = value => '$' + Math.round(value).toLocaleString('en-US');
const dateToday = () => new Date().toISOString().slice(0, 10);
let transactions = readTransactions();
let budget = Number(localStorage.getItem(BUDGET_KEY)) || 800;
let editingId = null;

function readTransactions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }
function inCurrentMonth(date) {
    const d = new Date(`${date}T12:00:00`), now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
} function monthTransactions() { return transactions.filter(t => inCurrentMonth(t.date)); }
function totals(items) {
    return items.reduce((acc, item) => { acc[item.type] += Number(item.amount); return acc; }, { income: 0, expense: 0 });
}
function formatDate(date) {
    const d = new Date(`${date}T12:00:00`);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}
function render() {
    const current = monthTransactions();
    const sums = totals(current), spent = sums.expense;
    document.querySelector('#balance-value').textContent = money(sums.income - sums.expense);
    document.querySelector('#income-trend').textContent = `${money(sums.income)} in`;
    document.querySelector('#budget-value').textContent = money(budget);
    document.querySelector('#spent-value').textContent = money(spent);
    const pct = budget ? Math.min(100, spent / budget * 100) : 0;
    document.querySelector('#budget-progress').style.width = `${pct}%`;
    document.querySelector('#budget-caption').textContent = spent > budget ? `${money(spent - budget)} over budget` : `${money(Math.max(0, budget - spent))} left this month`;
    renderCategories(current, spent);
    renderChart();
    renderTransactions();
}
function renderCategories(items, spent) {
    const groups = {};
    items.filter(t => t.type === 'expense').forEach(t => groups[t.category] = (groups[t.category] || 0) + Number(t.amount));
    const list = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    document.querySelector('#donut-total').textContent = shortMoney(spent);
    const palette = list.map(([name]) => categories[name]?.color || categories.Other.color);
    let start = 0;
    const stops = list.map(([, amount], i) => { const end = start + (spent ? amount / spent * 100 : 0); const segment = `${palette[i]} ${start}% ${end}%`; start = end; return segment; });
    if (start < 100) stops.push(`#e9e9e2 ${start}% 100%`);
    document.querySelector('#donut').style.background = `conic-gradient(${stops.length ? stops.join(',') : '#e9e9e2 0 100%'})`;
    const visible = list.length ? list.slice(0, 5) : [['No spending yet', 0]];
    document.querySelector('#category-legend').innerHTML = visible.map(([name, amount]) => `<div class="legend-item"><i style="background:${categories[name]?.color || '#d7ddd7'}"></i><span>${escapeHtml(name)}</span><b>${spent ? Math.round(amount / spent * 100) : 0}%</b></div>`).join('');
}
function renderChart() {
    const period = document.querySelector('#chart-period').value;
    const source = period === 'all' ? transactions : monthTransactions();
    const expenses = source.filter(t => t.type === 'expense');
    const total = expenses.reduce((n, t) => n + Number(t.amount), 0);
    document.querySelector('#chart-total').innerHTML = `${shortMoney(total)} <small>${period === 'all' ? 'spent all time' : 'spent this month'}</small>`;
    const days = [...Array(7)].map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        return expenses.filter(t => t.date === key).reduce((n, t) => n + Number(t.amount), 0);
    });
    const max = Math.max(60, ...days), pts = days.map((v, i) => [i * 100, 180 - v / max * 150]);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
    document.querySelector('#chart-line').setAttribute('d', path);
    document.querySelector('#chart-area').setAttribute('d', `${path} L600 205 L0 205 Z`);
    const circle = document.querySelector('.chart circle'); circle.setAttribute('cx', pts[6][0]); circle.setAttribute('cy', pts[6][1]);
}
function renderTransactions() {
    const list = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);
    const container = document.querySelector('#transaction-list');
    document.querySelector('#empty-state').classList.toggle('visible', !list.length);
    container.innerHTML = list.map(t => {
        const meta = categories[t.category] || categories.Other;
        const sign = t.type === 'income' ? '+' : '−';
        return `<div class="transaction-row" data-id="${t.id}"><div class="transaction-icon" style="background:${meta.tint};color:${meta.color}">${meta.icon}</div><div><div class="transaction-name">${escapeHtml(t.note || t.category)}</div><div class="transaction-meta">${escapeHtml(t.category)} · ${formatDate(t.date)}</div></div><div class="transaction-amount ${t.type}">${sign}${money(Number(t.amount))}</div><div class="transaction-actions"><button data-action="edit" aria-label="Edit transaction">Edit</button><button data-action="delete" aria-label="Delete transaction">Delete</button></div></div>`;
    }).join('');
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
const dialog = document.querySelector('#transaction-dialog');
const form = document.querySelector('#transaction-form');
function updateCategoryOptions(selected = 'Food') {
    const type = form.elements.type.value;
    const available = type === 'income' ? ['Income', 'Other'] : ['Food', 'Transport', 'Books', 'Housing', 'Entertainment', 'Other'];
    document.querySelector('#category').innerHTML = available.map(cat => `<option ${cat === selected ? 'selected' : ''}>${cat}</option>`).join('');
}
function openTransaction(item = null) {
    editingId = item?.id || null;
    form.reset();
    document.querySelector('#dialog-title').textContent = item ? 'Edit transaction' : 'Add a transaction';
    form.elements.type.value = item?.type || 'expense';
    updateCategoryOptions(item?.category || (item?.type === 'income' ? 'Income' : 'Food'));
    document.querySelector('#amount').value = item?.amount || '';
    document.querySelector('#date').value = item?.date || dateToday();
    document.querySelector('#note').value = item?.note || '';
    dialog.showModal();
}
document.querySelector('#add-transaction').addEventListener('click', () => openTransaction());
document.querySelector('#empty-add').addEventListener('click', () => openTransaction());
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
form.querySelectorAll('[name="type"]').forEach(el => el.addEventListener('change', () => updateCategoryOptions()));
form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const record = { id: editingId || crypto.randomUUID(), type: data.get('type'), amount: Number(data.get('amount')), category: data.get('category'), date: data.get('date'), note: data.get('note').trim(), createdAt: Date.now() };
    if (editingId) transactions = transactions.map(t => t.id === editingId ? { ...t, ...record, createdAt: t.createdAt } : t);
    else transactions.push(record);
    persist(); render(); dialog.close();
});
document.querySelector('#transaction-list').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    const row = button.closest('.transaction-row'); const item = transactions.find(t => t.id === row.dataset.id);
    if (button.dataset.action === 'edit') openTransaction(item);
    if (button.dataset.action === 'delete' && confirm('Delete this transaction?')) { transactions = transactions.filter(t => t.id !== item.id); persist(); render(); }
});
const budgetDialog = document.querySelector('#budget-dialog');
document.querySelectorAll('[data-view="budget"]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); document.querySelector('#budget-input').value = budget; budgetDialog.showModal(); }));
document.querySelector('[data-close-budget]').addEventListener('click', () => budgetDialog.close());
document.querySelector('#budget-form').addEventListener('submit', event => { event.preventDefault(); budget = Number(document.querySelector('#budget-input').value); localStorage.setItem(BUDGET_KEY, String(budget)); render(); budgetDialog.close(); });
document.querySelector('#chart-period').addEventListener('change', renderChart);
document.querySelector('#all-categories').addEventListener('click', () => document.querySelector('.categories-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }));
document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
document.querySelector('#menu-toggle').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active')); link.classList.add('active');
    const view = link.dataset.view, name = view === 'home' ? 'Overview' : view[0].toUpperCase() + view.slice(1);
    document.querySelector('#page-name').textContent = name;
    if (view === 'transactions') document.querySelector('#transactions-section').scrollIntoView({ behavior: 'smooth' });
    if (view === 'reports') document.querySelector('.content-grid').scrollIntoView({ behavior: 'smooth' });
    if (view === 'budget') { document.querySelector('#budget-input').value = budget; budgetDialog.showModal(); }
    document.querySelector('#sidebar').classList.remove('open');
}));
render();
