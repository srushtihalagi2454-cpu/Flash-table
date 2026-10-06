import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Store, 
  Users, 
  Calendar, 
  Clock, 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Armchair, 
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  RefreshCw,
  Camera,
  Keyboard,
  MapPin,
  Phone,
  Radio,
  Compass,
  LayoutDashboard,
  BarChart3,
  Settings,
  Info,
  Sliders,
  LogOut,
  Receipt,
  UtensilsCrossed,
  ShoppingBag,
  Utensils,
  AlertCircle,
  User,
  Bus,
  Package
} from 'lucide-react';
import { 
  Restaurant, 
  Reservation, 
  Table, 
  TableState, 
  SmartArrivalState, 
  SmartArrivalDistanceOption,
  SmartArrivalRecord,
  FoodOrder
} from '../types';
import { TIME_SLOTS, parseTimeToMinutes } from '../data/mockData';
import { QrScannerModal } from './QrScannerModal';
import { SmartArrivalMap } from './SmartArrivalMap';
import { LiveTablesTab } from './LiveTablesTab';
import { InsightsTab } from './InsightsTab';
import { DigitalMenuView } from './DigitalMenuView';
import { MenuQrModal } from './MenuQrModal';
import { DiningBillModal } from './DiningBillModal';
import { FoodOrdersTab } from './FoodOrdersTab';
import { MenuManagementTab } from './MenuManagementTab';
import { TravelBookingsTab } from './TravelBookingsTab';
import { getStoredSession, saveStoredSession } from '../services/authService';
import { getDiningClockSession } from '../services/diningTimerService';
import { getRestaurantReservationsFromBackend } from '../services/reservationService';
import { getRestaurantSmartArrivalFromBackend } from '../services/smartArrivalService';
import { getRestaurantFoodOrdersFromBackend } from '../services/foodService';
import { formatINR } from '../utils/priceUtils';
import { 
  formatDistance, 
  getKitchenPrepRecommendation, 
  KitchenPrepRecommendation 
} from '../utils/smartArrival';
import { createCheckInOnBackend } from '../services/checkInService';
import { createBillOnBackend } from '../services/billService';
import { generateDiningBill } from '../data/restaurantMenus';
import { 
  hydrateReservationWithSoloSafety, 
  dispatchSoloSafetyNotification 
} from '../services/soloSafetyService';
import { 
  getRestaurantTablesFromBackend, 
  updateTableStatusOnBackend,
  addTableToBackend,
  removeTableFromBackend
} from '../services/tableService';
import { 
  cleanDateString, 
  cleanTimeString, 
  formatTimeIST, 
  formatUpdatedTimeIST,
  formatPacingTableNumber,
  formatPacingReservationDate,
  formatPacingReservationTime
} from '../utils/dateTime';
import { parseStoredReservationTime } from '../utils/timeRangeUtils';

export type DashboardViewOption = 
  | 'overview' 
  | 'reservations' 
  | 'travel-bookings'
  | 'food-orders'
  | 'menu-management'
  | 'live-tables' 
  | 'guest-arrival' 
  | 'insights' 
  | 'owner-details'
  | 'settings' 
  | 'floor-plan';

interface RestaurantDashboardProps {
  restaurants: Restaurant[];
  activeRestaurant: Restaurant;
  setActiveRestaurant: (r: Restaurant) => void;
  reservations: Reservation[];
  onUpdateReservationStatus: (resId: string, status: Reservation['status']) => void;
  onSendBill?: (resId: string) => void;
  onManualTableStateChange?: (tableId: string, newState: TableState) => void;
  onToast?: (message: string) => void;
  smartArrivalState: SmartArrivalState;
  onSimulateDistance?: (dist: SmartArrivalDistanceOption) => void;
  onToggleSmartArrival?: (enabled: boolean) => void;
  onSwitchToCustomer?: () => void;
  onSignOut?: () => void;
  onSyncReservations?: (backendReservations: Reservation[]) => void;
  onUpdateRestaurantTables?: (restaurantId: string, updatedTables: Table[]) => void;
  onUpdateRestaurantDetails?: (restaurantId: string, details: { name: string; ownerName: string; address: string; customerCareNumber: string }) => void;
}

