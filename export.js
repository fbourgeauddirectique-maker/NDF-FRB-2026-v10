function csvEscape(value) {
  const stringValue = String(value ?? '');
  if (/[";,\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function exportDaysToCsv() {
  const allDays = await getAllDays();
  const headers = [
    'Date',
    'Midi activé',
    'Dépense midi',
    'Soir activé',
    'Dépense soir',
    'Type hôtel',
    'Dépense hôtel',
    'Hôtel hors forfait',
    'Dépenses diverses',
    'Forfaits',
    'Dépenses forfaitaires',
    'Gain'
  ];

  const rows = allDays
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => {
      const computed = computeDayValues(day, window.appState.settings);
      return [
        day.date,
        day.lunchEnabled ? 'Oui' : 'Non',
        normalizeNumber(day.lunchAmount),
        day.dinnerEnabled ? 'Oui' : 'Non',
        normalizeNumber(day.dinnerAmount),
        mapHotelTypeLabel(day.hotelType),
        normalizeNumber(day.hotelAmount),
        normalizeNumber(day.hotelExtra),
        normalizeNumber(day.miscExtra),
        computed.allowances,
        computed.allowanceExpenses,
        computed.gain
      ];
    });

  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `notes-frais-pro-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
