import React, { useMemo, useState } from 'react';
import { Clock, AlertCircle, Sparkles, Edit3, Sliders, Check } from 'lucide-react';
import {
  parseTimeToMinutes,
  minutesTo12Hour,
  calculateReservationDuration,
  validateReservationTimeRange,
} from '../utils/timeRangeUtils';

interface TimeRangePickerProps {
  timeIn: string;
  timeOut: string;
  onChangeTimeIn: (newTimeIn: string) => void;
  onChangeTimeOut: (newTimeOut: string) => void;
  openingHours?: string;
  restaurantOpeningHours?: string;
  className?: string;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

interface Parsed12Time {
  hour: number;
  minute: string;
  period: 'AM' | 'PM';
}

function parse12Time(timeStr: string): Parsed12Time {
  const clean = (timeStr || '').replace(/IST/i, '').trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    return {
      hour: parseInt(match[1], 10),
      minute: match[2],
      period: match[3].toUpperCase() as 'AM' | 'PM',
    };
  }

  // Fallback default
  return {
    hour: 7,
    minute: '30',
    period: 'PM',
  };
}

function assembleTime(hour: number, minute: string, period: 'AM' | 'PM'): string {
  const padMinute = minute.padStart(2, '0');
  return `${hour}:${padMinute} ${period}`;
}

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  timeIn,
  timeOut,
  onChangeTimeIn,
  onChangeTimeOut,
  openingHours,
  restaurantOpeningHours,
  className = '',
}) => {
  const effectiveOpeningHours = restaurantOpeningHours || openingHours;
  const [inputMode, setInputMode] = useState<'picker' | 'manual'>('picker');
  const [manualTimeInText, setManualTimeInText] = useState(timeIn || '');
  const [manualTimeOutText, setManualTimeOutText] = useState(timeOut || '');

  const parsedIn = useMemo(() => parse12Time(timeIn), [timeIn]);
  const parsedOut = useMemo(() => parse12Time(timeOut), [timeOut]);

  // Duration calculation
  const durationResult = useMemo(() => {
    return calculateReservationDuration(timeIn, timeOut);
  }, [timeIn, timeOut]);

  // Operational hours validation
  const validationResult = useMemo(() => {
    if (!effectiveOpeningHours) return { isValid: true };
    return validateReservationTimeRange(timeIn, timeOut, effectiveOpeningHours);
  }, [timeIn, timeOut, effectiveOpeningHours]);

  const handleUpdateIn = (field: 'hour' | 'minute' | 'period', val: string | number) => {
    const updated = { ...parsedIn, [field]: val };
    const newTime = assembleTime(Number(updated.hour), String(updated.minute), updated.period);
    onChangeTimeIn(newTime);
    setManualTimeInText(newTime);
  };

  const handleUpdateOut = (field: 'hour' | 'minute' | 'period', val: string | number) => {
    const updated = { ...parsedOut, [field]: val };
    const newTime = assembleTime(Number(updated.hour), String(updated.minute), updated.period);
    onChangeTimeOut(newTime);
    setManualTimeOutText(newTime);
  };

  // Quick duration helper (e.g. +60m, +90m, +120m)
  const applyQuickDuration = (minutesToAdd: number) => {
    const startMins = parseTimeToMinutes(timeIn || '7:30 PM');
    const endMins = startMins + minutesToAdd;
    const newTimeOut = minutesTo12Hour(endMins);
    onChangeTimeOut(newTimeOut);
    setManualTimeOutText(newTimeOut);
  };

  const handleManualInBlur = () => {
    if (manualTimeInText.trim()) {
      const parsed = parse12Time(manualTimeInText);
      const normalized = assembleTime(parsed.hour, parsed.minute, parsed.period);
      onChangeTimeIn(normalized);
      setManualTimeInText(normalized);
    }
  };

  const handleManualOutBlur = () => {
    if (manualTimeOutText.trim()) {
      const parsed = parse12Time(manualTimeOutText);
      const normalized = assembleTime(parsed.hour, parsed.minute, parsed.period);
      onChangeTimeOut(normalized);
      setManualTimeOutText(normalized);
    }
  };

  return (
    <div className={`space-y-3.5 ${className}`} id="time-in-out-picker-container">
      {/* Header bar with mode toggle and computed duration */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#4F6F52]" />
          <div>
            <span className="text-xs font-bold text-[#2C3333] uppercase tracking-wider block">
              Reservation Arrival & Departure
            </span>
            <span className="text-[10px] text-[#2C3333]/60">
              Expected visit times (Not a dining timer)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#FAF9F6] p-0.5 rounded-full border border-[#E8E6E1]">
            <button
              type="button"
              onClick={() => setInputMode('picker')}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                inputMode === 'picker'
                  ? 'bg-[#4F6F52] text-white shadow-xs'
                  : 'text-[#2C3333]/70 hover:text-[#2C3333]'
              }`}
            >
              <Sliders className="w-3 h-3" />
              <span>Select Time</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode('manual');
                setManualTimeInText(timeIn);
                setManualTimeOutText(timeOut);
              }}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                inputMode === 'manual'
                  ? 'bg-[#4F6F52] text-white shadow-xs'
                  : 'text-[#2C3333]/70 hover:text-[#2C3333]'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Enter Manually</span>
            </button>
          </div>

          {/* Duration Badge */}
          {durationResult.isValid ? (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4F6F5214] text-[#4F6F52] border border-[#4F6F52]/30 text-xs font-bold shadow-xs animate-in fade-in"
              id="computed-reservation-duration"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4F6F52]" />
              <span>Duration: {durationResult.durationFormatted}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Invalid range</span>
            </div>
          )}
        </div>
      </div>

      {/* MODE 1: SIMPLE ACCESSIBLE TIME PICKER */}
      {inputMode === 'picker' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* TIME IN FIELD */}
          <div
            className="p-3.5 rounded-2xl bg-white border border-[#E8E6E1] hover:border-[#4F6F52]/50 transition-colors shadow-xs"
            id="picker-time-in"
          >
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#2C3333] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Time In <span className="font-normal text-[#2C3333]/60">(Customer Arrival)</span>
              </label>
              <span className="text-xs font-mono font-bold text-[#4F6F52] bg-[#FAF9F6] px-2 py-0.5 rounded-md border border-[#E8E6E1]">
                {timeIn || 'Select Arrival'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Hour select */}
              <div className="flex-1 min-w-0">
                <select
                  aria-label="Time In Hour"
                  value={parsedIn.hour}
                  onChange={(e) => handleUpdateIn('hour', Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs sm:text-sm font-semibold text-[#2C3333] bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52] cursor-pointer"
                  id="select-time-in-hour"
                >
                  {HOURS.map((h) => (
                    <option key={`in-h-${h}`} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-[#2C3333]/40 font-bold">:</span>

              {/* Minute select */}
              <div className="flex-1 min-w-0">
                <select
                  aria-label="Time In Minute"
                  value={parsedIn.minute}
                  onChange={(e) => handleUpdateIn('minute', e.target.value)}
                  className="w-full px-2 py-2 text-xs sm:text-sm font-semibold text-[#2C3333] bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52] cursor-pointer"
                  id="select-time-in-minute"
                >
                  {MINUTES.map((m) => (
                    <option key={`in-m-${m}`} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* AM / PM Toggle */}
              <div className="flex items-center bg-[#FAF9F6] p-0.5 rounded-xl border border-[#E8E6E1] shrink-0">
                <button
                  type="button"
                  onClick={() => handleUpdateIn('period', 'AM')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    parsedIn.period === 'AM'
                      ? 'bg-[#4F6F52] text-white shadow-xs'
                      : 'text-[#2C3333]/60 hover:text-[#2C3333]'
                  }`}
                  id="btn-time-in-am"
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateIn('period', 'PM')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    parsedIn.period === 'PM'
                      ? 'bg-[#4F6F52] text-white shadow-xs'
                      : 'text-[#2C3333]/60 hover:text-[#2C3333]'
                  }`}
                  id="btn-time-in-pm"
                >
                  PM
                </button>
              </div>
            </div>
          </div>

          {/* TIME OUT FIELD */}
          <div
            className="p-3.5 rounded-2xl bg-white border border-[#E8E6E1] hover:border-[#4F6F52]/50 transition-colors shadow-xs"
            id="picker-time-out"
          >
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#2C3333] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Time Out <span className="font-normal text-[#2C3333]/60">(Customer Departure)</span>
              </label>
              <span className="text-xs font-mono font-bold text-[#4F6F52] bg-[#FAF9F6] px-2 py-0.5 rounded-md border border-[#E8E6E1]">
                {timeOut || 'Select Departure'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Hour select */}
              <div className="flex-1 min-w-0">
                <select
                  aria-label="Time Out Hour"
                  value={parsedOut.hour}
                  onChange={(e) => handleUpdateOut('hour', Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs sm:text-sm font-semibold text-[#2C3333] bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52] cursor-pointer"
                  id="select-time-out-hour"
                >
                  {HOURS.map((h) => (
                    <option key={`out-h-${h}`} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-[#2C3333]/40 font-bold">:</span>

              {/* Minute select */}
              <div className="flex-1 min-w-0">
                <select
                  aria-label="Time Out Minute"
                  value={parsedOut.minute}
                  onChange={(e) => handleUpdateOut('minute', e.target.value)}
                  className="w-full px-2 py-2 text-xs sm:text-sm font-semibold text-[#2C3333] bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52] cursor-pointer"
                  id="select-time-out-minute"
                >
                  {MINUTES.map((m) => (
                    <option key={`out-m-${m}`} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* AM / PM Toggle */}
              <div className="flex items-center bg-[#FAF9F6] p-0.5 rounded-xl border border-[#E8E6E1] shrink-0">
                <button
                  type="button"
                  onClick={() => handleUpdateOut('period', 'AM')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    parsedOut.period === 'AM'
                      ? 'bg-[#4F6F52] text-white shadow-xs'
                      : 'text-[#2C3333]/60 hover:text-[#2C3333]'
                  }`}
                  id="btn-time-out-am"
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateOut('period', 'PM')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    parsedOut.period === 'PM'
                      ? 'bg-[#4F6F52] text-white shadow-xs'
                      : 'text-[#2C3333]/60 hover:text-[#2C3333]'
                  }`}
                  id="btn-time-out-pm"
                >
                  PM
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: DIRECT MANUAL TEXT INPUT */}
      {inputMode === 'manual' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-[#E8E6E1] space-y-2">
            <label htmlFor="manual-time-in" className="text-xs font-bold text-[#2C3333] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Time In <span className="font-normal text-[#2C3333]/60">(Enter exact arrival)</span>
            </label>
            <input
              id="manual-time-in"
              type="text"
              value={manualTimeInText}
              onChange={(e) => {
                setManualTimeInText(e.target.value);
                onChangeTimeIn(e.target.value);
              }}
              onBlur={handleManualInBlur}
              placeholder="e.g. 7:30 PM or 19:30"
              className="w-full px-3 py-2 text-xs sm:text-sm font-semibold text-[#2C3333] bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52]"
            />
            <span className="text-[10px] text-[#2C3333]/50 block">Enter format: "07:30 PM" or "7:45 PM"</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#E8E6E1] space-y-2">
            <label htmlFor="manual-time-out" className="text-xs font-bold text-[#2C3333] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Time Out <span className="font-normal text-[#2C3333]/60">(Enter expected departure)</span>
            </label>
            <input
              id="manual-time-out"
              type="text"
              value={manualTimeOutText}
              onChange={(e) => {
                setManualTimeOutText(e.target.value);
                onChangeTimeOut(e.target.value);
              }}
              onBlur={handleManualOutBlur}
              placeholder="e.g. 9:15 PM or 21:15"
              className="w-full px-3 py-2 text-xs sm:text-sm font-semibold text-[#2C3333] bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52]"
            />
            <span className="text-[10px] text-[#2C3333]/50 block">Must be later than Time In</span>
          </div>
        </div>
      )}

      {/* Quick Duration Setters */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
        <span className="text-[11px] text-[#2C3333]/60 font-medium">Quick duration adjustment:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => applyQuickDuration(60)}
            className="px-2.5 py-1 text-[11px] font-semibold text-[#2C3333] bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            +1 hr
          </button>
          <button
            type="button"
            onClick={() => applyQuickDuration(90)}
            className="px-2.5 py-1 text-[11px] font-semibold text-[#2C3333] bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            +1 hr 30 min
          </button>
          <button
            type="button"
            onClick={() => applyQuickDuration(105)}
            className="px-2.5 py-1 text-[11px] font-semibold text-[#2C3333] bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            +1 hr 45 min
          </button>
          <button
            type="button"
            onClick={() => applyQuickDuration(120)}
            className="px-2.5 py-1 text-[11px] font-semibold text-[#2C3333] bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            +2 hrs
          </button>
        </div>
      </div>

      {/* Validation warning banners */}
      {!durationResult.isValid && durationResult.error && (
        <div
          className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-800 animate-in fade-in"
          id="time-validation-error-duration"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-semibold">{durationResult.error}</span>
        </div>
      )}

      {durationResult.isValid && !validationResult.isValid && validationResult.error && (
        <div
          className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900 animate-in fade-in"
          id="time-validation-error-hours"
        >
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="font-semibold">{validationResult.error}</span>
        </div>
      )}

      {/* Operating Hours Reference Note */}
      {effectiveOpeningHours && (
        <div className="flex items-center justify-between text-[11px] text-[#2C3333]/60 pt-1">
          <span className="flex items-center gap-1.5">
            <span>Operating hours:</span>
            <span className="font-semibold text-[#2C3333]">
              {effectiveOpeningHours.replace(/IST/g, '').trim()} IST
            </span>
          </span>
          <span className="text-[10px] text-[#4F6F52] font-semibold">
            ✓ Overlap checked in real time
          </span>
        </div>
      )}
    </div>
  );
};
