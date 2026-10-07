import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Users, 
  Armchair, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Layers, 
  Tag, 
  HelpCircle,
  Loader2
} from 'lucide-react';
import { Table, TableShape, TableState, TableCategory, RestaurantFloor } from '../types';

interface AddTableModalProps {
  restaurantId: string;
  restaurantName: string;
  existingTables: Table[];
  floors?: RestaurantFloor[];
  activeFloorId?: string;
  onClose: () => void;
  onAddTable: (newTable: Table) => Promise<boolean>;
}

const COMMON_SECTIONS = [
  'Main Dining',
  'Courtyard Terrace',
  'Bar Lounge',
  'Private Alcove',
];

const POPULAR_PREFERENCES = [
  'Window View',
  'Garden View',
  'Quiet',
  'Romantic',
  'Breeze',
  'Plush Velvet Booth',
  'Outdoor Canopy',
  'Chandelier View',
  'Central Ambience',
  'Live Acoustics',
  'High Table',
  'Cocktail Counter',
  'VIP Hospitality',
  'Family Seating',
];

export const AddTableModal: React.FC<AddTableModalProps> = ({
  restaurantId,
  restaurantName,
  existingTables,
  floors = [],
  activeFloorId,
  onClose,
  onAddTable,
}) => {
  // Suggest next table number based on existing tables
  const suggestedNumber = React.useMemo(() => {
    // Find numeric suffix if any
    const numbers = existingTables
      .map((t) => {
        const match = t.tableNumber.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => n > 0);
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : existingTables.length;
    const nextVal = maxNum + 1;
    const prefix = existingTables[0]?.tableNumber.replace(/\d+.*$/, '') || 'T';
    return `${prefix}${nextVal < 10 ? '0' + nextVal : nextVal}`;
  }, [existingTables]);

  const [tableNumber, setTableNumber] = useState<string>(suggestedNumber);
  const [selectedFloorId, setSelectedFloorId] = useState<string>(activeFloorId || floors[0]?.id || 'floor-0');
  const [category, setCategory] = useState<TableCategory>('Standard');
  const [capacity, setCapacity] = useState<number>(4);
  const [minCapacity, setMinCapacity] = useState<number>(2);
  const [section, setSection] = useState<string>('Main Dining');
  const [customSection, setCustomSection] = useState<string>('');
  const [shape, setShape] = useState<TableShape>('rect');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['Window View', 'Quiet']);
  const [customFeatureInput, setCustomFeatureInput] = useState<string>('');
  const [initialStatus, setInitialStatus] = useState<TableState>('available');
  const [placementArea, setPlacementArea] = useState<'terrace' | 'main' | 'bar' | 'alcove'>('main');
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const finalSection = section === 'custom' ? (customSection.trim() || 'Main Dining') : section;

  const toggleFeature = (feat: string) => {
    if (selectedFeatures.includes(feat)) {
      setSelectedFeatures(selectedFeatures.filter((f) => f !== feat));
    } else {
      setSelectedFeatures([...selectedFeatures, feat]);
    }
  };

  const handleAddCustomFeature = () => {
    const trimmed = customFeatureInput.trim();
    if (trimmed && !selectedFeatures.includes(trimmed)) {
      setSelectedFeatures([...selectedFeatures, trimmed]);
      setCustomFeatureInput('');
    }
  };

  const handleCapacityChange = (cap: number) => {
    setCapacity(cap);
    setMinCapacity(Math.max(1, Math.min(minCapacity, cap - 1 || 1)));
  };

  // Calculate default floor plan coordinates based on section & area
  const calculateCoordinates = () => {
    // Count existing tables in this section to position without direct overlap
    const countInSection = existingTables.filter(
      (t) => t.section.toLowerCase().includes(finalSection.toLowerCase())
    ).length;

    let x = 40;
    let y = 45;
    let width = 18;
    let height = 18;

    if (shape === 'circle') {
      width = 14;
      height = 14;
    } else if (shape === 'booth') {
      width = 22;
      height = 18;
    } else {
      width = capacity >= 6 ? 22 : 18;
      height = capacity >= 6 ? 20 : 18;
    }

    if (placementArea === 'terrace' || finalSection.toLowerCase().includes('terrace') || finalSection.toLowerCase().includes('courtyard')) {
      y = 12;
      x = Math.min(80, 10 + (countInSection * 18) % 75);
    } else if (placementArea === 'bar' || finalSection.toLowerCase().includes('bar')) {
      y = 72;
      x = Math.min(42, 10 + (countInSection * 16) % 35);
    } else if (placementArea === 'alcove' || finalSection.toLowerCase().includes('alcove') || finalSection.toLowerCase().includes('private')) {
      y = 70;
      x = Math.min(80, 52 + (countInSection * 20) % 32);
    } else {
      // Main Dining
      y = 42;
      x = Math.min(80, 10 + (countInSection * 22) % 75);
    }

    return { x, y, width, height };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanNum = tableNumber.trim();
    if (!cleanNum) {
      setErrorMessage('Please enter a table number or name.');
      return;
    }

    // Check duplicate table number
    const duplicate = existingTables.some(
      (t) => t.tableNumber.toLowerCase() === cleanNum.toLowerCase()
    );
    if (duplicate) {
      setErrorMessage(`Table number "${cleanNum}" already exists. Please choose a distinct table number.`);
      return;
    }

    if (capacity < 1) {
      setErrorMessage('Capacity must be at least 1 guest.');
      return;
    }

    setIsSubmitting(true);
    const coords = calculateCoordinates();
    const uniqueTableId = `tbl-${restaurantId}-${cleanNum.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
    const matchedFloor = floors.find((f) => f.id === selectedFloorId) || floors[0];

    const newTableObj: Table = {
      id: uniqueTableId,
      tableId: uniqueTableId,
      restaurantId,
      tableNumber: cleanNum,
      capacity,
      minCapacity: Math.min(minCapacity, capacity),
      shape,
      section: finalSection,
      category,
      floorId: matchedFloor?.id,
      floorNumber: matchedFloor?.floorNumber,
      floorName: matchedFloor?.name,
      features: selectedFeatures.length > 0 ? selectedFeatures : ['Indoor Seating'],
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.height,
      status: initialStatus,
    };

    try {
      const success = await onAddTable(newTableObj);
      if (success) {
        onClose();
      } else {
        setErrorMessage('Could not save table to backend. Please verify your connection and try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to add table.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-3xl border border-[#E8E6E1] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        id="add-table-modal"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#E8E6E1] flex items-center justify-between bg-[#FAF9F6]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4F6F52]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F6F52]">
                Table Management
              </span>
            </div>
            <h3 className="text-xl font-bold font-serif text-[#2C3333] mt-0.5">
              Add New Table
            </h3>
            <p className="text-xs text-[#2C3333]/60">
              Adding to <span className="font-semibold text-[#2C3333]">{restaurantName}</span> live floor plan
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-[#E8E6E1] flex items-center justify-center text-[#2C3333]/60 hover:text-[#2C3333] hover:bg-[#FAF9F6] transition-colors cursor-pointer"
            id="btn-close-add-table"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-[#2C3333]">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Row 0: Floor Selection & Table Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#4F6F52]" />
                <span>Restaurant Floor *</span>
              </label>
              {floors && floors.length > 0 ? (
                <select
                  value={selectedFloorId}
                  onChange={(e) => setSelectedFloorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl text-sm font-semibold text-[#2C3333] focus:outline-none focus:border-[#4F6F52] focus:bg-white cursor-pointer"
                  id="select-add-table-floor"
                >
                  {floors.map((fl) => (
                    <option key={fl.id} value={fl.id}>
                      {fl.name} (Level {fl.floorNumber})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 bg-stone-100 rounded-xl text-xs text-stone-600 font-medium">
                  Ground Floor (Default)
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#4F6F52]" />
                <span>Table Category</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TableCategory)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl text-sm font-semibold text-[#2C3333] focus:outline-none focus:border-[#4F6F52] focus:bg-white cursor-pointer"
                id="select-add-table-category"
              >
                <option value="Standard">Standard (General Diners)</option>
                <option value="VIP">VIP (Premium / Butler Service)</option>
                <option value="Family">Family (Large Dining Party)</option>
                <option value="Couple">Couple (Romantic 2-Seater)</option>
                <option value="Private">Private (Curtained Alcove)</option>
                <option value="Outdoor">Outdoor / Garden Deck</option>
                <option value="Bar">Bar / Cocktail Lounge</option>
              </select>
            </div>
          </div>

          {/* Row 1: Table Number & Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1.5">
                Table Number / Name *
              </label>
              <input
                type="text"
                required
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. T13, Booth 4, Patio 1"
                className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl text-sm font-semibold text-[#2C3333] focus:outline-none focus:border-[#4F6F52] focus:bg-white"
                id="input-add-table-number"
              />
              <span className="text-[10px] text-[#2C3333]/50 mt-1 block">
                Must be unique within your restaurant.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1.5">
                Initial Status
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as TableState)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl text-sm font-semibold text-[#2C3333] focus:outline-none focus:border-[#4F6F52] focus:bg-white cursor-pointer"
                id="select-add-table-status"
              >
                <option value="available">Available (Ready for Diners)</option>
                <option value="cleaning">Cleaning (In Turnaround)</option>
                <option value="reserved">Reserved (Held)</option>
                <option value="occupied">Occupied (Currently Seated)</option>
                <option value="unavailable">Unavailable (Maintenance / Offline)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Capacity & Minimum Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1.5">
                Max Capacity (Guests) *
              </label>
              <div className="flex items-center gap-2">
                {[2, 4, 6, 8].map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => handleCapacityChange(cap)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      capacity === cap
                        ? 'bg-[#4F6F52] text-white border-[#4F6F52] shadow-xs'
                        : 'bg-[#FAF9F6] text-[#2C3333]/70 border-[#E8E6E1] hover:bg-white'
                    }`}
                  >
                    {cap}p
                  </button>
                ))}
                <div className="w-18">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={capacity}
                    onChange={(e) => handleCapacityChange(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2.5 py-2 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl text-xs font-bold text-center text-[#2C3333] focus:outline-none focus:border-[#4F6F52]"
                    title="Custom capacity"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1.5">
                Min Capacity (Guests)
              </label>
              <input
                type="number"
                min="1"
                max={capacity}
                value={minCapacity}
                onChange={(e) => setMinCapacity(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl text-sm font-semibold text-[#2C3333] focus:outline-none focus:border-[#4F6F52] focus:bg-white"
                id="input-add-min-capacity"
              />
              <span className="text-[10px] text-[#2C3333]/50 mt-1 block">
                Minimum party size eligible for automated booking match.
              </span>
            </div>
          </div>

          {/* Row 3: Section & Shape */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1.5">
                Floor Section *
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl text-sm font-semibold text-[#2C3333] focus:outline-none focus:border-[#4F6F52] focus:bg-white cursor-pointer"
                id="select-add-table-section"
              >
                {COMMON_SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
                <option value="custom">+ Custom Section Name...</option>
              </select>

              {section === 'custom' && (
                <input
                  type="text"
                  required
                  placeholder="Enter custom section (e.g. Garden Deck)"
                  value={customSection}
                  onChange={(e) => setCustomSection(e.target.value)}
                  className="mt-2 w-full px-3.5 py-2 bg-white border border-[#4F6F52] rounded-xl text-xs font-semibold text-[#2C3333] focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1.5">
                Table Shape & Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'rect', label: 'Rectangular' },
                  { key: 'circle', label: 'Circular' },
                  { key: 'booth', label: 'Cozy Booth' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setShape(s.key as TableShape)}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer text-center ${
                      shape === s.key
                        ? 'bg-[#2C3333] text-white border-[#2C3333]'
                        : 'bg-[#FAF9F6] text-[#2C3333]/70 border-[#E8E6E1] hover:bg-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 4: Seating Preferences & Ambiance Features */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1.5">
              Seating Preferences & Ambiance Features
            </label>
            <p className="text-[11px] text-[#2C3333]/60 mb-2">
              Select all tags that describe this table's dining experience. Used for customer smart matching.
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-[#FAF9F6] rounded-2xl border border-[#E8E6E1]">
              {POPULAR_PREFERENCES.map((feat) => {
                const selected = selectedFeatures.includes(feat);
                return (
                  <button
                    key={feat}
                    type="button"
                    onClick={() => toggleFeature(feat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      selected
                        ? 'bg-[#4F6F52] text-white border-[#4F6F52] shadow-2xs'
                        : 'bg-white text-[#2C3333]/70 border-[#E8E6E1] hover:border-[#4F6F52]/50'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3 inline-block mr-1" />}
                    {feat}
                  </button>
                );
              })}
            </div>

            {/* Add Custom Tag */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                placeholder="Add custom preference (e.g. Sitar View, Corner Table)"
                value={customFeatureInput}
                onChange={(e) => setCustomFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomFeature();
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-[#FAF9F6] border border-[#E8E6E1] rounded-xl text-xs text-[#2C3333] focus:outline-none focus:border-[#4F6F52]"
              />
              <button
                type="button"
                onClick={handleAddCustomFeature}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#E8E6E1] text-[#4F6F52] font-semibold text-xs hover:bg-[#FAF9F6] cursor-pointer"
              >
                + Add Tag
              </button>
            </div>
          </div>

          {/* Floor Plan Position Preview */}
          <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C3333]/50 block">
                Blueprint Placement
              </span>
              <span className="text-xs font-bold text-[#2C3333] block mt-0.5">
                {finalSection} • {shape.toUpperCase()} table for {capacity}
              </span>
              <span className="text-[11px] text-[#4F6F52] block">
                Automatically placed in the {finalSection} zone
              </span>
            </div>

            <div className="w-16 h-12 rounded-xl border-2 border-dashed border-[#4F6F52] bg-white flex items-center justify-center shrink-0">
              <span className="text-[11px] font-mono font-bold text-[#4F6F52]">
                {tableNumber || 'NEW'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E8E6E1] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-[#E8E6E1] text-[#2C3333]/70 font-semibold text-xs hover:bg-[#FAF9F6] transition-colors cursor-pointer"
              id="btn-cancel-add-table"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              id="btn-submit-add-table"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding Table...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Table to Floor Plan</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
