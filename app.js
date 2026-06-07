window.appState = {
  settings: null,
  allDays: [],
  allAdvances: [],
  currentMonth: '',
  currentYear: new Date().getFullYear(),
};

const toastElement = document.getElementById('toast');
let deferredPrompt = null;

function normalizeNumber(value) {
  return Number.parseFloat(value || 0) || 0;
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(roundCurrency(value));
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(`${dateString}T12:00:00`));
}

function mapHotelTypeLabel(type) {
  if (type === 'low') return 'Basse saison';
  if (type === 'high') return 'Haute saison';
  return 'Aucun';
}

function getISOWeekInfo(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
  return { year: temp.getUTCFullYear(), week: weekNo };
}

function getStartOfWeek(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeDayValues(day, settings) {
  const lunchAllowance = day.lunchEnabled ? settings.lunch : 0;
  const dinnerAllowance = day.dinnerEnabled ? settings.dinner : 0;
  const hotelAllowance = day.hotelType === 'low' ? settings.hotelLow : day.hotelType === 'high' ? settings.hotelHigh : 0;
  const allowances = lunchAllowance + dinnerAllowance + hotelAllowance;
  const allowanceExpenses = normalizeNumber(day.lunchAmount) + normalizeNumber(day.dinnerAmount) + ((day.hotelType === 'low' || day.hotelType === 'high') ? normalizeNumber(day.hotelAmount) : 0);
  const extraExpenses = normalizeNumber(day.hotelExtra) + normalizeNumber(day.miscExtra);
  return {
    lunchGain: lunchAllowance - normalizeNumber(day.lunchAmount),
    dinnerGain: dinnerAllowance - normalizeNumber(day.dinnerAmount),
    hotelGain: hotelAllowance - ((day.hotelType === 'low' || day.hotelType === 'high') ? normalizeNumber(day.hotelAmount) : 0),
    allowances: roundCurrency(allowances),
    allowanceExpenses: roundCurrency(allowanceExpenses),
    gain: roundCurrency(allowances - allowanceExpenses),
    extraExpenses: roundCurrency(extraExpenses),
  };
}

function getAdvanceAmount(year, week) {
  const advance = window.appState.allAdvances.find(item => item.year === year && item.week === week);
  return advance ? normalizeNumber(advance.amount) : 0;
}

function computePeriodTotals(days, settings) {
  const totals = {
    advances: 0,
    allowances: 0,
    allowanceExpenses: 0,
    gain: 0,
    hotelExtra: 0,
    miscExtra: 0,
    remainingAdvance: 0,
    lunchGain: 0,
    dinnerGain: 0,
    hotelGain: 0,
  };

  const seenAdvanceKeys = new Set();

  days.forEach(day => {
    const values = computeDayValues(day, settings);
    const weekInfo = getISOWeekInfo(day.date);
    const advanceKey = `${weekInfo.year}-${weekInfo.week}`;

    if (!seenAdvanceKeys.has(advanceKey)) {
      totals.advances += getAdvanceAmount(weekInfo.year, weekInfo.week);
      seenAdvanceKeys.add(advanceKey);
    }

    totals.allowances += values.allowances;
    totals.allowanceExpenses += values.allowanceExpenses;
    totals.gain += values.gain;
    totals.hotelExtra += normalizeNumber(day.hotelExtra);
    totals.miscExtra += normalizeNumber(day.miscExtra);
    totals.lunchGain += values.lunchGain;
    totals.dinnerGain += values.dinnerGain;
    totals.hotelGain += values.hotelGain;
  });

  totals.remainingAdvance = roundCurrency(totals.advances - totals.allowances - totals.hotelExtra - totals.miscExtra);
  Object.keys(totals).forEach(key => totals[key] = roundCurrency(totals[key]));
  return totals;
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add('visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toastElement.classList.remove('visible'), 2200);
}

function renderKpis(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = items.map(item => `
    <article class="kpi-card">
      <span class="label">${item.label}</span>
      <strong class="value">${item.value}</strong>
    </article>
  `).join('');
}

function getCurrentDateValue() {
  return document.getElementById('day-date').value || toDateInputValue(new Date());
}

function getCurrentDayFormData() {
  return {
    date: document.getElementById('day-date').value,
    lunchEnabled: document.getElementById('lunch-enabled').checked,
    lunchAmount: normalizeNumber(document.getElementById('lunch-amount').value),
    dinnerEnabled: document.getElementById('dinner-enabled').checked,
    dinnerAmount: normalizeNumber(document.getElementById('dinner-amount').value),
    hotelType: document.getElementById('hotel-type').value,
    hotelAmount: normalizeNumber(document.getElementById('hotel-amount').value),
    hotelExtra: normalizeNumber(document.getElementById('hotel-extra').value),
    miscExtra: normalizeNumber(document.getElementById('misc-extra').value),
  };
}

function fillDayForm(day) {
  document.getElementById('day-date').value = day.date;
  document.getElementById('lunch-enabled').checked = !!day.lunchEnabled;
  document.getElementById('lunch-amount').value = normalizeNumber(day.lunchAmount) || '';
  document.getElementById('dinner-enabled').checked = !!day.dinnerEnabled;
  document.getElementById('dinner-amount').value = normalizeNumber(day.dinnerAmount) || '';
  document.getElementById('hotel-type').value = day.hotelType || 'none';
  document.getElementById('hotel-amount').value = normalizeNumber(day.hotelAmount) || '';
  document.getElementById('hotel-extra').value = normalizeNumber(day.hotelExtra) || '';
  document.getElementById('misc-extra').value = normalizeNumber(day.miscExtra) || '';
  renderDaySummary();
}

function resetDayForm(dateValue) {
  fillDayForm({
    date: dateValue,
    lunchEnabled: false,
    lunchAmount: 0,
    dinnerEnabled: false,
    dinnerAmount: 0,
    hotelType: 'none',
    hotelAmount: 0,
    hotelExtra: 0,
    miscExtra: 0,
  });
}

async function loadDay(dateValue) {
  const existing = await getDay(dateValue);
  if (existing) fillDayForm(existing); else resetDayForm(dateValue);
}

function openScreen(screenName) {
  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
  document.querySelectorAll('.nav-button').forEach(button => button.classList.toggle('active', button.dataset.screen === screenName));
  document.getElementById(`screen-${screenName}`).classList.add('active');
  if (screenName === 'week') renderWeekScreen();
  if (screenName === 'month') renderMonthScreen();
  if (screenName === 'year') renderYearScreen();
  if (screenName === 'advances') renderAdvanceList();
}

function renderDaySummary() {
  const day = getCurrentDayFormData();
  if (!window.appState.settings) return;
  const values = computeDayValues(day, window.appState.settings);
  renderKpis('day-summary', [
    { label: 'Forfaits', value: formatCurrency(values.allowances) },
    { label: 'Dépenses forfaitaires', value: formatCurrency(values.allowanceExpenses) },
    { label: 'Gain', value: formatCurrency(values.gain) },
    { label: 'Hôtel hors forfait', value: formatCurrency(normalizeNumber(day.hotelExtra)) },
    { label: 'Dépenses diverses', value: formatCurrency(normalizeNumber(day.miscExtra)) },
  ]);
}

function renderHomeScreen() {
  const date = getCurrentDateValue();
  const weekInfo = getISOWeekInfo(date);
  const weekDays = window.appState.allDays.filter(day => {
    const info = getISOWeekInfo(day.date);
    return info.year === weekInfo.year && info.week === weekInfo.week;
  });
  const totals = computePeriodTotals(weekDays, window.appState.settings);
  renderKpis('home-summary', [
    { label: 'Avance reçue', value: formatCurrency(getAdvanceAmount(weekInfo.year, weekInfo.week)) },
    { label: 'Forfaits acquis', value: formatCurrency(totals.allowances) },
    { label: 'Dépenses forfaitaires', value: formatCurrency(totals.allowanceExpenses) },
    { label: 'Gain', value: formatCurrency(totals.gain) },
    { label: 'Hôtels hors forfait', value: formatCurrency(totals.hotelExtra) },
    { label: 'Dépenses diverses', value: formatCurrency(totals.miscExtra) },
    { label: 'Reste sur avance', value: formatCurrency(totals.remainingAdvance) },
  ]);
}

function renderWeekScreen() {
  const date = getCurrentDateValue();
  const weekInfo = getISOWeekInfo(date);
  const days = window.appState.allDays
    .filter(day => {
      const info = getISOWeekInfo(day.date);
      return info.year === weekInfo.year && info.week === weekInfo.week;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const totals = computePeriodTotals(days, window.appState.settings);

  document.getElementById('week-label').textContent = `Année ${weekInfo.year} · Semaine ${weekInfo.week}`;
  renderKpis('week-summary', [
    { label: 'Avance', value: formatCurrency(getAdvanceAmount(weekInfo.year, weekInfo.week)) },
    { label: 'Forfaits', value: formatCurrency(totals.allowances) },
    { label: 'Dépenses forfaitaires', value: formatCurrency(totals.allowanceExpenses) },
    { label: 'Gain', value: formatCurrency(totals.gain) },
    { label: 'Hôtel hors forfait', value: formatCurrency(totals.hotelExtra) },
    { label: 'Dépenses diverses', value: formatCurrency(totals.miscExtra) },
    { label: 'Reste sur avance', value: formatCurrency(totals.remainingAdvance) },
  ]);

  const list = document.getElementById('week-days-list');
  list.innerHTML = days.length ? days.map(day => {
    const gain = computeDayValues(day, window.appState.settings).gain;
    return `<button class="list-item" type="button" data-open-day="${day.date}"><span>${formatDate(day.date)}</span><strong>${formatCurrency(gain)}</strong></button>`;
  }).join('') : '<p>Aucune journée enregistrée pour cette semaine.</p>';
}

function renderMonthScreen() {
  const currentMonth = document.getElementById('month-picker').value || window.appState.currentMonth;
  const [year, month] = currentMonth.split('-').map(Number);
  const days = window.appState.allDays.filter(day => day.date.startsWith(currentMonth));
  const totals = computePeriodTotals(days, window.appState.settings);

  document.getElementById('month-label').textContent = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  renderKpis('month-summary', [
    { label: 'Avances', value: formatCurrency(totals.advances) },
    { label: 'Forfaits', value: formatCurrency(totals.allowances) },
    { label: 'Dépenses forfaitaires', value: formatCurrency(totals.allowanceExpenses) },
    { label: 'Gain', value: formatCurrency(totals.gain) },
    { label: 'Hôtels hors forfait', value: formatCurrency(totals.hotelExtra) },
    { label: 'Dépenses diverses', value: formatCurrency(totals.miscExtra) },
    { label: 'Reste sur avance', value: formatCurrency(totals.remainingAdvance) },
  ]);

  const totalDays = new Date(year, month, 0).getDate();
  const calendar = document.getElementById('month-calendar');
  calendar.innerHTML = '';
  for (let dayNumber = 1; dayNumber <= totalDays; dayNumber += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    const record = window.appState.allDays.find(item => item.date === date);
    const gain = record ? computeDayValues(record, window.appState.settings).gain : null;
    const statusClass = gain === null ? '' : gain > 0 ? 'positive' : gain < 0 ? 'negative' : 'neutral';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `calendar-cell ${statusClass}`.trim();
    button.dataset.openDay = date;
    button.innerHTML = `<strong>${dayNumber}</strong><span>${gain === null ? '—' : formatCurrency(gain)}</span>`;
    calendar.appendChild(button);
  }
}

function renderYearScreen() {
  const year = Number(document.getElementById('year-picker').value || window.appState.currentYear);
  const days = window.appState.allDays.filter(day => day.date.startsWith(`${year}-`));
  const totals = computePeriodTotals(days, window.appState.settings);
  renderKpis('year-summary', [
    { label: 'Total avances', value: formatCurrency(totals.advances) },
    { label: 'Total forfaits', value: formatCurrency(totals.allowances) },
    { label: 'Total dépenses forfaitaires', value: formatCurrency(totals.allowanceExpenses) },
    { label: 'Total gains', value: formatCurrency(totals.gain) },
    { label: 'Total hôtels hors forfait', value: formatCurrency(totals.hotelExtra) },
    { label: 'Total dépenses diverses', value: formatCurrency(totals.miscExtra) },
    { label: 'Reste sur avance annuel', value: formatCurrency(totals.remainingAdvance) },
  ]);
  document.getElementById('year-breakdown').innerHTML = [
    { label: 'Gain repas midi', value: totals.lunchGain },
    { label: 'Gain repas soir', value: totals.dinnerGain },
    { label: 'Gain hôtel', value: totals.hotelGain },
  ].map(item => `<article class="kpi-card"><span class="label">${item.label}</span><strong class="value">${formatCurrency(item.value)}</strong></article>`).join('');
}

function renderAdvanceList() {
  const list = document.getElementById('advance-list');
  list.innerHTML = window.appState.allAdvances.length ? window.appState.allAdvances.map(item => `
    <div class="list-item">
      <span>Année ${item.year} · Semaine ${item.week}</span>
      <strong>${formatCurrency(item.amount)}</strong>
    </div>
  `).join('') : '<p>Aucune avance enregistrée.</p>';
}

async function refreshData() {
  window.appState.allDays = await getAllDays();
  window.appState.allAdvances = await getAllAdvances();
  renderDaySummary();
  renderHomeScreen();
  renderWeekScreen();
  renderMonthScreen();
  renderYearScreen();
  renderAdvanceList();
}

async function saveCurrentDay() {
  const day = getCurrentDayFormData();
  if (!day.date) {
    showToast('Choisissez une date.');
    return;
  }
  await saveDay(day);
  await refreshData();
  showToast('Journée enregistrée.');
}

async function copyPreviousDay() {
  const currentDate = getCurrentDateValue();
  const previous = new Date(`${currentDate}T12:00:00`);
  previous.setDate(previous.getDate() - 1);
  const previousDate = toDateInputValue(previous);
  const day = await getDay(previousDate);
  if (!day) {
    showToast('Aucune donnée la veille.');
    return;
  }
  fillDayForm({ ...day, date: currentDate });
  showToast('Données de la veille copiées.');
}

async function saveAdvanceForm() {
  const year = Number(document.getElementById('advance-year').value);
  const week = Number(document.getElementById('advance-week').value);
  const amount = normalizeNumber(document.getElementById('advance-amount').value);
  if (!year || !week) {
    showToast('Complétez année et semaine.');
    return;
  }
  await saveAdvance({ year, week, amount });
  window.appState.allAdvances = await getAllAdvances();
  renderAdvanceList();
  renderHomeScreen();
  renderWeekScreen();
  renderMonthScreen();
  renderYearScreen();
  showToast('Avance enregistrée.');
}

async function saveSettingsForm() {
  const values = {
    lunch: normalizeNumber(document.getElementById('setting-lunch').value),
    dinner: normalizeNumber(document.getElementById('setting-dinner').value),
    hotelLow: normalizeNumber(document.getElementById('setting-hotel-low').value),
    hotelHigh: normalizeNumber(document.getElementById('setting-hotel-high').value),
  };
  await saveSettings(values);
  window.appState.settings = await getSettings();
  await refreshData();
  showToast('Paramètres sauvegardés.');
}

function syncSettingsForm() {
  const s = window.appState.settings;
  document.getElementById('setting-lunch').value = s.lunch;
  document.getElementById('setting-dinner').value = s.dinner;
  document.getElementById('setting-hotel-low').value = s.hotelLow;
  document.getElementById('setting-hotel-high').value = s.hotelHigh;
}

function syncDefaultContext() {
  const today = new Date();
  const dateValue = toDateInputValue(today);
  const week = getISOWeekInfo(dateValue);
  document.getElementById('day-date').value = dateValue;
  document.getElementById('month-picker').value = dateValue.slice(0, 7);
  document.getElementById('year-picker').value = today.getFullYear();
  document.getElementById('advance-year').value = week.year;
  document.getElementById('advance-week').value = week.week;
  window.appState.currentMonth = dateValue.slice(0, 7);
  window.appState.currentYear = today.getFullYear();
}

function bindEvents() {
  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => openScreen(button.dataset.screen)));
  document.querySelectorAll('[data-go-screen]').forEach(button => button.addEventListener('click', () => openScreen(button.dataset.goScreen)));
  document.getElementById('save-day').addEventListener('click', saveCurrentDay);
  document.getElementById('copy-previous-day').addEventListener('click', copyPreviousDay);
  document.getElementById('save-advance').addEventListener('click', saveAdvanceForm);
  document.getElementById('save-settings').addEventListener('click', saveSettingsForm);
  document.getElementById('export-csv').addEventListener('click', exportDaysToCsv);
  document.getElementById('day-form').addEventListener('input', renderDaySummary);
  document.getElementById('day-date').addEventListener('change', async (event) => {
    await loadDay(event.target.value);
    renderHomeScreen();
    renderWeekScreen();
  });
  document.getElementById('month-picker').addEventListener('change', event => {
    window.appState.currentMonth = event.target.value;
    renderMonthScreen();
  });
  document.getElementById('year-picker').addEventListener('change', event => {
    window.appState.currentYear = Number(event.target.value);
    renderYearScreen();
  });
  document.addEventListener('click', async event => {
    const dayTarget = event.target.closest('[data-open-day]');
    if (!dayTarget) return;
    const date = dayTarget.dataset.openDay;
    openScreen('day');
    await loadDay(date);
  });

  const toggle = document.querySelector('[data-theme-toggle]');
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const applyTheme = () => {
    document.documentElement.setAttribute('data-theme', theme);
    toggle.innerHTML = theme === 'dark'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  };
  applyTheme();
  toggle.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(); });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    document.getElementById('install-button').classList.remove('hidden');
  });
  document.getElementById('install-button').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById('install-button').classList.add('hidden');
  });
}

async function init() {
  syncDefaultContext();
  window.appState.settings = await getSettings();
  syncSettingsForm();
  bindEvents();
  await loadDay(document.getElementById('day-date').value);
  await refreshData();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js');
  }
}

init();
