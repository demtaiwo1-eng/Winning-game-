import React, { useEffect, useState } from 'react';

type DateParts = { day: string; month: string; year: string };

function partsFromDate(value: string): DateParts {
  const [year = '', month = '', day = ''] = (value || '').split('-');
  return { day, month, year };
}

function daysInMonth(year: string, month: string): number {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

export default function DateWheelPicker({
  value,
  onChange,
  label = 'Date',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [parts, setParts] = useState<DateParts>(() => partsFromDate(value));

  useEffect(() => {
    setParts(partsFromDate(value));
  }, [value]);

  const update = (next: DateParts) => {
    const maxDay = daysInMonth(next.year, next.month);
    const safeDay = next.day && Number(next.day) > maxDay ? String(maxDay).padStart(2, '0') : next.day;
    const normalized = { ...next, day: safeDay };
    setParts(normalized);
    if (normalized.year && normalized.month && normalized.day) {
      onChange(`${normalized.year}-${normalized.month}-${normalized.day}`);
    }
  };

  const maxDay = daysInMonth(parts.year, parts.month);
  const selectStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    minHeight: 48,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--ess-border, #d6dbe3)',
    background: 'var(--ess-surface, #fff)',
    color: 'var(--ess-ink, #172033)',
    font: 'inherit',
    fontSize: 16,
  };

  return (
    <fieldset className="date-wheel-picker" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend style={{ marginBottom: 8, fontWeight: 600 }}>{label}</legend>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr 1.15fr', gap: 8 }}>
        <label style={{ minWidth: 0, fontSize: 12, fontWeight: 600 }}>
          Day
          <select aria-label={`${label} day`} value={parts.day} style={selectStyle}
            onChange={(event) => update({ ...parts, day: event.target.value })}>
            <option value="">Day</option>
            {Array.from({ length: maxDay }, (_, index) => String(index + 1).padStart(2, '0')).map((day) =>
              <option key={day} value={day}>{day}</option>
            )}
          </select>
        </label>
        <label style={{ minWidth: 0, fontSize: 12, fontWeight: 600 }}>
          Month
          <select aria-label={`${label} month`} value={parts.month} style={selectStyle}
            onChange={(event) => update({ ...parts, month: event.target.value })}>
            <option value="">Month</option>
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) =>
              <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>
            )}
          </select>
        </label>
        <label style={{ minWidth: 0, fontSize: 12, fontWeight: 600 }}>
          Year
          <select aria-label={`${label} year`} value={parts.year} style={selectStyle}
            onChange={(event) => update({ ...parts, year: event.target.value })}>
            <option value="">Year</option>
            {Array.from({ length: 201 }, (_, index) => String(1900 + index)).map((year) =>
              <option key={year} value={year}>{year}</option>
            )}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
