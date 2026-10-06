import React, { useState } from 'react';
import { 
  Armchair, 
  Users, 
  Clock, 
  Calendar, 
  Check, 
  Sparkles, 
  RefreshCw, 
  Phone, 
  Mail, 
  Tag, 
  Info,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { Table, TableState, Restaurant, Reservation } from '../types';
import { TIME_SLOTS, parseTimeToMinutes } from '../data/mockData';
import { AddTableModal } from './AddTableModal';
import { RemoveTableModal } from './RemoveTableModal';
import { hydrateReservationWithSoloSafety } from '../services/soloSafetyService';

interface LiveTablesTabProps {
  restaurant: Restaurant;
  reservations: Reservation[];
  tableOverrides: Record<string, TableState>;
  onSetTableStatus: (tableId: string, status: TableState) => void;
  selectedSlot: string;
  onSelectSlot: (slot: string) => void;
  selectedTable: Table | null;
  onSelectTable: (table: Table) => void;
  onResetStatuses: () => void;
  getTableStaffStatus: (table: Table) => TableState;
  isSyncingTables?: boolean;
  lastTablesSyncTime?: string | null;
  onSyncTables?: () => void;
  onAddTable?: (table: Table) => Promise<boolean>;
  onRemoveTable?: (tableId: string) => Promise<boolean>;
}

export const LiveTablesTab: React.FC<LiveTablesTabProps> = ({
  restaurant,
  reservations,
  tableOverrides,
  onSetTableStatus,
  selectedSlot,
  onSelectSlot,
  selectedTable,
  onSelectTable,
  onResetStatuses,
  getTableStaffStatus,
  isSyncingTables = false,
  lastTablesSyncTime = null,
  onSyncTables,
  onAddTable,
  onRemoveTable,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [tablePendingRemoval, setTablePendingRemoval] = useState<Table | null>(null);
  const [actionToast, setActionToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setActionToast({ message, type });
    setTimeout(() => {
      setActionToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Compute status summary
  const tableStatuses = restaurant.tables.map((t) => ({
    table: t,
    status: getTableStaffStatus(t),
  }));

  const availableCount = tableStatuses.filter((s) => s.status === 'available').length;
  const reservedCount = tableStatuses.filter((s) => s.status === 'reserved').length;
  const occupiedCount = tableStatuses.filter((s) => s.status === 'occupied').length;
  const cleaningCount = tableStatuses.filter((s) => s.status === 'cleaning').length;
  const unavailableCount = tableStatuses.filter((s) => s.status === 'unavailable').length;

  // Reservation details for selected table
  const activeTable = selectedTable || restaurant.tables[0];
  const activeTableStatus = activeTable ? getTableStaffStatus(activeTable) : 'available';

  const getReservationForTable = (table: Table) => {
    const slotMinutes = parseTimeToMinutes(selectedSlot || '07:30 PM');

    // 1. Prefer reservation active at the currently selected slot
    const activeResAtSlot = reservations.find((r) => {
      const isMatch =
        r.tableId === table.id ||
        r.tableId === table.tableNumber ||
        (Boolean(r.tableNumber) && r.tableNumber.trim().toLowerCase() === table.tableNumber.trim().toLowerCase()) ||
        (r.tableId && r.tableId.replace('t-', 'T').toLowerCase() === table.tableNumber.toLowerCase());

      if (!isMatch) return false;
      if (!['confirmed', 'arrived', 'checked-in', 'seated'].includes(r.status)) return false;

      const hasFoodOrder = Boolean(r.foodOrder && r.foodOrder.items && r.foodOrder.items.length > 0);
      const durationMinutes = hasFoodOrder ? 90 : 120;
      const startMinutes = parseTimeToMinutes(r.timeSlot);
      const endMinutes = startMinutes + durationMinutes;

      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });

    // 2. Fall back to any confirmed/seated reservation for this table
    const res = activeResAtSlot || reservations.find(
      (r) =>
        (r.tableId === table.id ||
         r.tableId === table.tableNumber ||
         (Boolean(r.tableNumber) && r.tableNumber.trim().toLowerCase() === table.tableNumber.trim().toLowerCase()) ||
         (r.tableId && r.tableId.replace('t-', 'T').toLowerCase() === table.tableNumber.toLowerCase())) &&
        ['confirmed', 'arrived', 'checked-in', 'seated'].includes(r.status)
    );

    if (res) {
      return {
        ...res,
        customerName: res.customerName,
        customerPhone: res.customerPhone || '+91 98450 12260',
        customerEmail: res.customerEmail || 'guest@example.com',
        timeSlot: res.timeSlot,
        guests: res.guests,
        bookingRef: res.bookingRef,
        seatingPreferences: res.seatingPreferences ? res.seatingPreferences.join(' · ') : (table.features ? table.features.join(' · ') : 'Standard'),
        specialRequests: res.specialRequests || 'Standard reservation',
      };
    }

    return null;
  };

  const currentReservation = activeTable ? getReservationForTable(activeTable) : null;

  // Status visual helpers
  const getStatusBadge = (status: TableState) => {
    switch (status) {
      case 'available':
        return {
          label: 'AVAILABLE',
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-500',
          dot: 'bg-emerald-500',
        };
      case 'reserved':
        return {
          label: 'RESERVED',
          bg: 'bg-amber-50',
          text: 'text-amber-800',
          border: 'border-amber-400',
          dot: 'bg-amber-500',
        };
      case 'occupied':
        return {
          label: 'OCCUPIED',
          bg: 'bg-[#2C3333]',
          text: 'text-white',
          border: 'border-[#2C3333]',
          dot: 'bg-white',
        };
      case 'cleaning':
        return {
          label: 'CLEANING',
          bg: 'bg-sky-50',
          text: 'text-sky-800',
          border: 'border-sky-400',
          dot: 'bg-sky-500',
        };
      case 'unavailable':
      default:
        return {
          label: 'UNAVAILABLE',
          bg: 'bg-stone-100',
          text: 'text-stone-600',
          border: 'border-stone-300',
          dot: 'bg-stone-400',
        };
    }
  };

  const statusOptions: TableState[] = ['available', 'reserved', 'occupied', 'cleaning', 'unavailable'];

  return (
    <div className="space-y-6 animate-in fade-in duration-150" id="section-live-tables">
      
      {/* Live Tables Header */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8E6E1] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4F6F521A] text-[#4F6F52] text-[10px] font-bold uppercase tracking-widest mb-2 border border-[#4F6F52]/20">
            <Armchair className="w-3.5 h-3.5" />
            <span>Staff Floor Blueprint</span>
          </div>
          <h2 className="text-2xl font-bold font-serif text-[#2C3333]">
            Live Tables
          </h2>
          <p className="text-xs text-[#2C3333]/60 mt-0.5">
            Real-time table status monitoring and allocation for {restaurant.name} ({restaurant.neighborhood}, Bengaluru)
          </p>
        </div>

        {/* Slot Selector & Status Counts */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#FAF9F6] px-3.5 py-1.5 rounded-full border border-[#E8E6E1]">
            <Clock className="w-3.5 h-3.5 text-[#4F6F52]" />
            <span className="text-xs font-semibold text-[#2C3333]/70">Active Slot:</span>
            <select
              value={selectedSlot}
              onChange={(e) => onSelectSlot(e.target.value)}
              className="text-xs font-bold text-[#4F6F52] bg-transparent outline-none cursor-pointer pr-1"
              id="live-tables-slot-select"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
          </div>

          {lastTablesSyncTime && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Google Sheet Synced ({lastTablesSyncTime})</span>
            </span>
          )}

          {onSyncTables && (
            <button
              type="button"
              onClick={onSyncTables}
              disabled={isSyncingTables}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#4F6F52] hover:bg-[#FAF9F6] border border-[#E8E6E1] rounded-full flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Fetch fresh table data from Google Sheets backend"
              id="live-tables-sync-btn"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingTables ? 'animate-spin' : ''}`} />
              <span>{isSyncingTables ? 'Syncing...' : 'Sync Sheet'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onResetStatuses}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#4F6F52] hover:bg-[#FAF9F6] border border-[#E8E6E1] rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset to default demo states"
            id="live-tables-reset-btn"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset States</span>
          </button>

          {onAddTable && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#4F6F52] hover:bg-[#3D563F] rounded-full flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Add a new custom table to your restaurant layout"
              id="btn-open-add-table"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Table</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionToast && (
        <div 
          className={`p-3.5 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 border ${
            actionToast.type === 'error' 
              ? 'bg-rose-50 text-rose-800 border-rose-200' 
              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{actionToast.message}</span>
          </div>
          <button 
            onClick={() => setActionToast(null)}
            className="text-current/60 hover:text-current font-bold text-xs p-1"
          >
            ×
          </button>
        </div>
      )}

      {/* 5 Status Pills Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div 
          onClick={() => setFilterStatus(filterStatus === 'available' ? 'all' : 'available')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === 'available' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50' : 'bg-white border-[#E8E6E1] hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Available</span>
          </div>
          <span className="text-sm font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full">
            {availableCount}
          </span>
        </div>

        <div 
          onClick={() => setFilterStatus(filterStatus === 'reserved' ? 'all' : 'reserved')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === 'reserved' ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/50' : 'bg-white border-[#E8E6E1] hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Reserved</span>
          </div>
          <span className="text-sm font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
            {reservedCount}
          </span>
        </div>

        <div 
          onClick={() => setFilterStatus(filterStatus === 'occupied' ? 'all' : 'occupied')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === 'occupied' ? 'border-[#2C3333] ring-2 ring-[#2C3333]/20 bg-[#2C3333]/5' : 'bg-white border-[#E8E6E1] hover:border-[#2C3333]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2C3333]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#2C3333]">Occupied</span>
          </div>
          <span className="text-sm font-bold text-white bg-[#2C3333] px-2 py-0.5 rounded-full">
            {occupiedCount}
          </span>
        </div>

        <div 
          onClick={() => setFilterStatus(filterStatus === 'cleaning' ? 'all' : 'cleaning')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === 'cleaning' ? 'border-sky-400 ring-2 ring-sky-400/20 bg-sky-50/50' : 'bg-white border-[#E8E6E1] hover:border-sky-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800">Cleaning</span>
          </div>
          <span className="text-sm font-bold text-sky-900 bg-sky-100 px-2 py-0.5 rounded-full">
            {cleaningCount}
          </span>
        </div>

        <div 
          onClick={() => setFilterStatus(filterStatus === 'unavailable' ? 'all' : 'unavailable')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === 'unavailable' ? 'border-stone-400 ring-2 ring-stone-400/20 bg-stone-100' : 'bg-white border-[#E8E6E1] hover:border-stone-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">Unavailable</span>
          </div>
          <span className="text-sm font-bold text-stone-700 bg-stone-200 px-2 py-0.5 rounded-full">
            {unavailableCount}
          </span>
        </div>
      </div>

      {/* Main Grid: Blueprint (7 cols) + Details Panel (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: 2D Floor Plan Blueprint (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-[#E8E6E1] shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold font-serif text-[#2C3333]">
                Floor Blueprint
              </h3>
              <p className="text-xs text-[#2C3333]/60">
                Click any table to open its details panel or update status
              </p>
            </div>
            <span className="text-xs font-semibold text-[#4F6F52] bg-[#4F6F521A] px-3 py-1 rounded-full border border-[#4F6F52]/20">
              Interactive Staff Blueprint
            </span>
          </div>

          {/* Blueprint Stage */}
          <div className="relative w-full aspect-[16/11] bg-[#FAF9F6] rounded-2xl border border-[#E8E6E1] p-4 select-none overflow-hidden" id="live-tables-blueprint-container">
            {/* Grid background */}
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#4F6F52 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />

            {/* Tables on Blueprint */}
            {restaurant.tables.map((table) => {
              const state = getTableStaffStatus(table);
              const isSelected = activeTable?.id === table.id;
              const badgeStyle = getStatusBadge(state);
              const tableRes = (reservations || []).find(r => 
                (r.tableId === table.id || r.tableNumber === table.tableNumber || r.tableNumber === `T-${table.tableNumber.replace('T', '')}`) && 
                (r.status === 'confirmed' || r.status === 'seated' || r.status === 'checked-in')
              );

              return (
                <div
                  key={table.id}
                  onClick={() => onSelectTable(table)}
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    width: `${table.width}%`,
                    height: `${table.height}%`,
                  }}
                  className={`absolute cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
                    isSelected ? 'scale-105 z-20' : 'hover:scale-102 z-10'
                  }`}
                  id={`live-table-node-${table.tableNumber.toLowerCase().replace('-', '')}`}
                  title={`Table ${table.tableNumber} (${table.capacity} guests) - ${state.toUpperCase()}`}
                >
                  <div className={`w-full h-full p-1.5 text-center flex flex-col items-center justify-center rounded-2xl border-2 transition-all ${
                    badgeStyle.bg
                  } ${badgeStyle.border} ${badgeStyle.text} ${
                    isSelected ? 'ring-3 ring-[#4F6F52] ring-offset-2 shadow-md' : 'shadow-2xs'
                  }`}>
                    <div className="flex items-center gap-1 font-bold text-xs">
                      <span>{table.tableNumber}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                    </div>
                    
                    <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">
                      {state}
                    </span>

                    {tableRes && (
                      <span className="text-[8px] uppercase font-bold tracking-tight mt-0.5 px-1 py-0.2 rounded bg-amber-200 text-amber-900 leading-none truncate max-w-full">
                        {tableRes.customerName.split(' ')[0]} · {tableRes.timeSlot.split(' ')[0]}
                      </span>
                    )}

                    <span className="text-[8px] opacity-70 mt-0.5">
                      {table.capacity}p
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Select Table Chips */}
          <div>
            <div className="text-xs font-semibold text-[#2C3333]/70 mb-2.5 flex items-center justify-between">
              <span>Quick Table Switcher:</span>
              <span className="text-[11px] text-[#4F6F52]">Selected: Table {activeTable?.tableNumber}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {restaurant.tables.map((table) => {
                const state = getTableStaffStatus(table);
                const isSelected = activeTable?.id === table.id;
                const badge = getStatusBadge(state);

                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => onSelectTable(table)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#2C3333] text-white border-[#2C3333] shadow-xs'
                        : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333] border-[#E8E6E1]'
                    }`}
                    id={`table-chip-${table.tableNumber.toLowerCase().replace('-', '')}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    <span>{table.tableNumber}</span>
                    <span className="text-[10px] opacity-60">({table.capacity}p)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Blueprint Legend */}
          <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#E8E6E1] flex flex-wrap items-center justify-between gap-3 text-xs text-[#2C3333]/70">
            <div className="flex flex-wrap items-center gap-3.5">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Available</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Reserved</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2C3333]" />
                <span>Occupied</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                <span>Cleaning</span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
                <span>Unavailable</span>
              </span>
            </div>
          </div>

        </div>

        {/* Right: Table Details Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-[#E8E6E1] shadow-sm space-y-6" id="live-table-details-panel">
          
          {/* Panel Header with Active Table */}
          <div className="border-b border-[#E8E6E1] pb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#2C3333]/50 block mb-1">
                  Table Inspection & Control
                </span>
                <h3 className="text-2xl font-bold font-serif text-[#2C3333] flex items-center gap-2">
                  <span>Table {activeTable.tableNumber}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                    getStatusBadge(activeTableStatus).bg
                  } ${getStatusBadge(activeTableStatus).border} ${getStatusBadge(activeTableStatus).text}`}>
                    {activeTableStatus}
                  </span>
                </h3>
                <p className="text-xs text-[#2C3333]/60 mt-1">
                  {activeTable.section} • Capacity: {activeTable.capacity} Guests (Min {activeTable.minCapacity})
                </p>
              </div>

              <div className="w-10 h-10 rounded-2xl bg-[#4F6F521A] text-[#4F6F52] flex items-center justify-center shrink-0 border border-[#4F6F52]/20">
                <Armchair className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Quick Status Selector Buttons (Change Table Status) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-2.5 block flex items-center justify-between">
              <span>Set Table Status:</span>
              <span className="text-[10px] text-[#4F6F52] font-semibold">Instant Staff Override</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {statusOptions.map((status) => {
                const isActive = activeTableStatus === status;
                const badge = getStatusBadge(status);

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onSetTableStatus(activeTable.id, status)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? `${badge.bg} ${badge.border} ${badge.text} ring-2 ring-offset-1 ring-current shadow-xs`
                        : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border-[#E8E6E1]'
                    }`}
                    id={`btn-set-status-${status}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    <span>{status}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Specifications */}
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#2C3333]/60">
              Table Characteristics
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#2C3333]/50 block text-[11px]">Seating Capacity</span>
                <span className="font-bold text-[#2C3333]">{activeTable.capacity} Diners</span>
              </div>
              <div>
                <span className="text-[#2C3333]/50 block text-[11px]">Floor Section</span>
                <span className="font-bold text-[#2C3333]">{activeTable.section}</span>
              </div>
              <div>
                <span className="text-[#2C3333]/50 block text-[11px]">Shape & Form</span>
                <span className="font-bold text-[#2C3333] capitalize">{activeTable.shape} Table</span>
              </div>
              <div>
                <span className="text-[#2C3333]/50 block text-[11px]">Active Service Slot</span>
                <span className="font-bold text-[#4F6F52]">{selectedSlot}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E8E6E1]/70">
              <span className="text-[#2C3333]/50 block text-[11px] mb-1.5">Seating Features:</span>
              <div className="flex flex-wrap gap-1.5">
                {activeTable.features.map((f, i) => (
                  <span 
                    key={i} 
                    className="text-[10px] font-semibold text-[#4F6F52] bg-white px-2 py-0.5 rounded-md border border-[#E8E6E1]"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Customer / Reservation Info */}
          <div className="p-5 rounded-2xl border border-[#E8E6E1] bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#4F6F52]" />
                <span>Customer & Reservation</span>
              </span>
              {currentReservation ? (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  Assigned
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  Open
                </span>
              )}
            </div>

            {currentReservation ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold font-serif text-[#2C3333]">
                      {currentReservation.customerName}
                    </h4>
                    <p className="text-xs text-[#2C3333]/60 flex items-center gap-2 mt-0.5">
                      <span>{currentReservation.guests} Guests</span>
                      <span>•</span>
                      <span>{currentReservation.timeSlot}</span>
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-[#FAF9F6] text-[#4F6F52] px-2.5 py-1 rounded-lg border border-[#E8E6E1]">
                    {currentReservation.bookingRef}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-[#2C3333]/70 pt-2 border-t border-[#E8E6E1]/70">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3 h-3 text-[#4F6F52]" />
                    <span className="font-mono">{currentReservation.customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-3 h-3 text-[#4F6F52]" />
                    <span>Preferences: <span className="font-semibold text-[#2C3333]">{currentReservation.seatingPreferences}</span></span>
                  </div>
                </div>

                {currentReservation.specialRequests && (
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900">
                    <span className="font-bold">Guest Note:</span> {currentReservation.specialRequests}
                  </div>
                )}

                {/* Solo Diner Safety Badge */}
                {(() => {
                  const hydrated = hydrateReservationWithSoloSafety(currentReservation);
                  if (!hydrated.soloDinerSafety?.enabled) return null;
                  const s = hydrated.soloDinerSafety;
                  return (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 flex items-start gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Solo Diner Safety Check-In:</span>
                        <span className="ml-1 text-emerald-800">
                          {s.contactName} ({s.contactPhone}) • {s.relationship} ({s.notifyMethod})
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="py-2 text-xs text-[#2C3333]/60 space-y-2">
                <p>
                  No reservation currently assigned to Table {activeTable.tableNumber} for this slot.
                </p>
                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E8E6E1] text-[11px] text-[#2C3333]/70">
                  ✓ Table is open for walk-in seating or future slot booking.
                </div>
              </div>
            )}
          </div>

          {/* Quick Staff Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-[#E8E6E1]">
            {activeTableStatus === 'cleaning' && (
              <button
                type="button"
                onClick={() => onSetTableStatus(activeTable.id, 'available')}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Mark Cleaned & Available</span>
              </button>
            )}

            {activeTableStatus === 'reserved' && (
              <button
                type="button"
                onClick={() => onSetTableStatus(activeTable.id, 'occupied')}
                className="w-full py-3 px-4 rounded-xl bg-[#2C3333] hover:bg-[#4F6F52] text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Users className="w-4 h-4" />
                <span>Seat Guest (Mark Occupied)</span>
              </button>
            )}

            {activeTableStatus === 'occupied' && (
              <button
                type="button"
                onClick={() => onSetTableStatus(activeTable.id, 'cleaning')}
                className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>Clear Table (Mark Cleaning)</span>
              </button>
            )}

            {activeTableStatus === 'available' && (
              <button
                type="button"
                onClick={() => onSetTableStatus(activeTable.id, 'reserved')}
                className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Clock className="w-4 h-4" />
                <span>Hold Table (Mark Reserved)</span>
              </button>
            )}

            {onRemoveTable && activeTable && (
              <div className="pt-2 border-t border-[#E8E6E1]/80">
                <button
                  type="button"
                  onClick={() => setTablePendingRemoval(activeTable)}
                  className="w-full py-2.5 px-3 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  id={`btn-remove-table-${activeTable.tableNumber}`}
                  title={`Remove Table ${activeTable.tableNumber} from restaurant floor layout`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Table {activeTable.tableNumber}</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Add Table Modal */}
      {isAddModalOpen && onAddTable && (
        <AddTableModal
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          existingTables={restaurant.tables}
          onClose={() => setIsAddModalOpen(false)}
          onAddTable={async (newTable) => {
            const success = await onAddTable(newTable);
            if (success) {
              showToast(`Table ${newTable.tableNumber} added successfully to ${restaurant.name}.`, 'success');
            }
            return success;
          }}
        />
      )}

      {/* Remove Table Modal */}
      {tablePendingRemoval && onRemoveTable && (
        <RemoveTableModal
          table={tablePendingRemoval}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          reservations={reservations}
          onClose={() => setTablePendingRemoval(null)}
          onConfirmRemove={async (tableId) => {
            const num = tablePendingRemoval.tableNumber;
            const success = await onRemoveTable(tableId);
            if (success) {
              showToast(`Table ${num} removed successfully from ${restaurant.name}.`, 'success');
            }
            return success;
          }}
        />
      )}

    </div>
  );
};