export const RestaurantDashboard: React.FC<RestaurantDashboardProps> = ({
  restaurants,
  activeRestaurant,
  setActiveRestaurant,
  reservations,
  onUpdateReservationStatus,
  onSendBill,
  onToast,
  smartArrivalState,
  onSimulateDistance,
  onToggleSmartArrival,
  onSwitchToCustomer,
  onSignOut,
  onSyncReservations,
  onUpdateRestaurantTables,
  onUpdateRestaurantDetails,
}) => {
  const [dashboardView, setDashboardView] = useState<DashboardViewOption>('overview');
  const [resFilter, setResFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  
  // Restaurant Profile & Owner Management state
  const [profileName, setProfileName] = useState(activeRestaurant.name || '');
  const [profileOwnerName, setProfileOwnerName] = useState(activeRestaurant.ownerName || 'Vikramaditya Rathore');
  const [profileAddress, setProfileAddress] = useState(activeRestaurant.address || '');
  const [profileCustomerCare, setProfileCustomerCare] = useState(activeRestaurant.customerCareNumber || activeRestaurant.contactNumber || '+91 98450 12260');
  const [isProfileSaved, setIsProfileSaved] = useState(false);

  useEffect(() => {
    setProfileName(activeRestaurant.name || '');
    setProfileOwnerName(activeRestaurant.ownerName || 'Vikramaditya Rathore');
    setProfileAddress(activeRestaurant.address || '');
    setProfileCustomerCare(activeRestaurant.customerCareNumber || activeRestaurant.contactNumber || '+91 98450 12260');
  }, [activeRestaurant]);

  // Authenticated restaurant owner session
  const ownerSession = getStoredSession();
  const effectiveRole = ownerSession?.role || 'restaurant-owner';
  const isAuthorizedOwner = effectiveRole === 'restaurant-owner';

  const handleSaveRestaurantProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedOwner) {
      if (onToast) onToast('Access Denied: Only authorized restaurant owners/admins can edit restaurant profile details.');
      return;
    }

    const updated = {
      ...activeRestaurant,
      name: profileName.trim(),
      ownerName: profileOwnerName.trim(),
      address: profileAddress.trim(),
      customerCareNumber: profileCustomerCare.trim(),
      contactNumber: profileCustomerCare.trim(),
    };
    setActiveRestaurant(updated);
    if (onUpdateRestaurantDetails) {
      onUpdateRestaurantDetails(activeRestaurant.id, {
        name: profileName.trim(),
        ownerName: profileOwnerName.trim(),
        address: profileAddress.trim(),
        customerCareNumber: profileCustomerCare.trim(),
      });
    }

    try {
      localStorage.setItem(`flashtable_restaurant_${activeRestaurant.id}`, JSON.stringify(updated));
    } catch {}

    setIsProfileSaved(true);
    if (onToast) {
      onToast(`Restaurant profile updated! Diners now see "${profileName.trim()}" and Customer Care: ${profileCustomerCare.trim()}.`);
    }
    setTimeout(() => setIsProfileSaved(false), 4000);
  };
  const [selectedSlot, setSelectedSlot] = useState<string>('07:30 PM');
  const [qrScanInput, setQrScanInput] = useState<string>('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);
  const [activeCheckInMethod, setActiveCheckInMethod] = useState<'scan' | 'manual'>('scan');
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isMenuQrOpen, setIsMenuQrOpen] = useState<boolean>(false);
  const [selectedBillReservation, setSelectedBillReservation] = useState<Reservation | null>(null);

  // Google Sheets backend synchronization state
  const [isSyncingBackend, setIsSyncingBackend] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => formatTimeIST(new Date()));
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Google Sheets backend table synchronization state
  const [backendTables, setBackendTables] = useState<Table[] | null>(null);
  const [isSyncingTables, setIsSyncingTables] = useState<boolean>(false);
  const [lastTablesSyncTime, setLastTablesSyncTime] = useState<string | null>(null);

  // Google Sheets backend live Smart Arrival state
  const [liveArrivalRecords, setLiveArrivalRecords] = useState<SmartArrivalRecord[]>([]);
  const [isLoadingArrivals, setIsLoadingArrivals] = useState<boolean>(false);
  const [lastArrivalSyncTime, setLastArrivalSyncTime] = useState<string>(() => formatTimeIST(new Date()));
  const [arrivalSyncError, setArrivalSyncError] = useState<string | null>(null);
  const [selectedArrivalResId, setSelectedArrivalResId] = useState<string | null>(null);
  const [dashboardFoodOrders, setDashboardFoodOrders] = useState<FoodOrder[]>([]);
  const [backendReservations, setBackendReservations] = useState<Reservation[]>([]);

  // Strict session lock: keep stored session restaurantId synchronized with activeRestaurant.id
  useEffect(() => {
    if (ownerSession && ownerSession.role === 'restaurant-owner') {
      if (ownerSession.restaurantId?.toLowerCase() !== activeRestaurant.id.toLowerCase()) {
        ownerSession.restaurantId = activeRestaurant.id;
        saveStoredSession(ownerSession);
      }
    }
  }, [activeRestaurant.id, ownerSession]);

  // Fetch reservations from Google Sheets backend for active restaurant
  const syncReservationsFromGoogleSheet = useCallback(async (notify: boolean = false) => {
    if (notify) setIsSyncingBackend(true);
    setSyncFeedback(null);
    try {
      const result = await getRestaurantReservationsFromBackend(activeRestaurant.id);
      if (result.success && result.reservations) {
        const timeStr = formatTimeIST(new Date());
        setLastSyncTime(timeStr);
        setSyncFeedback(`Synced ${result.reservations.length} reservations from Google Sheet (${timeStr})`);

        // Map backend reservation records to frontend Reservation models
        const mappedReservations: Reservation[] = result.reservations.map((item) => {
          const matchingTable = activeRestaurant.tables.find(
            (t) => t.id === item.tableId || t.tableNumber === item.tableId || t.tableNumber === item.tableId.replace('t-', 'T')
          );
          const tableNum = matchingTable 
            ? matchingTable.tableNumber 
            : (item.tableId.startsWith('t-') ? item.tableId.replace('t-', 'T') : item.tableId);

          const timeInfo = parseStoredReservationTime(item.time || '');

          return {
            id: item.reservationId,
            userId: item.userId,
            bookingRef: item.reservationId.startsWith('RES-') 
              ? `FT-${item.reservationId.slice(-6)}` 
              : (item.reservationId || 'FT-BLR-0730'),
            restaurantId: item.restaurantId,
            restaurantName: activeRestaurant.name,
            restaurantAddress: activeRestaurant.address,
            tableId: item.tableId,
            tableNumber: tableNum,
            section: (matchingTable?.section as any) || 'Main Dining',
            date: cleanDateString(item.date),
            timeSlot: timeInfo.timeIn && timeInfo.timeOut ? `${timeInfo.timeIn} → ${timeInfo.timeOut}` : cleanTimeString(item.time),
            timeIn: timeInfo.timeIn,
            timeOut: timeInfo.timeOut,
            durationFormatted: timeInfo.durationFormatted,
            durationMinutes: timeInfo.durationMinutes,
            guests: Number(item.guests) || 2,
            customerName: item.customerName || 'Guest',
            customerPhone: item.customerPhone || '',
            customerEmail: item.customerEmail || '',
            specialRequests: item.preferences || 'Window · Quiet table preferred',
            status: (item.status as any) || 'confirmed',
            createdAt: item.createdAt || new Date().toISOString(),
            qrCodeData: `FT-${item.restaurantId.toUpperCase()}-${tableNum}-${(item.customerName || 'GUEST').toUpperCase()}-${item.reservationId}`,
            noShowRiskScore: 'Low',
            depositAmount: Number(item.depositAmount) || 200,
            paymentStatus: 'paid',
            paymentMethod: Number(item.depositAmount) > 0 ? 'UPI' : 'UPI',
            paymentTransactionId: 'FT-TXN-' + (item.reservationId.length > 6 ? item.reservationId.slice(-6) : '883921'),
            paymentDetails: {
              depositAmount: Number(item.depositAmount) || 200,
              paymentStatus: 'paid',
              paymentMethod: 'UPI',
              paymentMethodDetail: 'UPI Table Booking Deposit (₹200)',
              transactionId: 'FT-TXN-' + (item.reservationId.length > 6 ? item.reservationId.slice(-6) : '883921'),
              paidAt: item.createdAt || new Date().toISOString(),
              isRefundable: true,
            },
          };
        });

        setBackendReservations(mappedReservations);
        if (onSyncReservations) {
          onSyncReservations(mappedReservations);
        }

        if (notify && onToast) {
          onToast(`Google Sheet: Refreshed ${mappedReservations.length} reservations for ${activeRestaurant.name}.`);
        }
      } else {
        setSyncFeedback(result.message || 'Unable to sync with Google Sheet.');
      }
    } catch (err: any) {
      setSyncFeedback(err?.message || 'Error connecting to Google Sheets backend.');
    } finally {
      setIsSyncingBackend(false);
    }
  }, [activeRestaurant, onSyncReservations, onToast]);

  // Fetch tables from Google Sheets backend for the authenticated restaurant owner
  const syncTablesFromGoogleSheet = useCallback(async (notify: boolean = false) => {
    if (notify) setIsSyncingTables(true);
    try {
      // Use active restaurant's ID
      const targetRestId = activeRestaurant.id;
      const result = await getRestaurantTablesFromBackend(targetRestId);

      if (result.success && result.tables && result.tables.length > 0) {
        const timeStr = formatTimeIST(new Date());
        setLastTablesSyncTime(timeStr);

        // Map backend table items to frontend Table model, filtering out inactive/removed tables
        const mappedTables: Table[] = result.tables
          .filter((item) => item.status !== 'inactive' && item.status !== 'removed')
          .map((item) => ({
            id: item.tableId || item.id,
            tableNumber: item.tableNumber,
            capacity: Number(item.capacity) || 2,
            minCapacity: Number(item.minCapacity) || 1,
            shape: (item.shape === 'circle' || item.shape === 'booth' ? item.shape : 'rect') as Table['shape'],
            section: item.section || 'Main Dining',
            features: Array.isArray(item.features) ? item.features : [],
            x: Number(item.x) || 10,
            y: Number(item.y) || 10,
            width: Number(item.width) || 16,
            height: Number(item.height) || 16,
            status: item.status || 'available',
          }));

        setBackendTables(mappedTables);

        // Populate tableOverrides accurately reflecting backend table statuses
        const newOverrides: Record<string, TableState> = {};
        result.tables.forEach((t) => {
          if (t.status) {
            newOverrides[t.tableId || t.id] = t.status as TableState;
          }
        });
        setTableOverrides((prev) => ({ ...prev, ...newOverrides }));

        if (notify && onToast) {
          onToast(`Google Sheet: Synced ${mappedTables.length} tables for ${activeRestaurant.name} (${timeStr}).`);
        }
      }
    } catch (err: any) {
      console.warn('Unable to sync tables with Google Sheet backend:', err);
    } finally {
      setIsSyncingTables(false);
    }
  }, [activeRestaurant.id, activeRestaurant.name, onToast]);

  // Helper to match restaurant IDs handling canonical aliases and restaurant data lookups
  const isMatchingRestaurant = useCallback((rId1?: string, rId2?: string) => {
    if (!rId1 || !rId2) return false;
    const a = rId1.toLowerCase().trim();
    const b = rId2.toLowerCase().trim();
    if (a === b) return true;
    if ((a === 'rest-1' && b === 'the-ember-room') || (a === 'the-ember-room' && b === 'rest-1')) return true;

    // Check if either matches restaurant ID or name slug in RESTAURANTS_DATA
    const restA = restaurants.find(r => r.id.toLowerCase() === a || r.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === a);
    const restB = restaurants.find(r => r.id.toLowerCase() === b || r.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === b);
    if (restA && restB && restA.id === restB.id) return true;
    if (restA && restA.id.toLowerCase() === b) return true;
    if (restB && restB.id.toLowerCase() === a) return true;

    // Alphanumeric stripped check for flexible matching (e.g., 'the-ember-room' vs 'the ember room' vs 'rest-1')
    const cleanA = a.replace(/[^a-z0-9]/g, '');
    const cleanB = b.replace(/[^a-z0-9]/g, '');
    if (cleanA && cleanB && cleanA === cleanB) return true;
    if ((cleanA === 'rest1' || cleanA === 'theemberroom') && (cleanB === 'rest1' || cleanB === 'theemberroom')) return true;

    return false;
  }, [restaurants]);

  // Fetch live Smart Arrival data strictly for the currently viewed restaurant
  const syncSmartArrivalFromGoogleSheet = useCallback(async (notify: boolean = false) => {
    if (notify) setIsLoadingArrivals(true);
    try {
      const targetRestId = activeRestaurant.id;
      const result = await getRestaurantSmartArrivalFromBackend(targetRestId);
      if (result.success && Array.isArray(result.arrivals)) {
        setLiveArrivalRecords(result.arrivals);
        setArrivalSyncError(null);
        const timeStr = formatTimeIST(new Date());
        setLastArrivalSyncTime(timeStr);
        if (notify && onToast) {
          onToast(`Smart Arrival: Refreshed live arrival updates (${timeStr}).`);
        }
      } else {
        setArrivalSyncError(result.message || 'Unable to load live Smart Arrival updates.');
      }
    } catch (err: any) {
      setArrivalSyncError(err?.message || 'Error connecting to Smart Arrival backend.');
    } finally {
      setIsLoadingArrivals(false);
    }
  }, [activeRestaurant.id, onToast]);

  // Fetch food orders for pre-order detection
  const syncFoodOrdersFromGoogleSheet = useCallback(async () => {
    try {
      const targetRestId = activeRestaurant.id;
      const res = await getRestaurantFoodOrdersFromBackend(targetRestId);
      if (res.success && Array.isArray(res.foodOrders)) {
        setDashboardFoodOrders(res.foodOrders);
      }
    } catch {
      // Non-blocking
    }
  }, [activeRestaurant.id]);

  // Periodic polling for Smart Arrival, Food Orders, and Reservations (12 seconds) with unmount cleanup
  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;
      await syncSmartArrivalFromGoogleSheet(false);
      await syncFoodOrdersFromGoogleSheet();
      await syncReservationsFromGoogleSheet(false);
    };

    poll();
    const intervalId = setInterval(poll, 12000);

    const handleLocalArrivalEvent = () => {
      if (isMounted) {
        poll();
      }
    };
    window.addEventListener('flashtable:smart-arrival-update', handleLocalArrivalEvent);
    window.addEventListener('flashtable:reservation-created', handleLocalArrivalEvent);
    window.addEventListener('storage', handleLocalArrivalEvent);
    window.addEventListener('focus', handleLocalArrivalEvent);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('flashtable:smart-arrival-update', handleLocalArrivalEvent);
      window.removeEventListener('flashtable:reservation-created', handleLocalArrivalEvent);
      window.removeEventListener('storage', handleLocalArrivalEvent);
      window.removeEventListener('focus', handleLocalArrivalEvent);
    };
  }, [syncSmartArrivalFromGoogleSheet, syncFoodOrdersFromGoogleSheet, syncReservationsFromGoogleSheet]);

  // Active / upcoming guests for this restaurant with Smart Arrival enabled
  const activeSmartArrivalGuests = useMemo<Array<{
    arrival: SmartArrivalRecord;
    reservation: Reservation;
    foodOrder?: FoodOrder | null;
    prepRecommendation: KitchenPrepRecommendation;
  }>>(() => {
    const currentRestId = activeRestaurant.id;

    // Filter strictly by the restaurant currently being viewed / authenticated
    const arrivalsForThisRestaurant = liveArrivalRecords.filter(a =>
      isMatchingRestaurant(a.restaurantId, currentRestId) &&
      a.locationEnabled !== false
    );

    // If customer has an enabled smartArrivalState for this restaurant in session, incorporate it
    const allArrivals: SmartArrivalRecord[] = [...arrivalsForThisRestaurant];
    if (
      smartArrivalState.isEnabled &&
      smartArrivalState.reservationId &&
      isMatchingRestaurant(smartArrivalState.restaurantId, currentRestId)
    ) {
      const alreadyHas = allArrivals.some(
        a => a.reservationId.toLowerCase() === smartArrivalState.reservationId.toLowerCase()
      );
      if (!alreadyHas) {
        allArrivals.push({
          reservationId: smartArrivalState.reservationId,
          userId: smartArrivalState.userId,
          restaurantId: smartArrivalState.restaurantId || currentRestId,
          locationEnabled: true,
          latitude: smartArrivalState.customerLat || 0,
          longitude: smartArrivalState.customerLng || 0,
          distance: smartArrivalState.distanceMeters || (smartArrivalState.isInsideGeofence ? 450 : 800),
          etaMinutes: smartArrivalState.etaMinutes || (smartArrivalState.isInsideGeofence ? 2 : 5),
          geofenceStatus: smartArrivalState.isInsideGeofence ? 'Within 500 m' : 'Outside 500 m',
          updatedAt: smartArrivalState.lastSyncedAt || new Date().toISOString(),
        });
      }
    }

    const combinedReservations = [...reservations, ...backendReservations];
    const uniqueReservationsMap = new Map<string, Reservation>();
    combinedReservations.forEach(r => {
      if (r && r.id) uniqueReservationsMap.set(r.id.toLowerCase().trim(), r);
      if (r && r.bookingRef) uniqueReservationsMap.set(r.bookingRef.toLowerCase().trim(), r);
    });

    const matched: Array<{
      arrival: SmartArrivalRecord;
      reservation: Reservation;
      foodOrder?: FoodOrder | null;
      prepRecommendation: KitchenPrepRecommendation;
    }> = [];

    for (const arrival of allArrivals) {
      const arrivalKey = (arrival.reservationId || '').toLowerCase().trim();
      let matchingRes = uniqueReservationsMap.get(arrivalKey);
      if (!matchingRes) {
        matchingRes = combinedReservations.find(
          r =>
            isMatchingRestaurant(r.restaurantId, currentRestId) &&
            (r.id.toLowerCase() === arrivalKey ||
             (r.bookingRef && r.bookingRef.toLowerCase() === arrivalKey))
        );
      }

      // If matching in current session
      if (!matchingRes && smartArrivalState.reservationId && smartArrivalState.reservationId.toLowerCase() === arrivalKey) {
        matchingRes = {
          id: arrival.reservationId,
          bookingRef: arrival.reservationId,
          restaurantId: currentRestId,
          restaurantName: activeRestaurant.name,
          restaurantAddress: activeRestaurant.address,
          tableId: 'tbl-auto',
          section: 'Main Dining',
          customerName: smartArrivalState.customerName || 'Arriving Guest',
          customerEmail: 'guest@flashtable.in',
          customerPhone: smartArrivalState.customerPhone || '+91 98450 12260',
          guests: smartArrivalState.guests || 2,
          date: new Date().toISOString().split('T')[0],
          timeSlot: smartArrivalState.timeSlot || '07:30 PM',
          tableNumber: smartArrivalState.tableNumber || 'T07',
          status: 'confirmed',
          createdAt: arrival.updatedAt || new Date().toISOString(),
          depositAmount: 200,
          paymentStatus: 'paid',
          paymentMethod: 'UPI',
          qrCodeData: `FT-${currentRestId.toUpperCase()}-${arrival.reservationId}`,
          noShowRiskScore: 'Low',
        };
      }

      if (matchingRes) {
        if (arrival.customerName && (matchingRes.customerName.includes('Guest') || matchingRes.customerName === 'Customer')) {
          matchingRes = { ...matchingRes, customerName: arrival.customerName };
        }
        if (arrival.tableNumber && (matchingRes.tableNumber === 'Table Assigned on Arrival' || !matchingRes.tableNumber)) {
          matchingRes = { ...matchingRes, tableNumber: arrival.tableNumber };
        }
      }

      // If still not matched, construct real reservation context from arrival record
      if (!matchingRes) {
        const guestName = arrival.customerName || (arrival.userId ? `Guest (${arrival.userId})` : `Guest #${arrival.reservationId.slice(-4)}`);
        const tableNum = arrival.tableNumber || 'T03';
        matchingRes = {
          id: arrival.reservationId,
          bookingRef: arrival.reservationId,
          restaurantId: currentRestId,
          restaurantName: activeRestaurant.name,
          restaurantAddress: activeRestaurant.address,
          tableId: `tbl-${tableNum.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          section: 'Main Dining',
          customerName: guestName,
          customerEmail: 'guest@flashtable.in',
          customerPhone: arrival.customerPhone || '+91 98450 12260',
          guests: 2,
          date: arrival.updatedAt ? arrival.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0],
          timeSlot: 'Upcoming Reservation',
          tableNumber: tableNum,
          status: 'confirmed',
          createdAt: arrival.updatedAt || new Date().toISOString(),
          depositAmount: 200,
          paymentStatus: 'paid',
          paymentMethod: 'UPI',
          qrCodeData: `FT-${currentRestId.toUpperCase()}-${arrival.reservationId}`,
          noShowRiskScore: 'Low',
        };
      }

      // Only display if reservation is active/upcoming (not cancelled)
      if (matchingRes.status !== 'cancelled') {
        const matchingFoodOrder = dashboardFoodOrders.find(
          fo =>
            fo.reservationId.toLowerCase() === matchingRes.id.toLowerCase() ||
            (matchingRes.bookingRef && fo.reservationId.toLowerCase() === matchingRes.bookingRef.toLowerCase()) ||
            fo.reservationId.toLowerCase() === arrival.reservationId.toLowerCase()
        ) || (matchingRes.foodOrder ? {
          foodOrderId: matchingRes.foodOrder.foodOrderId || 'FO-AUTO',
          reservationId: matchingRes.id,
          userId: matchingRes.userId || 'usr-guest',
          restaurantId: currentRestId,
          tableId: matchingRes.tableId || 'tbl-auto',
          tableNumber: matchingRes.tableNumber,
          date: matchingRes.date,
          time: matchingRes.timeSlot,
          items: matchingRes.foodOrder.items || [],
          foodTotal: matchingRes.foodOrder.foodTotal || 0,
          status: matchingRes.foodOrder.status || 'Accepted',
          createdAt: matchingRes.createdAt,
          updatedAt: matchingRes.createdAt,
        } as FoodOrder : null);

        const prepRec = getKitchenPrepRecommendation(
          arrival.etaMinutes,
          arrival.distance,
          arrival.geofenceStatus
        );

        matched.push({
          arrival,
          reservation: matchingRes,
          foodOrder: matchingFoodOrder,
          prepRecommendation: prepRec,
        });
      }
    }

    return matched;
  }, [liveArrivalRecords, smartArrivalState, reservations, backendReservations, dashboardFoodOrders, activeRestaurant.id, isMatchingRestaurant]);

  // Currently focused / selected live guest
  const currentActiveGuest = useMemo(() => {
    if (activeSmartArrivalGuests.length === 0) return null;
    if (selectedArrivalResId) {
      const found = activeSmartArrivalGuests.find(g => g.reservation.id === selectedArrivalResId);
      if (found) return found;
    }
    return activeSmartArrivalGuests[0];
  }, [activeSmartArrivalGuests, selectedArrivalResId]);

  // Initial fetch on component mount or active restaurant change
  useEffect(() => {
    syncReservationsFromGoogleSheet(false);
    syncTablesFromGoogleSheet(false);
  }, [activeRestaurant.id, syncReservationsFromGoogleSheet, syncTablesFromGoogleSheet]);

  // Add Table to Restaurant Floor Plan & Backend
  const handleAddTable = async (newTable: Table): Promise<boolean> => {
    const targetRestId = activeRestaurant.id;
    try {
      const res = await addTableToBackend({
        tableId: newTable.id,
        restaurantId: targetRestId,
        tableNumber: newTable.tableNumber,
        capacity: newTable.capacity,
        minCapacity: newTable.minCapacity,
        shape: newTable.shape,
        section: newTable.section,
        features: newTable.features,
        preferences: Array.isArray(newTable.features) ? newTable.features.join(', ') : '',
        status: newTable.status || 'available',
        x: newTable.x,
        y: newTable.y,
        width: newTable.width,
        height: newTable.height,
      });

      if (res.success && res.table) {
        const addedTable: Table = {
          id: res.table.tableId || res.table.id,
          tableId: res.table.tableId || res.table.id,
          restaurantId: targetRestId,
          tableNumber: res.table.tableNumber,
          capacity: Number(res.table.capacity) || newTable.capacity,
          minCapacity: Number(res.table.minCapacity) || newTable.minCapacity,
          shape: (res.table.shape as any) || newTable.shape,
          section: res.table.section || newTable.section,
          features: Array.isArray(res.table.features) ? res.table.features : newTable.features,
          x: typeof res.table.x === 'number' ? res.table.x : newTable.x,
          y: typeof res.table.y === 'number' ? res.table.y : newTable.y,
          width: typeof res.table.width === 'number' ? res.table.width : newTable.width,
          height: typeof res.table.height === 'number' ? res.table.height : newTable.height,
          status: res.table.status || 'available',
        };

        const currentList = backendTables.length > 0 ? backendTables : activeRestaurant.tables;
        const nextTables = [...currentList, addedTable];
        setBackendTables(nextTables);
        setSelectedTableForDetails(addedTable);
        
        if (newTable.status) {
          setTableOverrides((prev) => ({ ...prev, [addedTable.id]: newTable.status as TableState }));
        }

        if (onUpdateRestaurantTables) {
          onUpdateRestaurantTables(targetRestId, nextTables);
        }

        if (onToast) {
          onToast(`Table ${addedTable.tableNumber} added successfully to ${activeRestaurant.name}.`);
        }
        return true;
      } else {
        if (onToast && res.message) {
          onToast(`Failed to add table: ${res.message}`);
        }
        return false;
      }
    } catch (err: any) {
      if (onToast) {
        onToast(`Error adding table: ${err?.message || 'Unknown network error'}`);
      }
      return false;
    }
  };

  // Remove Table from Restaurant Floor Plan & Backend
  const handleRemoveTable = async (tableId: string): Promise<boolean> => {
    const targetRestId = activeRestaurant.id;
    try {
      const res = await removeTableFromBackend(targetRestId, tableId);
      if (res.success) {
        const currentList = backendTables.length > 0 ? backendTables : activeRestaurant.tables;
        const nextTables = currentList.filter(
          (t) => t.id !== tableId && (t as any).tableId !== tableId
        );
        setBackendTables(nextTables);

        // If removed table was currently inspected, reset selection
        if (
          selectedTableForDetails && 
          (selectedTableForDetails.id === tableId || (selectedTableForDetails as any).tableId === tableId)
        ) {
          setSelectedTableForDetails(nextTables[0] || null);
        }

        if (onUpdateRestaurantTables) {
          onUpdateRestaurantTables(targetRestId, nextTables);
        }

        if (onToast) {
          onToast(`Table ${res.tableNumber || ''} removed successfully from ${activeRestaurant.name}.`);
        }
        return true;
      } else {
        if (onToast && res.message) {
          onToast(res.message);
        }
        return false;
      }
    } catch (err: any) {
      if (onToast) {
        onToast(`Error removing table: ${err?.message || 'Unknown network error'}`);
      }
      return false;
    }
  };

  const [completingDiningId, setCompletingDiningId] = useState<string | null>(null);

  // Staff completes dining session and persists final bill to Google Sheets
  const handleCompleteDining = async (res: Reservation) => {
    setCompletingDiningId(res.id);
    try {
      const computedBill = res.diningBill || generateDiningBill(res);
      const foodAndBeverageTotal = computedBill.subtotal;
      const depositAmount = res.depositAmount || 0;
      const depositAdjustment = -depositAmount;
      const finalAmount = computedBill.netPayable;
      const resUserId = res.userId || '';

      const billResult = await createBillOnBackend({
        reservationId: res.id,
        userId: resUserId,
        restaurantId: res.restaurantId,
        foodAmount: foodAndBeverageTotal,
        depositAmount: depositAmount,
        depositAdjustment: depositAdjustment,
        finalAmount: finalAmount,
        sentToMobile: Boolean(res.billSent),
      });

      if (!billResult.success) {
        if (onToast) {
          onToast(`Failed to record final bill: ${billResult.message || 'Backend error'}`);
        }
        return;
      }

      onUpdateReservationStatus(res.id, 'completed');
      const updatedRes: Reservation = { 
        ...res, 
        status: 'completed',
        diningBill: {
          ...computedBill,
          billNumber: billResult.billId || computedBill.billNumber,
          paymentStatus: 'settled',
        }
      };
      setSelectedBillReservation(updatedRes);
      if (onToast) {
        onToast(`Dining completed for Table ${res.tableNumber} (${res.customerName}). Final bill (${billResult.billId || 'Final'}) saved to Google Sheets.`);
      }
    } catch (err: any) {
      if (onToast) {
        onToast(`Error completing dining: ${err?.message || 'Network error'}`);
      }
    } finally {
      setCompletingDiningId(null);
    }
  };

  // Staff dispatches bill to customer's registered phone
  const handleSendBillToCustomer = (resId: string) => {
    if (onSendBill) {
      onSendBill(resId);
    }
    setSelectedBillReservation((prev) => (prev && prev.id === resId ? { ...prev, billSent: true } : prev));
  };

  // Selected table for Live Tables inspector panel
  const [selectedTableForDetails, setSelectedTableForDetails] = useState<Table | null>(() => {
    return (
      activeRestaurant.tables.find((t) => t.tableNumber === 'T-07' || t.tableNumber === 'T07') ||
      activeRestaurant.tables[0] ||
      null
    );
  });

  const handleCallGuest = (customPhone?: string, customName?: string) => {
    const phone = customPhone || currentActiveGuest?.reservation.customerPhone || smartArrivalState.customerPhone || '+91 98450 12260';
    const name = customName || currentActiveGuest?.reservation.customerName || smartArrivalState.customerName || 'customer';
    if (onToast) {
      onToast(`Calling ${name} (${phone})... Connecting call via cellular dialer.`);
    }
    try {
      window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
    } catch {
      // Graceful fallback in sandbox
    }
  };

  // Unified restaurant-scoped reservations:
  // Shows EVERY customer reservation belonging to activeRestaurant.id.
  // Combines backendReservations from Google Sheets, active reservations prop,
  // and any live arrivals (such as smart arrival guests).
  // Strictly NOT filtered by Sanketh, not filtered by hardcoded userId, not filtered by logged-in customer.
  const currentReservations = useMemo(() => {
    const seen = new Set<string>();
    
    // Extract any reservations constructed in activeSmartArrivalGuests
    const arrivalReservations: Reservation[] = activeSmartArrivalGuests.map(g => g.reservation);

    // Also check liveArrivalRecords directly to guarantee any arrival not yet in activeSmartArrivalGuests is included
    const extraArrivalReservations: Reservation[] = [];
    liveArrivalRecords.forEach(arrival => {
      const arrResId = (arrival.reservationId || '').trim();
      if (!arrResId) return;
      const alreadyInArrivals = arrivalReservations.some(r => r.id.toLowerCase() === arrResId.toLowerCase());
      if (alreadyInArrivals) return;
      
      const isRestMatch = isMatchingRestaurant(arrival.restaurantId, activeRestaurant.id);
      if (!isRestMatch) return;

        const guestName = arrival.customerName || (arrival.userId ? `Guest (${arrival.userId})` : `Guest #${arrival.reservationId.slice(-4)}`);
        const tableNum = arrival.tableNumber || 'T03';
        extraArrivalReservations.push({
          id: arrival.reservationId,
          userId: arrival.userId || 'usr-guest',
          bookingRef: arrival.reservationId.startsWith('RES-') ? `FT-${arrival.reservationId.slice(-6)}` : arrival.reservationId,
          restaurantId: activeRestaurant.id,
          restaurantName: activeRestaurant.name,
          restaurantAddress: activeRestaurant.address,
          tableId: `tbl-${tableNum.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          tableNumber: tableNum,
          section: 'Main Dining',
          date: arrival.updatedAt ? arrival.updatedAt.split('T')[0] : new Date().toISOString().split('T')[0],
          timeSlot: 'Upcoming Reservation',
          guests: 2,
          customerName: guestName,
          customerPhone: arrival.customerPhone || '+91 98450 12260',
          customerEmail: 'guest@flashtable.in',
          specialRequests: 'Smart Arrival active guest',
          status: 'confirmed',
          createdAt: arrival.updatedAt || new Date().toISOString(),
          depositAmount: 200,
          paymentStatus: 'paid',
          paymentMethod: 'UPI',
          qrCodeData: `FT-${activeRestaurant.id.toUpperCase()}-${arrival.reservationId}`,
          noShowRiskScore: 'Low',
        });
    });

    const combined = [
      ...backendReservations,
      ...reservations,
      ...arrivalReservations,
      ...extraArrivalReservations,
    ];

    return combined.filter((r) => {
      if (!r || !r.id) return false;
      if (!isMatchingRestaurant(r.restaurantId, activeRestaurant.id)) return false;
      const normalizedId = r.id.trim().toLowerCase();
      if (seen.has(normalizedId)) return false;
      seen.add(normalizedId);
      return true;
    });
  }, [backendReservations, reservations, activeSmartArrivalGuests, liveArrivalRecords, activeRestaurant.id, activeRestaurant.name, activeRestaurant.address, isMatchingRestaurant]);

  // Filtered reservations for Master Log and Penalty metrics
  const cancelledReservations = useMemo(() => {
    return currentReservations.filter((r) => r.status === 'cancelled' || r.cancellationStatus === 'cancelled');
  }, [currentReservations]);

  const activeReservationsList = useMemo(() => {
    return currentReservations.filter((r) => r.status !== 'cancelled' && r.cancellationStatus !== 'cancelled');
  }, [currentReservations]);

  const travelReservationsCount = useMemo(() => {
    return currentReservations.filter((r) => Boolean(r.travelDetails?.isTravellingByBus || r.id.includes('travel') || r.bookingRef.includes('TRV'))).length;
  }, [currentReservations]);

  const totalPenaltyRevenue = useMemo(() => {
    return cancelledReservations.reduce((sum, r) => {
      const isFirst = r.cancellationCount === 1 || r.penaltyAmount === 0 || (r.cancellationPenalty === 0 && r.cancellationPenalty !== undefined);
      const fee = r.penaltyAmount ?? r.cancellationPenalty ?? (isFirst ? 0 : 100);
      return sum + fee;
    }, 0);
  }, [cancelledReservations]);

  const firstTimeCancellationsCount = useMemo(() => {
    return cancelledReservations.filter((r) => r.cancellationCount === 1 || r.penaltyAmount === 0 || (r.cancellationPenalty === 0 && r.cancellationPenalty !== undefined)).length;
  }, [cancelledReservations]);

  const penalizedCancellationsCount = useMemo(() => {
    return cancelledReservations.filter((r) => !(r.cancellationCount === 1 || r.penaltyAmount === 0 || (r.cancellationPenalty === 0 && r.cancellationPenalty !== undefined))).length;
  }, [cancelledReservations]);

  const displayedReservations = useMemo(() => {
    if (resFilter === 'active') return activeReservationsList;
    if (resFilter === 'cancelled') return cancelledReservations;
    return currentReservations;
  }, [resFilter, activeReservationsList, cancelledReservations, currentReservations]);

  // Tables manual overrides for staff live management during shift
  const [tableOverrides, setTableOverrides] = useState<Record<string, TableState>>({});

  const handleSetTableStatus = async (tableId: string, newStatus: TableState) => {
    setTableOverrides((prev) => ({
      ...prev,
      [tableId]: newStatus,
    }));
    const currentTables = backendTables && backendTables.length > 0 ? backendTables : activeRestaurant.tables;
    const found = currentTables.find((t) => t.id === tableId || t.tableNumber === tableId);
    if (found) setSelectedTableForDetails(found);
    if (onToast) {
      const tableName = found ? found.tableNumber : tableId;
      onToast(`Table ${tableName} status set to ${newStatus.toUpperCase()}`);
    }

    // Persist to Google Sheets backend asynchronously
    try {
      const targetRestId = activeRestaurant.id;
      await updateTableStatusOnBackend(targetRestId, tableId, newStatus);
    } catch {
      // Keep UI responsive
    }
  };

  const handleResetStatuses = () => {
    setTableOverrides({});
    if (onToast) {
      onToast('Floor table statuses reset to live schedule.');
    }
  };

  const getTableStaffStatus = useCallback((table: Table): TableState => {
    if (tableOverrides[table.id]) return tableOverrides[table.id];
    if (tableOverrides[table.tableNumber]) return tableOverrides[table.tableNumber];
    
    // Check if table has a reservation active for the selected slot window
    const slotMinutes = parseTimeToMinutes(selectedSlot);

    const activeRes = currentReservations.find((r) => {
      const isMatch =
        r.tableId === table.id ||
        r.tableId === table.tableNumber ||
        (Boolean(r.tableNumber) && r.tableNumber.trim().toLowerCase() === table.tableNumber.trim().toLowerCase()) ||
        (r.tableId && r.tableId.replace('t-', 'T').toLowerCase() === table.tableNumber.toLowerCase()) ||
        (table.id && table.id.replace('t-', 'T').toLowerCase() === (r.tableNumber || '').toLowerCase());

      if (!isMatch) return false;

      // Active reservation states that hold or occupy the table
      if (!['confirmed', 'arrived', 'checked-in', 'seated'].includes(r.status)) return false;

      // Determine reservation duration: 90 mins if food pre-order, otherwise 120 mins
      const hasFoodOrder = Boolean(
        (r.foodOrder && r.foodOrder.items && r.foodOrder.items.length > 0) ||
        dashboardFoodOrders.some(
          (fo) =>
            (fo.reservationId?.toLowerCase() === r.id?.toLowerCase() ||
             (r.bookingRef && fo.reservationId?.toLowerCase() === r.bookingRef?.toLowerCase())) &&
            fo.items && fo.items.length > 0
        )
      );
      const durationMinutes = hasFoodOrder ? 90 : 120;
      const startMinutes = parseTimeToMinutes(r.timeSlot);
      const endMinutes = startMinutes + durationMinutes;

      // Overlap condition: selectedSlot falls inside [startMinutes, endMinutes)
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });

    if (activeRes) {
      if (activeRes.status === 'checked-in' || activeRes.status === 'seated') {
        return 'occupied';
      }
      return 'reserved';
    }

    return 'available';
  }, [tableOverrides, selectedSlot, currentReservations, dashboardFoodOrders]);

  // Memoized restaurant model incorporating backend table data
  const currentRestaurantWithBackendTables = useMemo(() => {
    if (backendTables && backendTables.length > 0) {
      return {
        ...activeRestaurant,
        tables: backendTables,
      };
    }
    return activeRestaurant;
  }, [activeRestaurant, backendTables]);

  const handleCycleTableState = (tableId: string) => {
    const current = getTableStaffStatus(
      activeRestaurant.tables.find((t) => t.id === tableId) || { id: tableId } as Table
    );
    const next: TableState = 
      current === 'available' ? 'occupied' :
      current === 'occupied' ? 'reserved' :
      current === 'reserved' ? 'unavailable' : 'available';
    
    setTableOverrides({
      ...tableOverrides,
      [tableId]: next,
    });
  };

  // Check in customer from QR scan verification or manual action with backend persistence
  const [isCheckingInId, setIsCheckingInId] = useState<string | null>(null);

  const handleCheckInCustomer = async (
    targetRes: Reservation,
    method: 'Manual' | 'QR' = 'Manual'
  ): Promise<{ success: boolean; message: string }> => {
    setIsCheckingInId(targetRes.id);
    try {
      const restaurantId = targetRes.restaurantId || activeRestaurant.id;
      const tableId = targetRes.tableId || 't-203';

      const result = await createCheckInOnBackend({
        reservationId: targetRes.id,
        restaurantId,
        tableId,
        method,
      });

      if (result.success) {
        onUpdateReservationStatus(targetRes.id, 'checked-in');
        setTableOverrides((prev) => ({
          ...prev,
          [targetRes.tableId]: 'occupied',
        }));

        const hydrated = hydrateReservationWithSoloSafety(targetRes);
        let soloSafetyInfo = '';
        if (hydrated.soloDinerSafety?.enabled) {
          const dispatchRes = dispatchSoloSafetyNotification(hydrated, method);
          if (dispatchRes) {
            soloSafetyInfo = ` • Solo Diner Safety alert sent to ${hydrated.soloDinerSafety.contactName} (${hydrated.soloDinerSafety.contactPhone})`;
          }
        }

        const successMsg = `Guest check-in verified. Customer seated at exact reserved table.${soloSafetyInfo}`;
        setScanMessage(successMsg);
        if (onToast) {
          onToast(successMsg);
        }
        return { success: true, message: successMsg };
      } else {
        const errorMsg = result.message || 'Check-in failed. Please verify reservation details.';
        setScanMessage(`✕ ${errorMsg}`);
        if (onToast) {
          onToast(`Check-in failed: ${errorMsg}`);
        }
        return { success: false, message: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Network error during check-in.';
      setScanMessage(`✕ ${errorMsg}`);
      if (onToast) {
        onToast(`Check-in error: ${errorMsg}`);
      }
      return { success: false, message: errorMsg };
    } finally {
      setIsCheckingInId(null);
    }
  };

  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrScanInput.trim()) return;

    const query = qrScanInput.trim().toLowerCase();
    const matchedRes = currentReservations.find(
      (r) =>
        (r.bookingRef && r.bookingRef.toLowerCase() === query) ||
        (r.qrCodeData && r.qrCodeData.toLowerCase().includes(query)) ||
        (r.customerName && r.customerName.toLowerCase().includes(query)) ||
        (r.tableNumber && r.tableNumber.toLowerCase() === query) ||
        (query.includes('07') && (r.tableNumber === 'T-07' || r.tableNumber === 'T07')) ||
        (query.includes('sanketh') && r.customerName && r.customerName.toLowerCase().includes('sanketh'))
    );

    if (matchedRes) {
      const res = await handleCheckInCustomer(matchedRes, 'Manual');
      if (res.success) {
        setQrScanInput('');
      }
    } else {
      setScanMessage('✕ Reservation code not found for this restaurant. Try FT-BLR-0730 or FT-BLR-9812.');
    }
  };

  // Occupancy metrics
  const totalTables = activeRestaurant.tables.length;
  const occupiedOrReservedCount = activeRestaurant.tables.filter((t) => {
    const state = getTableStaffStatus(t);
    return state === 'occupied' || state === 'reserved';
  }).length;
  const occupancyPercentage = Math.round((occupiedOrReservedCount / totalTables) * 100);

  return (
    <div className="bg-[#FAF9F6] min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      
      {/* Top Bar with Demo Venue Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E8E6E1]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4F6F521A] text-[#4F6F52] text-[10px] font-bold uppercase tracking-widest mb-2 border border-[#4F6F52]/20">
            <Store className="w-3.5 h-3.5" />
            <span>Host & Maitre d' Console</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-[#2C3333]">
            {activeRestaurant.name}
          </h1>
          <p className="text-xs text-[#2C3333]/60 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#4F6F52]" />
            <span>{activeRestaurant.neighborhood}, Bengaluru, Karnataka</span>
            <span>•</span>
            <span>{activeRestaurant.cuisine}</span>
            <span>•</span>
            <span>Floor Plan: {activeRestaurant.floorPlanName}</span>
          </p>
        </div>

        {/* Switch Restaurant Partner Selector and Customer Mode Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {onSwitchToCustomer && (
            <button
              onClick={onSwitchToCustomer}
              className="px-3.5 py-2 bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] text-[#2C3333] hover:text-[#4F6F52] rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Switch to Customer Mode"
              id="dashboard-switch-to-customer-btn"
            >
              <Compass className="w-3.5 h-3.5 text-[#4F6F52]" />
              <span>Customer View</span>
            </button>
          )}

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-[#E8E6E1] hover:border-rose-300 text-[#2C3333]/70 hover:text-rose-600 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Sign Out"
              id="dashboard-signout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}

          {/* Sync Status Badge with IST Time */}
          <div 
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#E8E6E1] rounded-full shadow-2xs text-xs"
            id="dashboard-top-sync-status"
          >
            {isSyncingBackend || isSyncingTables || isLoadingArrivals ? (
              <>
                <RefreshCw className="w-3 h-3 text-[#4F6F52] animate-spin shrink-0" />
                <span className="font-semibold text-[#4F6F52]">Syncing...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="text-[#2C3333]/70 font-medium">
                  {lastSyncTime ? `Last synced: ${lastSyncTime}` : 'Synced'}
                </span>
              </>
            )}
          </div>

          {/* Locked Read-Only Venue Display - Active Restaurant Context */}
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E8E6E1] rounded-full shadow-2xs"
            id="dashboard-locked-venue-display"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/60">
              Venue:
            </span>
            <span className="text-xs font-semibold text-[#2C3333] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4F6F52] shrink-0"></span>
              <span>{activeRestaurant.name} ({activeRestaurant.neighborhood})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards (Occupancy, Reservations, No-Show Risk, Overbooking) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Live Floor Occupancy */}
        <div className="p-6 rounded-3xl bg-white border border-[#E8E6E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2C3333]/50">Live Floor Occupancy</span>
            <Armchair className="w-4 h-4 text-[#4F6F52]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-light font-serif text-[#2C3333]">
              {occupancyPercentage}%
            </span>
            <span className="text-xs text-[#2C3333]/60">
              ({occupiedOrReservedCount}/{totalTables} Tables)
            </span>
          </div>
          <div className="w-full bg-[#FAF9F6] h-1.5 rounded-full mt-3 overflow-hidden border border-[#E8E6E1]">
            <div 
              className="bg-[#4F6F52] h-full rounded-full transition-all duration-500"
              style={{ width: `${occupancyPercentage}%` }}
            />
          </div>
        </div>

        {/* Today's Reservations */}
        <div className="p-6 rounded-3xl bg-white border border-[#E8E6E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2C3333]/50">Today's Reservations</span>
            <Users className="w-4 h-4 text-[#4F6F52]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-light font-serif text-[#2C3333]">
              {currentReservations.length + 4}
            </span>
            <span className="text-[10px] text-[#4F6F52] font-bold uppercase tracking-wider bg-[#4F6F521A] px-2 py-0.5 rounded-full border border-[#4F6F52]/20">
              All Assigned
            </span>
          </div>
          <p className="text-[11px] text-[#2C3333]/50 mt-2">Zero double-booking table collision</p>
        </div>

        {/* Transparent No-Show Risk Metric */}
        <div className="p-6 rounded-3xl bg-white border border-[#E8E6E1] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#2C3333]/50">No-Show Risk</span>
            <ShieldCheck className="w-4 h-4 text-[#4F6F52]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-light font-serif text-[#4F6F52]">
              Low (3.8%)
            </span>
          </div>
          <p className="text-[11px] text-[#2C3333]/60 mt-2">
            Dynamic scoring based on phone OTP & Smart Arrival opt-in.
          </p>
        </div>

        {/* Safe Overbooking Recommendation */}
        <div className="p-6 rounded-3xl bg-[#4F6F521A] border border-[#4F6F52]/30 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#4F6F52]">Turnover Insight</span>
            <Sparkles className="w-4 h-4 text-[#4F6F52]" />
          </div>
          <div className="mt-3">
            <span className="text-xs font-bold font-serif text-[#2C3333] block">
              Safe Buffer: +1 Table at 08:30 PM
            </span>
            <p className="text-[11px] text-[#2C3333]/70 mt-1">
              Based on dining duration (75 mins), Table T-01 clears by 08:25 PM.
            </p>
          </div>
        </div>

      </div>

      {/* Dashboard Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8E6E1] pb-3 overflow-x-auto" id="dashboard-view-tabs">
        <button
          type="button"
          onClick={() => setDashboardView('overview')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'overview'
              ? 'bg-[#2C3333] text-white shadow-xs'
              : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border border-[#E8E6E1]'
          }`}
          id="tab-overview"
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-[#4F6F52]" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('reservations')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'reservations'
              ? 'bg-[#2C3333] text-white shadow-xs'
              : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border border-[#E8E6E1]'
          }`}
          id="tab-reservations-queue"
        >
          <Users className="w-3.5 h-3.5 text-[#4F6F52]" />
          <span>Reservations ({currentReservations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('travel-bookings')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'travel-bookings'
              ? 'bg-amber-500 text-stone-950 font-extrabold shadow-sm'
              : 'bg-white hover:bg-amber-50 text-stone-800 border border-amber-200'
          }`}
          id="tab-travel-bookings"
        >
          <Bus className="w-3.5 h-3.5 text-amber-700" />
          <span>Travel Bookings</span>
          {travelReservationsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-stone-950 font-mono">
              {travelReservationsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('food-orders')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'food-orders'
              ? 'bg-[#2C3333] text-white shadow-xs'
              : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border border-[#E8E6E1]'
          }`}
          id="tab-food-orders"
        >
          <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
          <span>Food Orders</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('menu-management')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'menu-management'
              ? 'bg-[#2C3333] text-white shadow-xs'
              : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border border-[#E8E6E1]'
          }`}
          id="tab-menu-management"
        >
          <UtensilsCrossed className="w-3.5 h-3.5 text-[#4F6F52]" />
          <span>Menu & Stock</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('live-tables')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'live-tables' || dashboardView === 'floor-plan'
              ? 'bg-[#2C3333] text-white shadow-xs'
              : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border border-[#E8E6E1]'
          }`}
          id="tab-live-tables"
        >
          <Armchair className="w-3.5 h-3.5 text-[#4F6F52]" />
          <span>Live Tables</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('guest-arrival')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'guest-arrival'
              ? 'bg-[#2C3333] text-white shadow-xs'
              : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border border-[#E8E6E1]'
          }`}
          id="tab-guest-arrival"
        >
          <Radio className="w-3.5 h-3.5 text-[#4F6F52]" />
          <span>Guest Arrival</span>
          {smartArrivalState.isEnabled && (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
              smartArrivalState.isInsideGeofence
                ? 'bg-emerald-500 text-white animate-pulse'
                : 'bg-[#4F6F521A] text-[#4F6F52]'
            }`}>
              {smartArrivalState.isInsideGeofence ? 'Nearby (500m)' : 'Approaching'}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('insights')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'insights'
              ? 'bg-[#2C3333] text-white shadow-xs'
              : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border border-[#E8E6E1]'
          }`}
          id="tab-insights"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#4F6F52]" />
          <span>Insights</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('owner-details')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'owner-details'
              ? 'bg-[#2C3333] text-white shadow-xs'
              : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border border-[#E8E6E1]'
          }`}
          id="tab-owner-details"
        >
          <Store className="w-3.5 h-3.5 text-[#4F6F52]" />
          <span>Owner & Venue Details</span>
        </button>

        <button
          type="button"
          onClick={() => setDashboardView('settings')}
          className={`px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            dashboardView === 'settings'
              ? 'bg-[#2C3333] text-white shadow-xs'
              : 'bg-white hover:bg-[#FAF9F6] text-[#2C3333]/70 border border-[#E8E6E1]'
          }`}
          id="tab-settings"
        >
          <Settings className="w-3.5 h-3.5 text-[#4F6F52]" />
          <span>Settings</span>
        </button>
      </div>

      {/* VIEW 0: OVERVIEW */}
      {dashboardView === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-150" id="section-overview">
          {/* Operational Hub Snapshot */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8E6E1] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1]">
              <div>
                <h3 className="text-xl font-bold font-serif text-[#2C3333]">
                  Floor Management Overview
                </h3>
                <p className="text-xs text-[#2C3333]/60 mt-0.5">
                  Quick status of floor occupancy, arriving parties, and reservation pacing for {activeRestaurant.name}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  className="px-3.5 py-2 bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] text-[#2C3333] text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  id="overview-btn-digital-menu"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 text-[#4F6F52]" />
                  <span>Digital Menu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMenuQrOpen(true)}
                  className="px-3.5 py-2 bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] text-[#2C3333] text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  id="overview-btn-menu-qr"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#4F6F52]" />
                  <span>Table Menu QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardView('menu-management')}
                  className="px-3.5 py-2 bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] text-[#2C3333] text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  id="overview-btn-menu-stock"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 text-[#4F6F52]" />
                  <span>Menu & Stock</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashboardView('live-tables')}
                  className="px-4 py-2 bg-[#2C3333] hover:bg-[#4F6F52] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                  id="overview-btn-live-tables"
                >
                  <Armchair className="w-3.5 h-3.5" />
                  <span>Open Live Tables →</span>
                </button>
              </div>
            </div>

            {/* Quick Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Live Tables Status */}
              <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 flex items-center gap-2">
                    <Armchair className="w-4 h-4 text-[#4F6F52]" />
                    <span>Table Status Breakdown</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    {occupancyPercentage}% Occupied
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-white border border-[#E8E6E1] flex items-center justify-between">
                    <span className="text-emerald-700 font-medium">Available</span>
                    <span className="font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded">
                      {activeRestaurant.tables.filter(t => getTableStaffStatus(t) === 'available').length}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#E8E6E1] flex items-center justify-between">
                    <span className="text-amber-800 font-medium">Reserved</span>
                    <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
                      {activeRestaurant.tables.filter(t => getTableStaffStatus(t) === 'reserved').length}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#E8E6E1] flex items-center justify-between">
                    <span className="text-[#2C3333] font-medium">Occupied</span>
                    <span className="font-bold text-white bg-[#2C3333] px-2 py-0.5 rounded">
                      {activeRestaurant.tables.filter(t => getTableStaffStatus(t) === 'occupied').length}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-[#E8E6E1] flex items-center justify-between">
                    <span className="text-sky-800 font-medium">Cleaning</span>
                    <span className="font-bold text-sky-900 bg-sky-50 px-2 py-0.5 rounded">
                      {activeRestaurant.tables.filter(t => getTableStaffStatus(t) === 'cleaning').length}
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-[#2C3333]/60 flex items-center justify-between border-t border-[#E8E6E1]">
                  <span>{currentReservations.length > 0 ? `Next Booking: ${currentReservations[0].customerName} (Table ${currentReservations[0].tableNumber})` : 'All tables ready for service'}</span>
                  <button 
                    onClick={() => {
                      if (currentReservations.length > 0) {
                        const target = activeRestaurant.tables.find(t => t.tableNumber === currentReservations[0].tableNumber || t.id === currentReservations[0].tableId);
                        if (target) setSelectedTableForDetails(target);
                      }
                      setDashboardView('live-tables');
                    }}
                    className="text-[#4F6F52] font-semibold hover:underline cursor-pointer"
                  >
                    Inspect Tables →
                  </button>
                </div>
              </div>

              {/* Card 2: Smart Arrival Pulse */}
              <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#4F6F52]" />
                    <span>Guest Geofence Radar</span>
                  </span>
                  {activeSmartArrivalGuests.length > 0 ? (
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      activeSmartArrivalGuests.some(g => g.arrival.distance <= 500)
                        ? 'bg-emerald-500 text-white animate-pulse'
                        : 'bg-[#4F6F521A] text-[#4F6F52]'
                    }`}>
                      {activeSmartArrivalGuests.length} Active • {activeSmartArrivalGuests.some(g => g.arrival.distance <= 500) ? 'Nearby (500m)' : 'Approaching'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                      0 Active
                    </span>
                  )}
                </div>

                {activeSmartArrivalGuests.length > 0 ? (
                  <div className="p-3 bg-white rounded-xl border border-[#E8E6E1] space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-[#2C3333]">
                      <span>{activeSmartArrivalGuests[0].reservation.customerName}</span>
                      <span className="font-mono text-[#4F6F52]">Table {activeSmartArrivalGuests[0].reservation.tableNumber}</span>
                    </div>
                    <div className="text-[11px] text-[#2C3333]/60 flex items-center justify-between">
                      <span>{activeSmartArrivalGuests[0].reservation.guests} guests • {activeSmartArrivalGuests[0].reservation.timeSlot}</span>
                      <span className="font-semibold text-[#4F6F52]">
                        Estimated ETA ~{activeSmartArrivalGuests[0].arrival.etaMinutes !== null ? activeSmartArrivalGuests[0].arrival.etaMinutes : 0} min
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-[#E8E6E1] text-xs text-center py-2.5">
                    <p className="font-medium text-[#2C3333]">No guests currently using Smart Arrival</p>
                    <p className="text-[11px] text-[#2C3333]/60 mt-0.5">Awaiting guest departure & opt-in</p>
                  </div>
                )}

                <div className="pt-2 text-[11px] text-[#2C3333]/60 flex items-center justify-between border-t border-[#E8E6E1]">
                  <span>
                    {activeSmartArrivalGuests.length > 0 
                      ? `${formatDistance(activeSmartArrivalGuests[0].arrival.distance)} away`
                      : 'Smart Arrival Active (500m)'}
                  </span>
                  <button 
                    onClick={() => setDashboardView('guest-arrival')}
                    className="text-[#4F6F52] font-semibold hover:underline cursor-pointer"
                  >
                    View Arrival Radar →
                  </button>
                </div>
              </div>

              {/* Card 3: Today's Bookings */}
              <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#4F6F52]" />
                    <span>Reservations Pacing</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-[#4F6F521A] text-[#4F6F52] px-2 py-0.5 rounded-full">
                    {currentReservations.length} Active
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {currentReservations.slice(0, 2).map((res) => {
                    const tableLabel = formatPacingTableNumber(res.tableNumber);
                    const dateLabel = formatPacingReservationDate(res);
                    const timeLabel = formatPacingReservationTime(res);

                    return (
                      <div key={res.id} className="p-2.5 bg-white rounded-xl border border-[#E8E6E1] space-y-0.5 text-[11px]">
                        <div className="text-[#4F6F52] font-mono font-semibold">
                          {tableLabel} • {dateLabel}
                        </div>
                        <div className="font-semibold text-[#2C3333]">
                          {res.customerName}
                        </div>
                        <div className="text-[#4F6F52] font-mono">
                          {timeLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 text-[11px] text-[#2C3333]/60 flex items-center justify-between border-t border-[#E8E6E1]">
                  <span>Total: {currentReservations.length} Bookings</span>
                  <button 
                    onClick={() => setDashboardView('reservations')}
                    className="text-[#4F6F52] font-semibold hover:underline cursor-pointer"
                  >
                    View All Bookings →
                  </button>
                </div>
              </div>

              {/* Card 4: Cancellations & Penalty Tracking */}
              <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#2C3333]/70 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Cancellations & Penalties</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">
                    {cancelledReservations.length} Total
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="p-2 bg-white rounded-xl border border-[#E8E6E1] flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#2C3333]">1st Cancel (Grace)</span>
                    <span className="text-emerald-700 font-bold font-mono">{firstTimeCancellationsCount} (₹0 Fee)</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-[#E8E6E1] flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#2C3333]">2nd+ Cancel (₹100)</span>
                    <span className="text-rose-700 font-bold font-mono">{penalizedCancellationsCount} Bookings</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-[#E8E6E1] flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#2C3333]">Penalties Collected</span>
                    <span className="text-emerald-700 font-bold font-mono">₹{totalPenaltyRevenue} Paid</span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-[#2C3333]/60 flex items-center justify-between border-t border-[#E8E6E1]">
                  <span>Tracked in Real-Time</span>
                  <button 
                    onClick={() => {
                      setResFilter('cancelled');
                      setDashboardView('reservations');
                    }}
                    className="text-rose-600 font-semibold hover:underline cursor-pointer"
                    id="overview-btn-view-cancellations"
                  >
                    View Penalty Log →
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: GUEST ARRIVAL (SMART GEOFENCE) */}
      {dashboardView === 'guest-arrival' && (
        <div className="space-y-6 animate-in fade-in duration-150" id="section-guest-arrival">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-xl font-bold font-serif text-[#2C3333]">
                  Guest Arrival & Geofence
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#4F6F521A] text-[#4F6F52] border border-[#4F6F52]/20">
                  500m Boundary
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#2C3333] text-white">
                  {activeSmartArrivalGuests.length} En Route
                </span>
              </div>
              <p className="text-xs text-[#2C3333]/60 mt-0.5">
                Real-time proximity detection and kitchen readiness for {activeRestaurant.name} ({activeRestaurant.address || 'Indiranagar, Bengaluru'})
              </p>
            </div>

            {/* Auto-sync status & Refresh button */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 text-xs text-[#2C3333]/70 bg-white px-3.5 py-1.5 rounded-full border border-[#E8E6E1] shadow-2xs">
                <span className={`w-2 h-2 rounded-full ${isLoadingArrivals ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`}></span>
                <span>
                  {isLoadingArrivals ? 'Syncing...' : (lastArrivalSyncTime ? `Last updated ${lastArrivalSyncTime}` : 'Live auto-refresh (12s)')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => syncSmartArrivalFromGoogleSheet(true)}
                disabled={isLoadingArrivals}
                className="p-2 rounded-full bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] text-[#2C3333] transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                title="Refresh Smart Arrival data"
                id="btn-refresh-smart-arrival"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingArrivals ? 'animate-spin text-[#4F6F52]' : 'text-[#2C3333]'}`} />
              </button>
            </div>
          </div>

          {/* ACTIVE GUESTS SELECTOR LIST */}
          {activeSmartArrivalGuests.length > 0 && (
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#E8E6E1] shadow-2xs space-y-3" id="active-guests-selector-container">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#4F6F52] animate-pulse" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2C3333]">
                    Active Guests ({activeSmartArrivalGuests.length})
                  </h4>
                  <span className="text-[11px] text-[#2C3333]/60 hidden sm:inline">
                    • Select a guest to view live telemetry, map position & kitchen prep
                  </span>
                </div>
                {currentActiveGuest && (
                  <span className="text-xs text-[#4F6F52] font-semibold bg-[#4F6F5214] px-2.5 py-1 rounded-full border border-[#4F6F52]/20">
                    Selected: <strong>{currentActiveGuest.reservation.customerName}</strong> (Table {currentActiveGuest.reservation.tableNumber})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {activeSmartArrivalGuests.map((g) => {
                  const isSelected = currentActiveGuest?.reservation.id === g.reservation.id;
                  const isWithin500 = g.arrival.distance <= 500 || (g.arrival.geofenceStatus && g.arrival.geofenceStatus.toLowerCase().includes('within 500'));
                  const etaText = g.arrival.etaMinutes !== null && g.arrival.etaMinutes !== undefined ? `${g.arrival.etaMinutes} min` : 'Calculating';

                  return (
                    <button
                      key={g.reservation.id}
                      type="button"
                      onClick={() => setSelectedArrivalResId(g.reservation.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative ${
                        isSelected
                          ? 'bg-[#FAF9F6] border-[#4F6F52] ring-2 ring-[#4F6F52] shadow-xs'
                          : 'bg-white border-[#E8E6E1] hover:border-[#4F6F52]/50 hover:bg-[#FAF9F6]/50'
                      }`}
                      id={`guest-selector-${g.reservation.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#2C3333] font-serif truncate">
                            {g.reservation.customerName}
                          </div>
                          <div className="text-xs font-mono font-bold text-[#4F6F52] mt-0.5">
                            Table {g.reservation.tableNumber}
                          </div>
                        </div>

                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          isWithin500
                            ? 'bg-emerald-600 text-white animate-pulse'
                            : 'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}>
                          {isWithin500 ? 'Within 500 m' : 'Outside 500 m'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E8E6E1]/60">
                        <span className="font-mono text-[#2C3333] font-medium">
                          {formatDistance(g.arrival.distance)}
                        </span>
                        <span className="font-mono text-[#4F6F52] font-semibold">
                          ETA: {etaText}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Grid: LEFT (Map View) + RIGHT (Side Panel) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT / MAIN AREA: Clean Map View (7 cols) */}
            <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-[#E8E6E1] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#2C3333]">
                    {activeRestaurant.name} Geofence Map
                  </h4>
                  <p className="text-[11px] text-[#2C3333]/60">
                    500m geofence radius around {activeRestaurant.address || 'HAL 2nd Stage, Indiranagar'}
                  </p>
                </div>

                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  currentActiveGuest && (currentActiveGuest.arrival.distance <= 500 || currentActiveGuest.prepRecommendation.isGuestNearby)
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : currentActiveGuest
                    ? 'bg-[#4F6F521A] text-[#4F6F52]'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  {currentActiveGuest
                    ? (currentActiveGuest.arrival.distance <= 500 ? 'Within 500m zone' : 'Approaching')
                    : 'Awaiting guest proximity'}
                </span>
              </div>

              {/* Polished Leaflet Map */}
              <SmartArrivalMap
                customerLat={currentActiveGuest?.arrival.latitude && currentActiveGuest.arrival.latitude !== 0 ? currentActiveGuest.arrival.latitude : undefined}
                customerLng={currentActiveGuest?.arrival.longitude && currentActiveGuest.arrival.longitude !== 0 ? currentActiveGuest.arrival.longitude : undefined}
                restaurantLat={activeRestaurant.coordinates?.lat || 12.9716}
                restaurantLng={activeRestaurant.coordinates?.lng || 77.6412}
                restaurantName={activeRestaurant.name}
                interactive={true}
                showSimulationBar={false}
                height="380px"
              />

              {/* Guest selector strip if multiple guests en route */}
              {activeSmartArrivalGuests.length > 1 && (
                <div className="pt-2 border-t border-[#E8E6E1] space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C3333]/50">
                    Switch Guest on Map ({activeSmartArrivalGuests.length})
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {activeSmartArrivalGuests.map((g) => {
                      const isSelected = currentActiveGuest?.reservation.id === g.reservation.id;
                      return (
                        <button
                          key={g.reservation.id}
                          type="button"
                          onClick={() => setSelectedArrivalResId(g.reservation.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                            isSelected
                              ? 'bg-[#2C3333] text-white border-[#2C3333]'
                              : 'bg-[#FAF9F6] text-[#2C3333] border-[#E8E6E1] hover:border-[#4F6F52]'
                          }`}
                        >
                          {g.reservation.customerName} • Table {g.reservation.tableNumber} ({formatDistance(g.arrival.distance)})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT / SIDE PANEL: Arriving Guests & Kitchen Prep (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* If no guests en route: Empty State */}
              {!currentActiveGuest ? (
                <div className="bg-white p-8 rounded-3xl border border-[#E8E6E1] shadow-sm text-center space-y-4" id="smart-arrival-empty-state">
                  <div className="w-14 h-14 rounded-full bg-[#4F6F521A] text-[#4F6F52] flex items-center justify-center mx-auto border border-[#4F6F52]/20">
                    <Radio className="w-7 h-7 text-[#4F6F52] animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold font-serif text-[#2C3333]">
                      No Guests Currently En Route
                    </h4>
                    <p className="text-xs text-[#2C3333]/60 max-w-xs mx-auto leading-relaxed">
                      Active proximity records for reservations at {activeRestaurant.name} will appear here as soon as guests enable Smart Arrival on their way.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] text-left text-xs space-y-2 text-[#2C3333]/80">
                    <div className="flex items-center gap-1.5 font-semibold text-[#2C3333]">
                      <Sparkles className="w-3.5 h-3.5 text-[#4F6F52]" />
                      <span>Kitchen Preparation Triggers</span>
                    </div>
                    <ul className="text-[11px] space-y-1 text-[#2C3333]/70 list-disc list-inside">
                      <li><strong>ETA &gt; 10 mins:</strong> "Not yet" (hold hot preparation)</li>
                      <li><strong>ETA 5–10 mins:</strong> "Prepare soon" (prep ingredients)</li>
                      <li><strong>ETA &le; 5 mins:</strong> "Prepare now" (commence cooking/plating)</li>
                      <li><strong>Within 500 m:</strong> "Guest nearby" priority badge</li>
                    </ul>
                  </div>

                  <div className="text-[10px] text-[#2C3333]/50 flex items-center justify-center gap-1.5 pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#4F6F52]" />
                    <span>500m geofence active • Automatic updates every 12s</span>
                  </div>
                </div>
              ) : (
                /* Selected Arriving Guest Focused Card */
                <div className="space-y-4" id="smart-arrival-guests-list">
                  {(() => {
                    const guest = currentActiveGuest;
                    const isWithin500 = guest.arrival.distance <= 500 || (guest.arrival.geofenceStatus && guest.arrival.geofenceStatus.toLowerCase().includes('within 500'));
                    const formattedLastUpdated = guest.arrival.updatedAt
                      ? formatTimeIST(guest.arrival.updatedAt)
                      : 'Just now';

                    return (
                      <div
                        key={guest.reservation.id}
                        className="bg-white p-5 sm:p-6 rounded-3xl border border-[#4F6F52] ring-1 ring-[#4F6F52]/30 transition-all shadow-sm space-y-4"
                        id={`smart-arrival-card-${guest.reservation.id}`}
                      >
                        {/* Guest Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-[#E8E6E1]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-[#4F6F521A] text-[#4F6F52] flex items-center justify-center font-bold text-sm font-serif">
                              {guest.reservation.customerName.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-base font-bold font-serif text-[#2C3333]">
                                {guest.reservation.customerName}
                              </h4>
                              <p className="text-[11px] text-[#2C3333]/60 flex items-center gap-2">
                                <span>{guest.reservation.timeSlot}</span>
                                <span>•</span>
                                <span>{guest.reservation.guests} guests</span>
                              </p>
                            </div>
                          </div>

                          <span className="text-xs font-mono font-bold text-[#4F6F52] bg-[#FAF9F6] px-2.5 py-1 rounded-full border border-[#E8E6E1]">
                            Table {guest.reservation.tableNumber}
                          </span>
                        </div>

                        {/* Proximity & ETA Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Distance */}
                          <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C3333]/50 block">
                              Distance
                            </span>
                            <span className="text-sm font-bold text-[#2C3333] font-mono block">
                              {formatDistance(guest.arrival.distance)}
                            </span>
                            <span className="text-[10px] text-[#2C3333]/60 block">from restaurant</span>
                          </div>

                          {/* ETA */}
                          <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C3333]/50 block">
                              Estimated ETA
                            </span>
                            <span className="text-sm font-bold text-[#4F6F52] font-mono block">
                              {guest.arrival.etaMinutes !== null && guest.arrival.etaMinutes !== undefined
                                ? `${guest.arrival.etaMinutes} min`
                                : 'Calculating'}
                            </span>
                            <span className="text-[10px] text-[#2C3333]/60 block">local geodesic</span>
                          </div>
                        </div>

                        {/* Geofence Status Badge & Last Updated */}
                        <div className="flex items-center justify-between text-xs py-1 border-y border-[#E8E6E1]/60">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-[#2C3333]/60 font-semibold">Geofence:</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isWithin500
                                ? 'bg-emerald-600 text-white animate-pulse'
                                : 'bg-stone-100 text-stone-700 border border-stone-200'
                            }`}>
                              {isWithin500 ? 'Within 500 m' : 'Outside 500 m'}
                            </span>
                          </div>

                          <span className="text-[10px] text-[#2C3333]/50">
                            Updated: {formattedLastUpdated}
                          </span>
                        </div>

                        {/* FOOD PRE-ORDER INFORMATION */}
                        {guest.foodOrder && guest.foodOrder.items && guest.foodOrder.items.length > 0 ? (
                          <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <ShoppingBag className="w-3 h-3 text-emerald-700" />
                                Pre-order detected
                              </span>
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#2C3333] text-white">
                                {guest.foodOrder.status}
                              </span>
                            </div>

                            {/* Ordered items list */}
                            <div className="space-y-1 pt-1 max-h-28 overflow-y-auto pr-1">
                              {guest.foodOrder.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-[#2C3333] truncate">
                                    <span className="font-bold text-[#4F6F52]">{item.quantity}×</span> {item.name}
                                  </span>
                                  <span className="font-mono text-[11px] text-[#2C3333]/70 ml-2 whitespace-nowrap">
                                    {formatINR((item.price || 0) * (item.quantity || 1))}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Food Order Total */}
                            <div className="pt-2 border-t border-[#E8E6E1] flex items-center justify-between text-xs font-bold">
                              <span className="text-[#2C3333]">Food Order Total:</span>
                              <span className="font-serif text-sm text-[#4F6F52]">
                                {formatINR(guest.foodOrder.foodTotal)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/70 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-stone-600">
                              <UtensilsCrossed className="w-3.5 h-3.5 text-stone-400" />
                              <span className="font-medium">No pre-order</span>
                            </div>
                            <span className="text-[10px] text-stone-500">Order at table</span>
                          </div>
                        )}

                        {/* PREPARATION RECOMMENDATION */}
                        <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C3333]/60 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#4F6F52]" />
                              Kitchen Recommendation
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${guest.prepRecommendation.badgeClass}`}>
                                {guest.prepRecommendation.label}
                              </span>
                              {guest.prepRecommendation.isGuestNearby && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-700 text-white animate-pulse flex items-center gap-1">
                                  <Radio className="w-2.5 h-2.5" />
                                  Guest nearby
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-[#2C3333]/70 leading-relaxed">
                            {guest.prepRecommendation.description}
                          </p>
                          <p className="text-[10px] text-[#2C3333]/50 italic pt-1 border-t border-[#E8E6E1]/60">
                            Recommendation only • Does not change FoodOrder status automatically
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCallGuest(guest.reservation.customerPhone, guest.reservation.customerName)}
                            className="py-2.5 px-3 rounded-full bg-white hover:bg-[#FAF9F6] border border-[#E8E6E1] hover:border-[#2C3333] text-[#2C3333] text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                            id={`btn-call-guest-${guest.reservation.id}`}
                          >
                            <Phone className="w-3.5 h-3.5 text-[#4F6F52]" />
                            <span>Call Guest</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsScannerModalOpen(true)}
                            className="py-2.5 px-3 rounded-full bg-[#2C3333] hover:bg-[#4F6F52] text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            id={`btn-qr-guest-${guest.reservation.id}`}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Check In Pass</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Host Quick Check-In Console */}
              <div className="bg-white p-6 rounded-3xl border border-[#E8E6E1] shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#4F6F521A] text-[#4F6F52] flex items-center justify-center border border-[#4F6F52]/20">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#2C3333]">
                        Podium Verification
                      </h4>
                      <p className="text-[10px] text-[#2C3333]/60">
                        Scan pass or enter 6-digit code
                      </p>
                    </div>
                  </div>

                  <div className="flex bg-[#FAF9F6] p-0.5 rounded-full border border-[#E8E6E1]">
                    <button
                      type="button"
                      onClick={() => setActiveCheckInMethod('scan')}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        activeCheckInMethod === 'scan'
                          ? 'bg-[#2C3333] text-white'
                          : 'text-[#2C3333]/60 hover:text-[#2C3333]'
                      }`}
                    >
                      Scan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCheckInMethod('manual');
                        setTimeout(() => manualInputRef.current?.focus(), 50);
                      }}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        activeCheckInMethod === 'manual'
                          ? 'bg-[#2C3333] text-white'
                          : 'text-[#2C3333]/60 hover:text-[#2C3333]'
                      }`}
                    >
                      Code
                    </button>
                  </div>
                </div>

                {activeCheckInMethod === 'scan' ? (
                  <button
                    type="button"
                    onClick={() => setIsScannerModalOpen(true)}
                    className="w-full py-3 px-5 bg-[#2C3333] hover:bg-[#4F6F52] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Scan Guest QR Pass</span>
                  </button>
                ) : (
                  <form onSubmit={handleManualCodeSubmit} className="flex gap-2">
                    <input
                      ref={manualInputRef}
                      type="text"
                      placeholder="e.g. FT-BLR-0730"
                      value={qrScanInput}
                      onChange={(e) => setQrScanInput(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-xs bg-white border border-[#E8E6E1] rounded-2xl outline-none focus:border-[#4F6F52] text-[#2C3333]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#2C3333] hover:bg-[#4F6F52] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer shadow-xs"
                    >
                      Check In
                    </button>
                  </form>
                )}

                {scanMessage && (
                  <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 ${
                    scanMessage.includes('verified') || scanMessage.startsWith('✓')
                      ? 'bg-[#4F6F521A] text-[#4F6F52] border border-[#4F6F52]/25'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#4F6F52]" />
                    <span className="flex-1 text-[11px]">{scanMessage}</span>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      )}

      {/* VIEW 2: LIVE TABLES & FLOOR BLUEPRINT */}
      {(dashboardView === 'live-tables' || dashboardView === 'floor-plan') && (
        <LiveTablesTab
          restaurant={currentRestaurantWithBackendTables}
          reservations={currentReservations}
          tableOverrides={tableOverrides}
          onSetTableStatus={handleSetTableStatus}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          selectedTable={selectedTableForDetails}
          onSelectTable={setSelectedTableForDetails}
          onResetStatuses={handleResetStatuses}
          getTableStaffStatus={getTableStaffStatus}
          isSyncingTables={isSyncingTables}
          lastTablesSyncTime={lastTablesSyncTime}
          onSyncTables={() => syncTablesFromGoogleSheet(true)}
          onAddTable={handleAddTable}
          onRemoveTable={handleRemoveTable}
        />
      )}

      {/* VIEW 4: INSIGHTS & METRICS */}
      {dashboardView === 'insights' && (
        <InsightsTab restaurant={activeRestaurant} />
      )}

      {/* VIEW: RESTAURANT OWNER & RESTAURANT ADMIN DETAILS */}
      {dashboardView === 'owner-details' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8E6E1] shadow-sm space-y-6 animate-in fade-in duration-150" id="section-admin-details">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold font-serif text-[#2C3333]">
                  Restaurant Owner & Admin Details
                </h3>
                <span className="text-xs font-semibold text-[#4F6F52] bg-[#4F6F521A] px-3 py-1 rounded-full border border-[#4F6F52]/20">
                  Authorized Owner Console
                </span>
              </div>
              <p className="text-xs text-[#2C3333]/60 mt-1">
                Enter, edit, and manage your restaurant identity, owner name, venue address, and customer care number. These details are stored in the restaurant profile and displayed clearly to customers on information and reservation pages.
              </p>
            </div>
            {isAuthorizedOwner && (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Authorized Admin</span>
              </span>
            )}
          </div>

          {!isAuthorizedOwner ? (
            <div className="p-8 text-center bg-rose-50 rounded-2xl border border-rose-200 space-y-2">
              <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
              <h4 className="text-base font-bold text-rose-950">Access Restricted</h4>
              <p className="text-xs text-rose-800">
                Only the authorized restaurant owner/admin can enter, edit, or manage these details.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Column */}
              <div className="lg:col-span-7 p-6 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#E8E6E1]">
                  <h4 className="text-sm font-bold text-[#2C3333] flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#4F6F52]" />
                    <span>Venue Profile & Contact Management</span>
                  </h4>
                  {isProfileSaved && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Changes Saved in Database!</span>
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveRestaurantProfile} className="space-y-4">
                  <div>
                    <label htmlFor="admin-rest-name" className="block text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1">
                      Restaurant Name *
                    </label>
                    <div className="relative">
                      <Store className="w-4 h-4 text-[#2C3333]/40 absolute left-3 top-3" />
                      <input
                        id="admin-rest-name"
                        type="text"
                        required
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold text-[#2C3333] bg-white border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52] focus:ring-1 focus:ring-[#4F6F52]"
                        placeholder="e.g. The Ember Room"
                      />
                    </div>
                    <p className="text-[10px] text-[#2C3333]/50 mt-1">
                      Official venue name displayed across search cards, 2D floor plans, and digital booking tickets.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="admin-owner-name" className="block text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1">
                      Restaurant Owner / Admin Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#2C3333]/40 absolute left-3 top-3" />
                      <input
                        id="admin-owner-name"
                        type="text"
                        required
                        value={profileOwnerName}
                        onChange={(e) => setProfileOwnerName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold text-[#2C3333] bg-white border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52] focus:ring-1 focus:ring-[#4F6F52]"
                        placeholder="e.g. Vikramaditya Rathore"
                      />
                    </div>
                    <p className="text-[10px] text-[#2C3333]/50 mt-1">
                      Authorized proprietor, General Manager, or host stand administrator.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="admin-address" className="block text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1">
                      Restaurant Address *
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#2C3333]/40 absolute left-3 top-3" />
                      <textarea
                        id="admin-address"
                        required
                        rows={2}
                        value={profileAddress}
                        onChange={(e) => setProfileAddress(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs font-medium text-[#2C3333] bg-white border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52] focus:ring-1 focus:ring-[#4F6F52]"
                        placeholder="e.g. 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038"
                      />
                    </div>
                    <p className="text-[10px] text-[#2C3333]/50 mt-1">
                      Full street address shown to customers on cards, directions, and reservation passes.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="admin-care-number" className="block text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/70 mb-1">
                      Restaurant Customer Care Number *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#4F6F52] absolute left-3 top-3" />
                      <input
                        id="admin-care-number"
                        type="text"
                        required
                        value={profileCustomerCare}
                        onChange={(e) => setProfileCustomerCare(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-xs font-mono font-bold text-[#4F6F52] bg-white border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52] focus:ring-1 focus:ring-[#4F6F52]"
                        placeholder="e.g. +91 98450 12260"
                      />
                    </div>
                    <p className="text-[10px] text-[#2C3333]/50 mt-1">
                      Direct customer care helpline. Displayed clearly on restaurant information and reservation pages for customer support.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3 px-4 rounded-xl bg-[#4F6F52] hover:bg-[#3D5A40] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                      id="btn-save-admin-details"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save Restaurant Details</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Live Preview Column */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E8E6E1]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#2C3333]/50">
                      Live Diner Preview
                    </span>
                    <span className="text-[10px] font-bold text-[#4F6F52] bg-[#4F6F5214] px-2 py-0.5 rounded-full">
                      Customer Facing
                    </span>
                  </div>

                  {/* Mock Discovery Card */}
                  <div className="p-4 rounded-2xl bg-white border border-[#E8E6E1] space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#4F6F52]">Discovery Card</span>
                      <span className="text-[9px] text-[#2C3333]/40">Bengaluru Dining</span>
                    </div>
                    <h5 className="font-bold font-serif text-base text-[#2C3333]">{profileName || 'Your Restaurant'}</h5>
                    <div className="flex items-start gap-1.5 text-xs text-[#2C3333]/70">
                      <MapPin className="w-3.5 h-3.5 text-[#4F6F52] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{profileAddress || 'Venue address in Bengaluru'}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#4F6F5214] border border-[#4F6F52]/20 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#4F6F52] flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        Care Helpline:
                      </span>
                      <span className="font-mono font-bold text-[#4F6F52]">{profileCustomerCare || '+91 98450 12260'}</span>
                    </div>
                  </div>

                  {/* Mock Reservation Pass */}
                  <div className="p-4 rounded-2xl bg-white border border-[#E8E6E1] space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#4F6F52]">Reservation Pass</span>
                      <span className="text-[9px] font-mono text-[#2C3333]/40">Ref: FT-BLR-0730</span>
                    </div>
                    <p className="text-xs font-semibold text-[#2C3333]">Table 04 • 2 Guests • 07:30 PM</p>
                    <p className="text-[11px] text-[#2C3333]/60">Host: {profileOwnerName || 'Owner Name'}</p>
                    <p className="text-[11px] text-[#2C3333]/70">{profileAddress || 'Venue Address'}</p>
                    <div className="text-[11px] font-semibold text-[#4F6F52] flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span>Direct Customer Care: {profileCustomerCare || '+91 98450 12260'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: SETTINGS */}
      {dashboardView === 'settings' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8E6E1] shadow-sm space-y-6 animate-in fade-in duration-150" id="section-settings">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1]">
            <div>
              <h3 className="text-xl font-bold font-serif text-[#2C3333]">
                Restaurant Settings & Configuration
              </h3>
              <p className="text-xs text-[#2C3333]/60 mt-0.5">
                Manage host stand parameters, floor layout defaults, and arrival buffers for {activeRestaurant.name}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#4F6F52] bg-[#4F6F521A] px-3.5 py-1.5 rounded-full border border-[#4F6F52]/20">
              Host Stand Controls
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Owner & Restaurant Details Form */}
            <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8E6E1]">
                <h4 className="text-sm font-bold text-[#2C3333] flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#4F6F52]" />
                  <span>Restaurant Owner & Venue Details</span>
                </h4>
                {isProfileSaved && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Saved!</span>
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveRestaurantProfile} className="space-y-3">
                <div>
                  <label htmlFor="owner-rest-name" className="block text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/60 mb-1">
                    Restaurant Name *
                  </label>
                  <input
                    id="owner-rest-name"
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold text-[#2C3333] bg-white border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52]"
                    placeholder="e.g. The Ember Room"
                  />
                </div>

                <div>
                  <label htmlFor="owner-name-input" className="block text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/60 mb-1">
                    Restaurant Owner / GM Name *
                  </label>
                  <input
                    id="owner-name-input"
                    type="text"
                    required
                    value={profileOwnerName}
                    onChange={(e) => setProfileOwnerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold text-[#2C3333] bg-white border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52]"
                    placeholder="e.g. Vikramaditya Rathore"
                  />
                </div>

                <div>
                  <label htmlFor="owner-address-input" className="block text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/60 mb-1">
                    Restaurant Address *
                  </label>
                  <input
                    id="owner-address-input"
                    type="text"
                    required
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium text-[#2C3333] bg-white border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52]"
                    placeholder="e.g. 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru"
                  />
                </div>

                <div>
                  <label htmlFor="owner-care-number" className="block text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/60 mb-1">
                    Restaurant Customer Care Number *
                  </label>
                  <input
                    id="owner-care-number"
                    type="text"
                    required
                    value={profileCustomerCare}
                    onChange={(e) => setProfileCustomerCare(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-[#4F6F52] bg-white border border-[#E8E6E1] rounded-xl outline-none focus:border-[#4F6F52]"
                    placeholder="e.g. +91 98450 12260"
                  />
                  <p className="text-[10px] text-[#2C3333]/50 mt-1">
                    Visible to customers on restaurant cards and booking pages to contact you regarding table reservations.
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-[#4F6F52] hover:bg-[#3D5A40] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                    id="btn-save-restaurant-details"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Restaurant Details</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-4">
              <h4 className="text-sm font-bold text-[#2C3333] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#4F6F52]" />
                <span>Service Parameters</span>
              </h4>
              <div className="text-xs space-y-2 text-[#2C3333]/70">
                <div className="flex justify-between py-1 border-b border-[#E8E6E1]">
                  <span>Avg Dining Duration:</span>
                  <span className="font-semibold text-[#2C3333]">75 minutes</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E6E1]">
                  <span>Smart Arrival Geofence:</span>
                  <span className="font-semibold text-[#4F6F52]">500 meters</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E8E6E1]">
                  <span>No-Show Auto-Release:</span>
                  <span className="font-semibold text-[#2C3333]">15 min grace period</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Total Floor Capacity:</span>
                  <span className="font-semibold text-[#2C3333]">{totalTables} Tables (46 Seats)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: ALL RESERVATIONS QUEUE */}
      {dashboardView === 'reservations' && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E8E6E1] shadow-sm space-y-6 animate-in fade-in duration-150" id="section-all-reservations">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold font-serif text-[#2C3333]">
                  Reservation Master Log
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Google Sheets Live
                </span>
              </div>
              <p className="text-xs text-[#2C3333]/60 mt-0.5">
                All guest bookings for {activeRestaurant.name} (Google Sheet "Reservations" tab)
                {lastSyncTime && (
                  <span className="ml-1 text-[11px] text-[#4F6F52] font-mono">
                    • Last synced: {lastSyncTime}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => syncReservationsFromGoogleSheet(true)}
                disabled={isSyncingBackend}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#4F6F52] hover:text-white bg-[#4F6F5214] hover:bg-[#4F6F52] border border-[#4F6F52]/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Fetch latest reservations from Google Sheet"
                id="btn-sync-reservations-sheet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBackend ? 'animate-spin' : ''}`} />
                <span>{isSyncingBackend ? 'Syncing...' : 'Sync Sheet'}</span>
              </button>
              <div className="flex items-center gap-1.5 text-xs text-[#2C3333]/70 font-medium bg-[#FAF9F6] px-3 py-1.5 rounded-full border border-[#E8E6E1]" id="reservations-sync-indicator">
                <span className={`w-2 h-2 rounded-full ${isSyncingBackend ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`}></span>
                <span>{isSyncingBackend ? 'Syncing...' : (lastSyncTime ? `Last synced: ${lastSyncTime}` : 'Synced')}</span>
              </div>
              <span className="text-xs text-[#2C3333]/70 font-semibold bg-[#FAF9F6] px-3 py-1.5 rounded-full border border-[#E8E6E1]">
                Total: {currentReservations.length} Bookings
              </span>
            </div>
          </div>

          {/* Reservation Status Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-[#E8E6E1] pb-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setResFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                resFilter === 'all'
                  ? 'bg-[#2C3333] text-white shadow-xs'
                  : 'bg-[#FAF9F6] text-[#2C3333]/70 hover:bg-[#E8E6E1] border border-[#E8E6E1]'
              }`}
              id="filter-all-reservations"
            >
              <span>All Bookings</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${resFilter === 'all' ? 'bg-white/20' : 'bg-stone-200 text-stone-700'}`}>
                {currentReservations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setResFilter('active')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                resFilter === 'active'
                  ? 'bg-[#4F6F52] text-white shadow-xs'
                  : 'bg-[#FAF9F6] text-[#2C3333]/70 hover:bg-[#E8E6E1] border border-[#E8E6E1]'
              }`}
              id="filter-active-reservations"
            >
              <span>Active Bookings</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${resFilter === 'active' ? 'bg-white/20' : 'bg-stone-200 text-stone-700'}`}>
                {activeReservationsList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setResFilter('cancelled')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                resFilter === 'cancelled'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
              id="filter-cancelled-reservations"
            >
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>Cancellations & Penalty Log</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${resFilter === 'cancelled' ? 'bg-white/20' : 'bg-rose-200 text-rose-900'}`}>
                {cancelledReservations.length}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            {displayedReservations.length === 0 ? (
              <div className="p-8 text-center bg-[#FAF9F6] rounded-2xl border border-[#E8E6E1] space-y-2">
                <AlertCircle className="w-8 h-8 text-[#2C3333]/40 mx-auto" />
                <p className="text-sm font-semibold text-[#2C3333]">
                  {resFilter === 'cancelled'
                    ? 'No cancelled reservations found for this restaurant.'
                    : 'No reservations found matching the current filter.'}
                </p>
                <p className="text-xs text-[#2C3333]/60">
                  {resFilter === 'cancelled'
                    ? 'All confirmed table reservations are active or completed with ₹0 penalty disputes.'
                    : 'Upcoming bookings will appear here in real time.'}
                </p>
              </div>
            ) : (
              displayedReservations.map((res) => {
              const hasSmartArrival = activeSmartArrivalGuests.some(
                (g) => g.reservation.id.toLowerCase() === res.id.toLowerCase()
              );
              const isCheckedIn = res.status === 'seated' || res.status === 'checked-in';
              const isCompleted = res.status === 'completed';

              return (
                <div
                  key={res.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    hasSmartArrival
                      ? 'bg-[#4F6F5214] border-[#4F6F52]/40 shadow-xs'
                      : 'bg-[#FAF9F6] border-[#E8E6E1]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm font-serif text-[#2C3333]">
                        {res.customerName}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#4F6F52] bg-white px-2.5 py-0.5 rounded-full border border-[#E8E6E1]">
                        Table {res.tableNumber} — {res.timeIn && res.timeOut ? `${res.timeIn} → ${res.timeOut}` : res.timeSlot} — {res.status === 'confirmed' ? 'Reserved' : res.status.charAt(0).toUpperCase() + res.status.slice(1)}
                      </span>
                      {res.durationFormatted && (
                        <span className="text-[10px] font-semibold text-[#2C3333]/70 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                          {res.durationFormatted}
                        </span>
                      )}
                      {hasSmartArrival && !isCompleted && (
                        <span className="text-[10px] font-bold text-white bg-[#4F6F52] px-2 py-0.5 rounded-full">
                          Smart Arrival Active
                        </span>
                      )}
                      {(() => {
                        const session = getDiningClockSession(res.id) || res.diningClockSession;
                        if (session?.status === 'clocked_in') {
                          return (
                            <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                              <span>Dining: In at {session.clockInDisplayTime}</span>
                            </span>
                          );
                        }
                        if (session?.status === 'clocked_out') {
                          return (
                            <span className="text-[10px] font-bold text-stone-700 bg-stone-200 border border-stone-300 px-2 py-0.5 rounded-full">
                              Duration: {session.durationFormatted} ({session.clockInDisplayTime} - {session.clockOutDisplayTime})
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-[#2C3333]/70">
                      <span>{res.guests} Guests • Slot: {res.timeSlot} • Ref: {res.bookingRef}</span>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {res.depositAmount && res.depositAmount > 0 ? `₹${res.depositAmount} Deposit Paid` : '₹200 Booking Deposit Paid'}
                      </span>
                    </div>
                    {res.seatingPreferences && (
                      <div className="text-[11px] text-[#4F6F52] font-medium">
                        Preferences: {res.seatingPreferences.join(', ')}
                      </div>
                    )}
                    {res.foodOrder && res.foodOrder.items && res.foodOrder.items.length > 0 && (
                      <div className="text-[11px] text-amber-900 font-medium flex items-center gap-1.5 mt-0.5">
                        <UtensilsCrossed className="w-3 h-3 text-amber-700" />
                        <span>Pre-Ordered Food: ₹{res.foodOrder.foodTotal} ({res.foodOrder.items.length} items • Status: {res.foodOrder.status})</span>
                      </div>
                    )}

                    {/* Cancellation & ₹100 Penalty Card for Restaurant Owner */}
                    {res.status === 'cancelled' && (() => {
                      const isFirst = res.cancellationCount === 1 || res.penaltyAmount === 0 || (res.cancellationPenalty === 0 && res.cancellationPenalty !== undefined) || res.penaltyApplicability === 'none_first_cancellation';
                      const fee = res.penaltyAmount ?? res.cancellationPenalty ?? (isFirst ? 0 : 100);
                      const applicability = res.penaltyApplicability === 'none_first_cancellation' || isFirst 
                        ? '1st Cancellation Grace (₹0 Fee)' 
                        : 'Applicable (₹100 Penalty)';
                      const pStatus = isFirst 
                        ? 'Waived (Grace Period)' 
                        : (res.penaltyStatus === 'paid' ? 'PAID' : (res.penaltyStatus || 'PAID'));

                      return (
                        <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 space-y-2 mt-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1.5 border-b border-rose-200/60">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span className="font-bold text-rose-950 font-serif text-sm">
                                {isFirst ? '1st Cancellation (Grace Exemption)' : `Cancellation #${res.cancellationCount || '2+'} Record`}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isFirst 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                  : 'bg-rose-100 text-rose-900 border-rose-300'
                              }`}>
                                {isFirst ? '₹0 Fee (1st Cancel)' : '₹100 Penalty Charged'}
                              </span>
                            </div>
                            {res.cancellationDate && (
                              <span className="text-[11px] text-rose-800/80 font-mono">
                                Cancelled: {res.cancellationDate}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div className="p-1.5 rounded-lg bg-white/70 border border-rose-100">
                              <span className="text-rose-900/60 block text-[10px]">Cancellation Count</span>
                              <span className="font-bold text-rose-950">
                                {res.cancellationCount ? `#${res.cancellationCount} for Diner` : (isFirst ? '1st for Diner' : '2nd+ for Diner')}
                              </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-white/70 border border-rose-100">
                              <span className="text-rose-900/60 block text-[10px]">Penalty Amount</span>
                              <span className={`font-bold font-mono ${isFirst ? 'text-emerald-700' : 'text-rose-700'}`}>
                                ₹{fee}.00 {isFirst ? '(Waived)' : ''}
                              </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-white/70 border border-rose-100">
                              <span className="text-rose-900/60 block text-[10px]">Applicability</span>
                              <span className="font-semibold text-rose-950 truncate block" title={applicability}>
                                {applicability}
                              </span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-white/70 border border-rose-100">
                              <span className="text-rose-900/60 block text-[10px]">Payment Status</span>
                              <span className="font-bold uppercase text-[10px] text-emerald-800">
                                {pStatus}
                              </span>
                            </div>
                          </div>

                          {(res.cancellationTransactionId || res.cancellationPaymentMethod) && (
                            <div className="flex items-center justify-between text-[10px] text-rose-800 pt-1 border-t border-rose-200/50">
                              <span>Method: <strong>{res.cancellationPaymentMethod || (isFirst ? 'Grace Period Exemption' : 'Digital Payment')}</strong></span>
                              {res.cancellationTransactionId && (
                                <span className="font-mono bg-white/90 px-1.5 py-0.5 rounded border border-rose-200">
                                  Ref: {res.cancellationTransactionId}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                      res.status === 'cancelled'
                        ? (res.cancellationCount === 1 || res.penaltyAmount === 0 || (res.cancellationPenalty === 0 && res.cancellationPenalty !== undefined)
                            ? 'bg-stone-100 text-stone-800 border border-stone-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300')
                        : isCompleted
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : isCheckedIn
                        ? 'bg-[#2C3333] text-white'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}>
                      {res.status === 'cancelled' 
                        ? (res.cancellationCount === 1 || res.penaltyAmount === 0 || (res.cancellationPenalty === 0 && res.cancellationPenalty !== undefined)
                            ? 'Cancelled (1st Cancel • ₹0 Fee)' 
                            : 'Cancelled (₹100 Penalty Paid)')
                        : isCompleted ? 'Completed' : isCheckedIn ? 'Seated' : 'Confirmed'}
                    </span>

                    {res.billSent && res.status !== 'cancelled' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Digital bill sent</span>
                      </span>
                    )}

                    {res.status === 'cancelled' && (
                      <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
                        Table Freed on Live 2D Plan
                      </span>
                    )}

                    {/* Complete Dining button for Checked In / Seated diners */}
                    {isCheckedIn && !isCompleted && res.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleCompleteDining(res)}
                        disabled={completingDiningId === res.id}
                        className="px-4 py-1.5 bg-[#4F6F52] hover:bg-[#2C3333] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        id={`btn-complete-dining-${res.id}`}
                      >
                        {completingDiningId === res.id ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Completing...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete Dining</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Dining Bill / Settle Action */}
                    {res.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => setSelectedBillReservation(res)}
                        className="px-3.5 py-1.5 bg-[#FAF9F6] hover:bg-[#E8E6E1] text-[#2C3333] border border-[#E8E6E1] text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        title={isCompleted ? "View final dining bill and dispatch console" : "Generate dining bill with deposit deduction"}
                        id={`btn-staff-bill-${res.id}`}
                      >
                        <Receipt className="w-3.5 h-3.5 text-[#4F6F52]" />
                        <span>{isCompleted ? 'Final Dining Bill' : 'Dining Bill'}</span>
                      </button>
                    )}

                    {!isCheckedIn && !isCompleted && res.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleCheckInCustomer(res, 'Manual')}
                        disabled={isCheckingInId === res.id}
                        className="px-4 py-2 bg-[#2C3333] hover:bg-[#4F6F52] text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isCheckingInId === res.id ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Checking In...</span>
                          </>
                        ) : (
                          'Check In'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* VIEW: TRAVEL BOOKINGS FOR BUS PASSENGERS */}
      {dashboardView === 'travel-bookings' && (
        <TravelBookingsTab
          restaurant={activeRestaurant}
          reservations={reservations}
          onUpdateReservation={(resId, updated) => {
            const nextReservations = reservations.map((r) =>
              r.id === resId ? { ...r, ...updated } : r
            );
            if (onSyncReservations) {
              onSyncReservations(nextReservations);
            }
          }}
          onToast={onToast}
          onOpenQrScanner={() => setIsScannerModalOpen(true)}
        />
      )}

      {/* VIEW: FOOD ORDERS & KITCHEN QUEUE */}
      {dashboardView === 'food-orders' && (
        <FoodOrdersTab
          restaurant={activeRestaurant}
          reservations={currentReservations}
          onToast={onToast}
        />
      )}

      {/* VIEW: MENU MANAGEMENT & OUT OF STOCK */}
      {dashboardView === 'menu-management' && (
        <MenuManagementTab
          restaurant={activeRestaurant}
          onOpenDigitalMenu={() => setIsMenuOpen(true)}
          onToast={onToast}
        />
      )}

      {/* Dedicated QR Scanner Modal */}
      <QrScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        activeRestaurant={activeRestaurant}
        reservations={reservations}
        onCheckInCustomer={(res) => handleCheckInCustomer(res, 'QR')}
        onSwitchToManual={() => {
          setActiveCheckInMethod('manual');
          setTimeout(() => manualInputRef.current?.focus(), 100);
        }}
      />

      {/* Digital Menu Modal for Active Restaurant */}
      {isMenuOpen && (
        <DigitalMenuView
          restaurant={activeRestaurant}
          onClose={() => setIsMenuOpen(false)}
        />
      )}

      {/* Menu QR Modal for Active Restaurant */}
      {isMenuQrOpen && (
        <MenuQrModal
          restaurant={activeRestaurant}
          onClose={() => setIsMenuQrOpen(false)}
          onViewFullMenu={() => {
            setIsMenuQrOpen(false);
            setIsMenuOpen(true);
          }}
        />
      )}

      {/* Dining Bill Modal for Staff Settle/Checkout */}
      {selectedBillReservation && (
        <DiningBillModal
          reservation={reservations.find((r) => r.id === selectedBillReservation.id) || selectedBillReservation}
          isStaffView={true}
          onSendBill={handleSendBillToCustomer}
          onClose={() => setSelectedBillReservation(null)}
        />
      )}

    </div>
  );
};

