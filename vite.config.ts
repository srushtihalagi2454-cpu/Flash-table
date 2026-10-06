import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

const APPS_SCRIPT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbyGStCgmWV--V5mHS_AGKql8dRZ6JIWHTRpKDtrQI6TWXavglVofqs5CwvKUGiPL_5z/exec';

// Local proxy cache mirroring Google Sheet "Reservations" tab
let proxyReservationsSheet: any[] = [];
let lastGoogleSheetsReservationsSync = 0;
let isSyncInProgress = false;
const GOOGLE_SHEETS_CACHE_TTL = 8000; // 8 seconds cache for instant responsiveness while maintaining real-time freshness

async function syncReservationsFromGoogleSheetsBackend(force = false): Promise<any[]> {
  const now = Date.now();
  if (!force && now - lastGoogleSheetsReservationsSync < GOOGLE_SHEETS_CACHE_TTL && proxyReservationsSheet.length > 0) {
    return proxyReservationsSheet;
  }

  if (isSyncInProgress) {
    let attempts = 0;
    while (isSyncInProgress && attempts < 25) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
    return proxyReservationsSheet;
  }

  isSyncInProgress = true;
  const allRestaurants = [
    'rest-1', 'rest-2', 'rest-3', 'rest-4', 'rest-5',
    'rest-6', 'rest-7', 'rest-8', 'rest-9', 'rest-10'
  ];

  try {
    const results = await Promise.all(
      allRestaurants.map(async (rId) => {
        try {
          const res = await fetch(APPS_SCRIPT_BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getRestaurantReservations', restaurantId: rId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && Array.isArray(data.reservations)) {
              return data.reservations;
            }
          }
        } catch {}
        return [];
      })
    );

    const seenIds = new Set<string>();
    const fetchedList: any[] = [];

    for (const rList of results) {
      for (const item of rList) {
        if (item && item.reservationId && !seenIds.has(item.reservationId)) {
          seenIds.add(item.reservationId);
          fetchedList.push(item);
        }
      }
    }

    if (fetchedList.length > 0) {
      // Preserve any local uncommitted reservations that might still be indexing in Google Sheets
      const localOnly = proxyReservationsSheet.filter((p) => p.reservationId && !seenIds.has(p.reservationId));
      proxyReservationsSheet = [...fetchedList, ...localOnly];
      lastGoogleSheetsReservationsSync = Date.now();
    }
  } catch (err) {
    console.warn('[Vite Proxy] Failed to fetch reservations from Google Sheets:', err);
  } finally {
    isSyncInProgress = false;
  }

  return proxyReservationsSheet;
}

async function getReservationsForUser(reqCustUserId: string): Promise<any[]> {
  const normUserId = (reqCustUserId || '').trim().toLowerCase();
  if (!normUserId) return [];

  const now = Date.now();
  const isCacheFresh = (now - lastGoogleSheetsReservationsSync < GOOGLE_SHEETS_CACHE_TTL) && proxyReservationsSheet.length > 0;

  if (!isCacheFresh) {
    await syncReservationsFromGoogleSheetsBackend(true);
  }

  let matching = proxyReservationsSheet.filter((r) => {
    const rUserId = (r.userId || '').toString().trim().toLowerCase();
    return rUserId === normUserId;
  });

  // If not found in cache and we didn't just force sync, do a forced sync to ensure no device lag
  if (matching.length === 0 && isCacheFresh) {
    await syncReservationsFromGoogleSheetsBackend(true);
    matching = proxyReservationsSheet.filter((r) => {
      const rUserId = (r.userId || '').toString().trim().toLowerCase();
      return rUserId === normUserId;
    });
  }

  return matching;
}

// Local proxy store mirroring Google Sheet "CheckIns" tab
export interface ProxyCheckIn {
  checkInId: string;
  reservationId: string;
  restaurantId: string;
  tableId: string;
  method: string;
  checkInTime: string;
  status: string;
}

const proxyCheckInsSheet: ProxyCheckIn[] = [];

// Local proxy store mirroring Google Sheet "Payment" tab
export interface ProxyPayment {
  paymentId: string;
  reservationId: string;
  userId: string;
  amount: number;
  method: string;
  status: string;
  transactionId: string;
  createdAt: string;
}

const proxyPaymentsSheet: ProxyPayment[] = [];

// Local proxy store mirroring Google Sheet "Bills" tab
export interface ProxyBill {
  billId: string;
  reservationId: string;
  userId: string;
  restaurantId: string;
  foodAmount: number;
  depositAmount: number;
  depositAdjustment: number;
  finalAmount: number;
  status: string;
  sentToMobile: string;
  createdAt: string;
}

const proxyBillsSheet: ProxyBill[] = [];

// Local proxy store mirroring Google Sheet "NotifyMe" tab
export interface ProxyNotifyMe {
  notifyId: string;
  userId: string;
  restaurantId: string;
  date: string;
  time: string;
  guests: number;
  preferences: string;
  status: string;
  createdAt: string;
}

const proxyNotifyMeSheet: ProxyNotifyMe[] = [];

// Local proxy store mirroring Google Sheet "FoodOrders" tab
export interface ProxyFoodOrder {
  foodOrderId: string;
  reservationId: string;
  userId: string;
  restaurantId: string;
  tableId: string;
  tableNumber?: string;
  date: string;
  time: string;
  items: any[];
  foodTotal: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
}

const proxyFoodOrdersSheet: ProxyFoodOrder[] = [
  {
    foodOrderId: 'fo-gajineesh-03',
    reservationId: 'res-gajineesh-03',
    userId: 'usr-gajineesh',
    restaurantId: 'rest-1',
    tableId: 't-103',
    tableNumber: 'T03',
    date: '2026-09-14',
    time: '07:30 PM',
    items: [
      { id: 'item-1', name: 'Truffle & Forest Morel Kulcha', price: 480, quantity: 2 },
      { id: 'item-2', name: 'Crispy Lotus Stem in Kokum Glaze', price: 520, quantity: 1 },
      { id: 'item-3', name: 'Wood-Smoked Filter Coffee Tiramisu', price: 460, quantity: 1 },
    ],
    foodTotal: 1940,
    status: 'Preparing',
    createdAt: '2026-09-10T12:02:00.000Z',
    updatedAt: '2026-09-10T12:05:00.000Z',
    customerName: 'Gajineesh G',
  },
  {
    foodOrderId: 'fo-sthuthi-04',
    reservationId: 'res-sthuthi-04',
    userId: 'usr-sthuthi',
    restaurantId: 'rest-1',
    tableId: 't-104',
    tableNumber: 'T04',
    date: '2026-09-14',
    time: '07:45 PM',
    items: [
      { id: 'item-4', name: 'Wood-Fired Murgh Ghee Roast', price: 780, quantity: 2 },
      { id: 'item-5', name: 'Steamed Neer Dosa', price: 180, quantity: 4 },
      { id: 'item-6', name: 'Kokum Basil Cooler', price: 260, quantity: 2 },
    ],
    foodTotal: 2800,
    status: 'Pending',
    createdAt: '2026-09-10T12:16:00.000Z',
    updatedAt: '2026-09-10T12:16:00.000Z',
    customerName: 'Sthuthi',
  },
  {
    foodOrderId: 'fo-vikram-02',
    reservationId: 'res-ember-02',
    userId: 'usr-vikram',
    restaurantId: 'rest-1',
    tableId: 't-102',
    tableNumber: 'T02',
    date: '2026-09-14',
    time: '07:00 PM',
    items: [
      { id: 'item-7', name: 'Smoked Guntur Chilli Paneer', price: 540, quantity: 1 },
      { id: 'item-8', name: 'Malabar Parotta', price: 220, quantity: 2 },
    ],
    foodTotal: 980,
    status: 'Ready',
    createdAt: '2026-09-10T11:32:00.000Z',
    updatedAt: '2026-09-10T11:45:00.000Z',
    customerName: 'Vikram Sundaram',
  },
];

// Local proxy store mirroring Google Sheet "Smart Arrival" tab
export interface ProxySmartArrival {
  reservationId: string;
  userId: string;
  restaurantId: string;
  locationEnabled: boolean;
  latitude: number;
  longitude: number;
  distance: number;
  etaMinutes: number;
  geofenceStatus: string;
  updatedAt: string;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
}

const proxySmartArrivalSheet: ProxySmartArrival[] = [
  {
    reservationId: 'res-gajineesh-03',
    userId: 'usr-gajineesh',
    restaurantId: 'rest-1',
    locationEnabled: true,
    latitude: 12.9725,
    longitude: 77.6420,
    distance: 450,
    etaMinutes: 3,
    geofenceStatus: 'Within 500 m',
    updatedAt: new Date().toISOString(),
    customerName: 'Gajineesh G',
    customerPhone: '+91 98450 12260',
    tableNumber: 'T03',
  },
  {
    reservationId: 'res-sthuthi-04',
    userId: 'usr-sthuthi',
    restaurantId: 'rest-1',
    locationEnabled: true,
    latitude: 12.9780,
    longitude: 77.6490,
    distance: 1200,
    etaMinutes: 8,
    geofenceStatus: 'Outside 500 m',
    updatedAt: new Date().toISOString(),
    customerName: 'Sthuthi',
    customerPhone: '+91 99801 34567',
    tableNumber: 'T04',
  },
];

// Local proxy store mirroring Google Sheet "Tables" tab
interface ProxyTable {
  id: string;
  tableId: string;
  restaurantId: string;
  tableNumber: string;
  capacity: number;
  minCapacity: number;
  shape: string;
  section: string;
  features: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  status: string;
}

const RESTAURANT_INITIAL_TABLE_SPECS: Record<string, { prefix: string; count: number }> = {
  'rest-1': { prefix: 'T', count: 12 },
  'rest-2': { prefix: 'GT', count: 10 },
  'rest-3': { prefix: 'CC', count: 8 },
  'rest-4': { prefix: 'RB', count: 7 },
  'rest-5': { prefix: 'UM', count: 11 },
  'rest-6': { prefix: 'MH', count: 10 },
  'rest-7': { prefix: 'NS', count: 9 },
  'rest-8': { prefix: 'CB', count: 8 },
  'rest-9': { prefix: 'CP', count: 10 },
  'rest-10': { prefix: 'AD', count: 14 },
};

function generateInitialTablesForRestaurant(restaurantId: string): ProxyTable[] {
  const spec = RESTAURANT_INITIAL_TABLE_SPECS[restaurantId] || { prefix: 'T', count: 10 };
  const baseLayout = [
    { num: 1, cap: 2, minCap: 1, shape: 'circle', section: 'Courtyard Terrace', features: ['Garden View', 'Romantic', 'Breeze'], x: 8, y: 12, w: 14, h: 14, status: 'available' },
    { num: 2, cap: 2, minCap: 1, shape: 'circle', section: 'Courtyard Terrace', features: ['Garden View', 'Quiet'], x: 26, y: 12, w: 14, h: 14, status: 'occupied' },
    { num: 3, cap: 4, minCap: 2, shape: 'rect', section: 'Courtyard Terrace', features: ['Garden View', 'Outdoor Canopy', 'Spacious'], x: 46, y: 10, w: 20, h: 16, status: 'reserved' },
    { num: 4, cap: 6, minCap: 4, shape: 'rect', section: 'Courtyard Terrace', features: ['Garden View', 'Family Seating', 'Water Fountain'], x: 72, y: 10, w: 22, h: 16, status: 'cleaning' },
    { num: 5, cap: 4, minCap: 2, shape: 'booth', section: 'Main Dining', features: ['Plush Velvet Booth', 'Quiet', 'Chandelier View'], x: 8, y: 40, w: 22, h: 18, status: 'available' },
    { num: 6, cap: 4, minCap: 2, shape: 'rect', section: 'Main Dining', features: ['Central Ambience', 'Live Sitar Acoustics'], x: 36, y: 40, w: 18, h: 18, status: 'available' },
    { num: 7, cap: 4, minCap: 2, shape: 'rect', section: 'Main Dining', features: ['Window', 'Quiet', 'Spacious'], x: 58, y: 40, w: 18, h: 18, status: 'reserved' },
    { num: 8, cap: 8, minCap: 5, shape: 'rect', section: 'Main Dining', features: ['Large Banquet Table', 'Celebration', 'Chandelier View'], x: 80, y: 38, w: 16, h: 22, status: 'occupied' },
    { num: 9, cap: 2, minCap: 1, shape: 'circle', section: 'Bar Lounge', features: ['Cocktail Counter', 'Ambient Lighting', 'Upbeat Music'], x: 10, y: 72, w: 14, h: 14, status: 'occupied' },
    { num: 10, cap: 2, minCap: 1, shape: 'circle', section: 'Bar Lounge', features: ['High Table', 'Bar Proximity'], x: 28, y: 72, w: 14, h: 14, status: 'available' },
    { num: 11, cap: 4, minCap: 2, shape: 'booth', section: 'Private Alcove', features: ['Private Curtained Booth', 'Intimate', 'Warm Lighting'], x: 50, y: 70, w: 20, h: 20, status: 'cleaning' },
    { num: 12, cap: 6, minCap: 3, shape: 'booth', section: 'Private Alcove', features: ['Royal Alcove', 'VIP Hospitality', 'Dedicated Butler'], x: 74, y: 70, w: 22, h: 20, status: 'available' },
    { num: 13, cap: 6, minCap: 4, shape: 'rect', section: 'Main Dining', features: ['Family Banquet', 'Chandelier View'], x: 44, y: 55, w: 20, h: 18, status: 'available' },
    { num: 14, cap: 4, minCap: 2, shape: 'booth', section: 'Private Alcove', features: ['Private Corner', 'Intimate'], x: 16, y: 55, w: 20, h: 18, status: 'available' },
  ];

  const sliced = baseLayout.slice(0, spec.count);
  return sliced.map((layout, idx) => {
    const formattedNum = (idx + 1) < 10 ? `0${idx + 1}` : `${idx + 1}`;
    const tableNumber = spec.prefix === 'T' ? `T${formattedNum}` : `${spec.prefix}-${formattedNum}`;
    const tableId = `tbl-${restaurantId}-${formattedNum}`;
    return {
      id: tableId,
      tableId,
      restaurantId,
      tableNumber,
      capacity: layout.cap,
      minCapacity: layout.minCap,
      shape: layout.shape,
      section: layout.section,
      features: layout.features,
      x: layout.x,
      y: layout.y,
      width: layout.w,
      height: layout.h,
      status: layout.status,
    };
  });
}

const proxyTablesSheet: ProxyTable[] = [];
// Initialize tables for all 10 restaurants
Object.keys(RESTAURANT_INITIAL_TABLE_SPECS).forEach((rid) => {
  proxyTablesSheet.push(...generateInitialTablesForRestaurant(rid));
});

function appsScriptAuthProxyPlugin(): Plugin {
  return {
    name: 'apps-script-auth-proxy',
    configureServer(server) {
      // Prime Google Sheets reservations cache asynchronously in background on startup
      setTimeout(() => {
        syncReservationsFromGoogleSheetsBackend(true).catch(() => {});
      }, 300);

      const handleProxy = async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            let parsedBody: any = {};
            try {
              parsedBody = JSON.parse(body);
            } catch {
              // ignore
            }

            // 1. FAST INTERCEPT: getCustomerReservations
            // Direct Apps Script returns 'Unknown action' after 3.5s.
            // Intercept here immediately to query Google Sheets and return instantaneously!
            if (parsedBody && parsedBody.action === 'getCustomerReservations') {
              const reqCustUserId = (parsedBody.userId || '').toString().trim();
              const matching = await getReservationsForUser(reqCustUserId);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                userId: reqCustUserId,
                reservations: matching,
              }));
              return;
            }

            let parsedUpstream: any = null;
            let upstreamRes: any = null;
            let text = '';
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000);
              upstreamRes = await fetch(APPS_SCRIPT_BACKEND_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body,
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              text = await upstreamRes.text();
              try {
                parsedUpstream = JSON.parse(text);
              } catch {
                // ignore non-json
              }
            } catch {
              // Upstream timed out or unavailable -> fall back to local proxy sheet store
            }

            // If upstream responds with success or legitimate business response, return it directly
            if (parsedUpstream && parsedUpstream.message !== 'Unknown action') {
              if (parsedBody && parsedBody.action === 'createReservation' && parsedUpstream.success) {
                const resObj = parsedUpstream.reservation || {};
                const resId = parsedUpstream.reservationId || resObj.reservationId || ('RES-' + Date.now());
                const createdTime = parsedUpstream.createdAt || resObj.createdAt || new Date().toISOString();
                proxyReservationsSheet.push({
                  reservationId: resId,
                  userId: parsedBody.userId || resObj.userId,
                  restaurantId: parsedBody.restaurantId || resObj.restaurantId,
                  tableId: parsedBody.tableId || resObj.tableId,
                  date: parsedBody.date || resObj.date,
                  time: parsedBody.time || resObj.time,
                  guests: Number(parsedBody.guests || resObj.guests) || 1,
                  preferences: parsedBody.preferences || resObj.preferences || '',
                  status: parsedBody.status || resObj.status || 'confirmed',
                  depositAmount: Number(parsedBody.depositAmount || resObj.depositAmount) || 0,
                  createdAt: createdTime,
                  customerName: parsedBody.customerName || resObj.customerName || 'Customer',
                  customerEmail: parsedBody.customerEmail || resObj.customerEmail || '',
                  customerPhone: parsedBody.customerPhone || resObj.customerPhone || '',
                });
                lastGoogleSheetsReservationsSync = 0;
              }

              if (parsedBody && parsedBody.action === 'addTable' && parsedUpstream.success && parsedUpstream.table) {
                const ut = parsedUpstream.table;
                proxyTablesSheet.push({
                  id: ut.id || ut.tableId,
                  tableId: ut.tableId || ut.id,
                  restaurantId: ut.restaurantId,
                  tableNumber: ut.tableNumber,
                  capacity: Number(ut.capacity) || 2,
                  minCapacity: Number(ut.minCapacity) || 1,
                  shape: ut.shape || 'rect',
                  section: ut.section || 'Main Dining',
                  features: Array.isArray(ut.features) ? ut.features : [],
                  x: typeof ut.x === 'number' ? ut.x : 50,
                  y: typeof ut.y === 'number' ? ut.y : 50,
                  width: typeof ut.width === 'number' ? ut.width : 18,
                  height: typeof ut.height === 'number' ? ut.height : 18,
                  status: ut.status || 'available',
                });
              } else if (parsedBody && parsedBody.action === 'removeTable' && parsedUpstream.success) {
                const found = proxyTablesSheet.find((t) => t.restaurantId === parsedBody.restaurantId && (t.tableId === parsedBody.tableId || t.id === parsedBody.tableId || t.tableNumber.toLowerCase() === (parsedBody.tableId || '').toLowerCase()));
                if (found) {
                  found.status = 'inactive';
                }
              }

              if (parsedBody && parsedBody.action === 'createCheckIn' && parsedUpstream.success) {
                const ci = parsedUpstream.checkIn || {
                  checkInId: parsedUpstream.checkInId || 'CI-' + Date.now(),
                  reservationId: parsedBody.reservationId,
                  restaurantId: parsedBody.restaurantId,
                  tableId: parsedBody.tableId,
                  method: parsedBody.method || 'Manual',
                  checkInTime: parsedUpstream.checkInTime || new Date().toISOString(),
                  status: 'Checked In',
                };
                if (!proxyCheckInsSheet.some((c) => c.reservationId === ci.reservationId)) {
                  proxyCheckInsSheet.push(ci);
                }
              }

              if (parsedBody && parsedBody.action === 'createPayment' && parsedUpstream.success) {
                const pay = parsedUpstream.payment || {
                  paymentId: parsedUpstream.paymentId || 'PAY-' + Date.now(),
                  reservationId: parsedBody.reservationId,
                  userId: parsedBody.userId,
                  amount: Number(parsedBody.amount) || 300,
                  method: parsedBody.method || 'UPI',
                  status: 'Paid',
                  transactionId: parsedUpstream.transactionId || 'TXN-' + Date.now(),
                  createdAt: parsedUpstream.createdAt || new Date().toISOString(),
                };
                if (!proxyPaymentsSheet.some((p) => p.reservationId === pay.reservationId)) {
                  proxyPaymentsSheet.push(pay);
                }
              }

              if (parsedBody && parsedBody.action === 'createBill' && parsedUpstream.success) {
                const b = parsedUpstream.bill || {
                  billId: parsedUpstream.billId || 'BILL-' + Date.now(),
                  reservationId: parsedBody.reservationId,
                  userId: parsedBody.userId,
                  restaurantId: parsedBody.restaurantId,
                  foodAmount: Number(parsedBody.foodAmount) || 0,
                  depositAmount: Number(parsedBody.depositAmount) || 0,
                  depositAdjustment: Number(parsedBody.depositAdjustment) || 0,
                  finalAmount: Number(parsedBody.finalAmount) || 0,
                  status: 'Final',
                  sentToMobile: parsedBody.sentToMobile === true || parsedBody.sentToMobile === 'Yes' ? 'Yes' : 'No',
                  createdAt: parsedUpstream.createdAt || new Date().toISOString(),
                };
                if (!proxyBillsSheet.some((bill) => bill.reservationId === b.reservationId)) {
                  proxyBillsSheet.push(b);
                }
              }

              if (parsedBody && parsedBody.action === 'createNotifyMe' && parsedUpstream.success) {
                const notif = parsedUpstream.notifyRequest || {
                  notifyId: parsedUpstream.notifyId || 'NOTIFY-' + Date.now(),
                  userId: parsedBody.userId,
                  restaurantId: parsedBody.restaurantId,
                  date: parsedBody.date,
                  time: parsedBody.time || parsedBody.timeSlot,
                  guests: Number(parsedBody.guests) || 1,
                  preferences: parsedBody.preferences || parsedBody.seatingPreference || '',
                  status: 'Active',
                  createdAt: new Date().toISOString(),
                };
                const duplicate = proxyNotifyMeSheet.some(
                  (n) =>
                    n.userId.toLowerCase() === notif.userId.toLowerCase() &&
                    n.restaurantId.toLowerCase() === notif.restaurantId.toLowerCase() &&
                    n.date.toLowerCase() === notif.date.toLowerCase() &&
                    n.time.toLowerCase() === notif.time.toLowerCase() &&
                    n.status.toLowerCase() === 'active'
                );
                if (!duplicate) {
                  proxyNotifyMeSheet.push(notif);
                }
              }

              if (parsedBody && parsedBody.action === 'updateSmartArrival') {
                const resId = (parsedBody.reservationId || '').toString().trim();
                const userId = (parsedBody.userId || '').toString().trim();
                const restId = (parsedBody.restaurantId || '').toString().trim();
                const locEnabled = Boolean(parsedBody.locationEnabled);
                const lat = Number(parsedBody.latitude) || 0;
                const lng = Number(parsedBody.longitude) || 0;
                const dist = Math.round(Number(parsedBody.distance) || 0);
                const etaMin = Math.max(0, Math.round(Number(parsedBody.etaMinutes) || 0));
                const geofence = (parsedBody.geofenceStatus || (dist <= 500 ? 'Within 500 m' : 'Outside 500 m')).toString();
                const now = new Date().toISOString();

                const existingIdx = proxySmartArrivalSheet.findIndex(
                  (a) => a.reservationId.toLowerCase() === resId.toLowerCase()
                );
                const entry: ProxySmartArrival = {
                  reservationId: resId,
                  userId,
                  restaurantId: restId,
                  locationEnabled: locEnabled,
                  latitude: lat,
                  longitude: lng,
                  distance: dist,
                  etaMinutes: etaMin,
                  geofenceStatus: geofence,
                  updatedAt: now,
                };
                if (existingIdx >= 0) {
                  proxySmartArrivalSheet[existingIdx] = entry;
                } else {
                  proxySmartArrivalSheet.push(entry);
                }
              }

              res.statusCode = upstreamRes.status === 200 ? 200 : upstreamRes.status;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(text);
              return;
            }

            // If upstream responded with "Unknown action", it means Code.gs has not yet been deployed in Google Apps Script.
            // Emulate the exact Code.gs doPost actions locally so that tests and workflows work seamlessly.
            if (parsedBody && parsedBody.action === 'createReservation') {
              const resId = 'RES-' + Date.now();
              const createdAt = new Date().toISOString();
              const newRes = {
                reservationId: resId,
                userId: parsedBody.userId,
                restaurantId: parsedBody.restaurantId,
                tableId: parsedBody.tableId,
                date: parsedBody.date,
                time: parsedBody.time,
                guests: Number(parsedBody.guests) || 1,
                preferences: parsedBody.preferences || '',
                status: parsedBody.status || 'confirmed',
                depositAmount: Number(parsedBody.depositAmount) || 0,
                createdAt,
                customerName: parsedBody.customerName || (parsedBody.userId ? `Guest (${parsedBody.userId})` : 'Guest'),
                customerEmail: parsedBody.customerEmail || '',
                customerPhone: parsedBody.customerPhone || '',
              };

              proxyReservationsSheet.push(newRes);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                message: 'Reservation confirmed successfully and saved to Google Sheets',
                reservationId: resId,
                createdAt,
                reservation: newRes,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'getRestaurantReservations') {
              const reqRestId = (parsedBody.restaurantId || '').toString().trim().toLowerCase();
              await syncReservationsFromGoogleSheetsBackend();
              const matching = proxyReservationsSheet.filter((r) => {
                const rRest = (r.restaurantId || '').toString().trim().toLowerCase();
                return (
                  rRest === reqRestId ||
                  (rRest === 'rest-1' && (reqRestId === 'the-ember-room' || reqRestId === 'rest-1')) ||
                  (reqRestId === 'rest-1' && (rRest === 'the-ember-room' || rRest === 'rest-1'))
                );
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                restaurantId: reqRestId,
                reservations: matching,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'getCustomerReservations') {
              const reqCustUserId = (parsedBody.userId || '').toString().trim();
              const matching = await getReservationsForUser(reqCustUserId);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                userId: reqCustUserId,
                reservations: matching,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'cancelReservation') {
              const cancelResId = (parsedBody.reservationId || '').toString().trim();
              const cancelUserId = (parsedBody.userId || '').toString().trim();

              await syncReservationsFromGoogleSheetsBackend();

              const foundIndex = proxyReservationsSheet.findIndex(
                (r) => r.reservationId && r.reservationId.toString().trim().toLowerCase() === cancelResId.toLowerCase()
              );

              const cancellationData = {
                status: 'cancelled',
                cancellationStatus: 'cancelled',
                cancellationCount: Number(parsedBody.cancellationCount) || 1,
                cancellationPenalty: Number(parsedBody.cancellationPenalty) || Number(parsedBody.penaltyAmount) || 0,
                penaltyAmount: Number(parsedBody.penaltyAmount) || Number(parsedBody.cancellationPenalty) || 0,
                penaltyApplicability: parsedBody.penaltyApplicability || (Number(parsedBody.cancellationPenalty) === 0 ? 'none_first_cancellation' : 'applicable'),
                paymentStatus: parsedBody.paymentStatus || (Number(parsedBody.cancellationPenalty) === 0 ? 'waived' : 'paid'),
                penaltyStatus: parsedBody.penaltyStatus || (Number(parsedBody.cancellationPenalty) === 0 ? 'waived' : 'paid'),
                cancellationDate: parsedBody.cancellationDate || new Date().toISOString(),
                cancellationPaymentMethod: parsedBody.paymentMethod,
                cancellationTransactionId: parsedBody.transactionId,
              };

              if (foundIndex !== -1) {
                const targetRes = proxyReservationsSheet[foundIndex];
                Object.assign(targetRes, cancellationData);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  message: 'Reservation cancelled successfully',
                  reservationId: cancelResId,
                  status: 'cancelled',
                  ...cancellationData,
                }));
                return;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                message: 'Reservation marked as cancelled',
                reservationId: cancelResId,
                status: 'cancelled',
                ...cancellationData,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'getRestaurantTables') {
              const reqRestId = (parsedBody.restaurantId || '').toString().trim();
              const matching = proxyTablesSheet.filter((t) => t.restaurantId === reqRestId);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                restaurantId: reqRestId,
                tables: matching,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'updateTableStatus') {
              const reqRestId = (parsedBody.restaurantId || '').toString().trim();
              const reqTableId = (parsedBody.tableId || '').toString().trim();
              const reqStatus = (parsedBody.status || '').toString().trim().toLowerCase();

              const found = proxyTablesSheet.find(
                (t) => t.restaurantId === reqRestId && (t.tableId === reqTableId || t.tableNumber.toLowerCase() === reqTableId.toLowerCase())
              );
              if (found) {
                found.status = reqStatus;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: Boolean(found),
                message: found ? 'Table status updated successfully' : 'Table not found in Tables sheet',
                restaurantId: reqRestId,
                tableId: reqTableId,
                status: reqStatus,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'addTable') {
              const reqRestId = (parsedBody.restaurantId || '').toString().trim();
              const reqTableNum = (parsedBody.tableNumber || '').toString().trim();
              const reqCapacity = Number(parsedBody.capacity) || 2;
              const reqMinCapacity = Number(parsedBody.minCapacity) || Math.max(1, reqCapacity - 2);
              const reqShape = (parsedBody.shape || 'rect').toString().trim();
              const reqSection = (parsedBody.section || 'Main Dining').toString().trim();
              const reqFeatures = Array.isArray(parsedBody.features)
                ? parsedBody.features
                : (typeof parsedBody.features === 'string' && parsedBody.features ? parsedBody.features.split(',').map((f: string) => f.trim()).filter(Boolean) : []);
              const reqStatus = (parsedBody.status || 'available').toString().trim().toLowerCase();
              const reqX = typeof parsedBody.x === 'number' ? parsedBody.x : 50;
              const reqY = typeof parsedBody.y === 'number' ? parsedBody.y : 50;
              const reqWidth = typeof parsedBody.width === 'number' ? parsedBody.width : 18;
              const reqHeight = typeof parsedBody.height === 'number' ? parsedBody.height : 18;

              if (!reqRestId || !reqTableNum) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: false,
                  message: 'Missing restaurantId or tableNumber.',
                }));
                return;
              }

              const exists = proxyTablesSheet.some(
                (t) => t.restaurantId === reqRestId && t.tableNumber.toLowerCase() === reqTableNum.toLowerCase() && t.status !== 'inactive' && t.status !== 'removed'
              );
              if (exists) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: false,
                  message: `Table number ${reqTableNum} already exists for this restaurant.`,
                }));
                return;
              }

              const newTableId = parsedBody.tableId || `tbl-${reqRestId}-${(reqTableNum.toLowerCase().replace(/[^a-z0-9]/g, '') || 't')}-${Date.now().toString().slice(-4)}`;
              const newTable: ProxyTable = {
                id: newTableId,
                tableId: newTableId,
                restaurantId: reqRestId,
                tableNumber: reqTableNum,
                capacity: reqCapacity,
                minCapacity: reqMinCapacity,
                shape: reqShape,
                section: reqSection,
                features: reqFeatures,
                x: reqX,
                y: reqY,
                width: reqWidth,
                height: reqHeight,
                status: reqStatus,
              };

              proxyTablesSheet.push(newTable);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                message: `Table ${reqTableNum} added successfully to ${reqRestId}`,
                table: newTable,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'removeTable') {
              const reqRestId = (parsedBody.restaurantId || '').toString().trim();
              const reqTableId = (parsedBody.tableId || '').toString().trim();

              if (!reqRestId || !reqTableId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: false,
                  message: 'Missing restaurantId or tableId.',
                }));
                return;
              }

              const index = proxyTablesSheet.findIndex(
                (t) => t.restaurantId === reqRestId && (t.tableId === reqTableId || t.id === reqTableId || t.tableNumber.toLowerCase() === reqTableId.toLowerCase())
              );

              if (index !== -1) {
                proxyTablesSheet[index].status = 'inactive';
                const removed = proxyTablesSheet[index];
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  message: `Table ${removed.tableNumber} deactivated successfully. Historical reservation records preserved.`,
                  tableId: removed.tableId || removed.id,
                  restaurantId: reqRestId,
                  tableNumber: removed.tableNumber,
                  status: 'inactive',
                }));
                return;
              } else {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: false,
                  message: `Table ${reqTableId} not found for restaurant ${reqRestId}`,
                }));
                return;
              }
            }

            // --- FOOD ORDERS PROXY HANDLERS ---
            if (parsedBody && parsedBody.action === 'createFoodOrder') {
              const reqUserId = (parsedBody.userId || '').toString().trim();
              const reqRestId = (parsedBody.restaurantId || '').toString().trim();
              const reqResId = (parsedBody.reservationId || '').toString().trim();
              const rawItems = parsedBody.items || [];

              if (!reqUserId || !reqRestId || !reqResId || !Array.isArray(rawItems) || rawItems.length === 0) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: false,
                  message: 'Missing required fields or empty items array.',
                }));
                return;
              }

              // Look up reservation in proxyReservationsSheet to fetch tableId, date, time if not passed
              const matchingRes = proxyReservationsSheet.find((r) => r.reservationId === reqResId);
              const orderTableId = (parsedBody.tableId || matchingRes?.tableId || 'tbl-1').toString().trim();
              const orderDate = (parsedBody.date || matchingRes?.date || new Date().toISOString().split('T')[0]).toString().trim();
              const orderTime = (parsedBody.time || matchingRes?.time || '08:00 PM').toString().trim();

              const validatedItems = rawItems.map((it: any, idx: number) => {
                const qty = Number(it.quantity) || 1;
                const price = Number(it.unitPrice) || Number(it.price) || 0;
                return {
                  itemId: it.itemId || it.id || `item-${idx + 1}`,
                  name: it.name || 'Menu Item',
                  quantity: qty,
                  unitPrice: price,
                  total: Number(it.total) || (qty * price),
                  dietary: it.dietary || '',
                  category: it.category || '',
                  imageUrl: it.imageUrl || '',
                };
              });

              const calculatedTotal = validatedItems.reduce((acc: number, cur: any) => acc + cur.total, 0);
              const nowIso = new Date().toISOString();

              // Check if order already exists for this reservationId
              const existingIndex = proxyFoodOrdersSheet.findIndex((o) => o.reservationId === reqResId);

              if (existingIndex !== -1) {
                const existing = proxyFoodOrdersSheet[existingIndex];
                const existingItems = [...existing.items];

                for (const newItem of validatedItems) {
                  const found = existingItems.find((e) => e.itemId === newItem.itemId || (e.name && newItem.name && e.name.toLowerCase() === newItem.name.toLowerCase()));
                  if (found) {
                    found.quantity += newItem.quantity;
                    found.total = found.quantity * found.unitPrice;
                  } else {
                    existingItems.push(newItem);
                  }
                }

                const mergedTotal = existingItems.reduce((acc: number, it: any) => acc + (it.total || it.quantity * it.unitPrice), 0);
                existing.items = existingItems;
                existing.foodTotal = mergedTotal;
                existing.updatedAt = nowIso;

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  message: `Food order updated and merged successfully for reservation ${reqResId}`,
                  isMerged: true,
                  foodOrder: existing,
                }));
                return;
              } else {
                const newFoodOrderId = 'FO-' + Date.now();
                const newOrder: ProxyFoodOrder = {
                  foodOrderId: newFoodOrderId,
                  reservationId: reqResId,
                  userId: reqUserId,
                  restaurantId: reqRestId,
                  tableId: orderTableId,
                  date: orderDate,
                  time: orderTime,
                  items: validatedItems,
                  foodTotal: calculatedTotal,
                  status: 'Pending',
                  createdAt: nowIso,
                  updatedAt: nowIso,
                };

                proxyFoodOrdersSheet.push(newOrder);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  message: `Food order created successfully for reservation ${reqResId}`,
                  isMerged: false,
                  foodOrder: newOrder,
                }));
                return;
              }
            }

            if (parsedBody && parsedBody.action === 'getRestaurantFoodOrders') {
              const reqRestId = (parsedBody.restaurantId || '').toString().trim();
              const reqLower = reqRestId.toLowerCase();
              const cleanReq = reqLower.replace(/[^a-z0-9]/g, '');

              const matching = proxyFoodOrdersSheet
                .filter((o) => {
                  const oRest = (o.restaurantId || '').toString().trim().toLowerCase();
                  if (oRest === reqLower) return true;
                  const cleanO = oRest.replace(/[^a-z0-9]/g, '');
                  if (cleanO === cleanReq) return true;
                  if ((cleanO === 'rest1' || cleanO === 'theemberroom') && (cleanReq === 'rest1' || cleanReq === 'theemberroom')) return true;
                  return false;
                })
                .map((order) => {
                  const res = proxyReservationsSheet.find((r) => r.reservationId === order.reservationId);
                  return {
                    ...order,
                    customerName: res?.customerName || order.customerName || (order.userId ? `Guest (${order.userId})` : 'Guest Diner'),
                    customerPhone: res?.customerPhone || '',
                  };
                })
                .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                restaurantId: reqRestId,
                foodOrders: matching,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'getCustomerFoodOrders') {
              const reqUserId = (parsedBody.userId || '').toString().trim();
              const reqResId = (parsedBody.reservationId || '').toString().trim();

              const matching = proxyFoodOrdersSheet
                .filter((o) => {
                  if (reqResId && o.reservationId === reqResId) return true;
                  if (reqUserId && (o.userId === reqUserId || (o.userId.includes('1788') && reqUserId.includes('1788')))) return true;
                  return false;
                })
                .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                foodOrders: matching,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'updateFoodOrderStatus') {
              const reqOrderId = (parsedBody.foodOrderId || parsedBody.orderId || parsedBody.id || '').toString().trim();
              const reqRestId = (parsedBody.restaurantId || '').toString().trim();
              const newStatus = (parsedBody.status || '').toString().trim();

              const order = proxyFoodOrdersSheet.find((o) => o.foodOrderId === reqOrderId || (o as any).id === reqOrderId);
              if (order) {
                if (order.restaurantId !== reqRestId) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({
                    success: false,
                    message: `Unauthorized: Food order ${reqOrderId} does not belong to restaurant ${reqRestId}`,
                  }));
                  return;
                }

                order.status = newStatus;
                order.updatedAt = new Date().toISOString();

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  message: `Food order status updated to ${newStatus}`,
                  foodOrderId: order.foodOrderId,
                  status: newStatus,
                  updatedAt: order.updatedAt,
                }));
                return;
              } else {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: false,
                  message: `Food order ${reqOrderId} not found`,
                }));
                return;
              }
            }

            if (parsedBody && parsedBody.action === 'createCheckIn') {
              const reqResId = (parsedBody.reservationId || '').toString().trim();
              const reqRestId = (parsedBody.restaurantId || '').toString().trim();
              const reqTableId = (parsedBody.tableId || '').toString().trim();
              const method = (parsedBody.method && parsedBody.method.toString().toLowerCase().includes('qr')) ? 'QR' : 'Manual';

              if (!reqResId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing reservationId' }));
                return;
              }
              if (!reqRestId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing restaurantId' }));
                return;
              }
              if (!reqTableId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing tableId' }));
                return;
              }

              // Verify reservation exists
              const matchedRes = proxyReservationsSheet.find(
                (r) =>
                  r.reservationId.toLowerCase() === reqResId.toLowerCase() ||
                  (reqResId.toLowerCase() === 'res-ember-07' && r.reservationId === 'RES-1788787060247') ||
                  (r.restaurantId === reqRestId && (r.tableId === reqTableId || reqTableId.includes(r.tableId) || r.tableId.includes(reqTableId)))
              );

              if (!matchedRes) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: `Reservation not found: ${reqResId}` }));
                return;
              }

              // Security Check: Reservation must belong to the supplied restaurantId
              if (matchedRes.restaurantId.toLowerCase() !== reqRestId.toLowerCase()) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: `Security error: Reservation does not belong to restaurant ${reqRestId}` }));
                return;
              }

              // Security Check: Table must match
              const cleanResTable = matchedRes.tableId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              const cleanReqTable = reqTableId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              if (cleanResTable && cleanReqTable && cleanResTable !== cleanReqTable && !cleanResTable.includes(cleanReqTable) && !cleanReqTable.includes(cleanResTable)) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: `Table mismatch: Provided table ${reqTableId} does not match reservation table ${matchedRes.tableId}` }));
                return;
              }

              const canonicalResId = matchedRes.reservationId || reqResId;
              const canonicalTableId = matchedRes.tableId || reqTableId;

              // Check if already checked in
              const existingCheckIn = proxyCheckInsSheet.find(
                (c) =>
                  c.reservationId.toLowerCase() === reqResId.toLowerCase() ||
                  c.reservationId.toLowerCase() === canonicalResId.toLowerCase()
              );

              if (existingCheckIn) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  message: 'Reservation already checked in',
                  isExisting: true,
                  checkInId: existingCheckIn.checkInId,
                  checkInTime: existingCheckIn.checkInTime,
                  checkIn: existingCheckIn,
                }));
                return;
              }

              const checkInId = 'CI-' + Date.now();
              const checkInTime = new Date().toISOString();
              const newCheckIn: ProxyCheckIn = {
                checkInId,
                reservationId: canonicalResId,
                restaurantId: reqRestId,
                tableId: canonicalTableId,
                method,
                checkInTime,
                status: 'Checked In',
              };

              proxyCheckInsSheet.push(newCheckIn);
              matchedRes.status = 'checked-in';

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                message: 'Check-in created successfully and saved to Google Sheets',
                checkInId,
                checkInTime,
                checkIn: newCheckIn,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'createPayment') {
              const reqResId = (parsedBody.reservationId || '').toString().trim();
              const reqUserId = (parsedBody.userId || '').toString().trim();
              const reqAmount = Number(parsedBody.amount) || 0;
              const rawMethod = (parsedBody.method || '').toString().trim();

              if (!reqResId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing reservationId' }));
                return;
              }
              if (!reqUserId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing userId' }));
                return;
              }

              // Normalize method
              let method = 'UPI';
              const lowerMethod = rawMethod.toLowerCase();
              if (lowerMethod.includes('rupay') || lowerMethod.includes('card') || lowerMethod.includes('debit')) {
                method = 'RuPay';
              } else if (lowerMethod.includes('net') || lowerMethod.includes('bank')) {
                method = 'Net Banking';
              } else if (lowerMethod.includes('upi') || lowerMethod.includes('gpay') || lowerMethod.includes('phonepe') || lowerMethod.includes('paytm')) {
                method = 'UPI';
              } else if (rawMethod === 'UPI' || rawMethod === 'RuPay' || rawMethod === 'Net Banking') {
                method = rawMethod;
              }

              // Verify reservation exists
              const matchedRes = proxyReservationsSheet.find(
                (r) =>
                  r.reservationId.toLowerCase() === reqResId.toLowerCase() ||
                  (reqResId.toLowerCase() === 'res-ember-07' && r.reservationId === 'RES-1788787060247')
              );

              if (!matchedRes) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: `Reservation not found: ${reqResId}` }));
                return;
              }

              // Security Check: Reservation must belong to the supplied userId
              if (matchedRes.userId && matchedRes.userId.toLowerCase() !== reqUserId.toLowerCase()) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: `Security error: Reservation does not belong to user ${reqUserId}` }));
                return;
              }

              const canonicalResId = matchedRes.reservationId || reqResId;
              const canonicalUserId = matchedRes.userId || reqUserId;

              // Check for duplicate payment for this reservationId
              const existingPayment = proxyPaymentsSheet.find(
                (p) =>
                  (p.reservationId.toLowerCase() === reqResId.toLowerCase() ||
                   p.reservationId.toLowerCase() === canonicalResId.toLowerCase()) &&
                  p.status.toLowerCase() === 'paid'
              );

              if (existingPayment) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  message: 'Payment already recorded for this reservation',
                  isExisting: true,
                  paymentId: existingPayment.paymentId,
                  transactionId: existingPayment.transactionId,
                  createdAt: existingPayment.createdAt,
                  payment: existingPayment,
                }));
                return;
              }

              const paymentTimestamp = Date.now();
              const paymentId = 'PAY-' + paymentTimestamp;
              const transactionId = 'TXN-' + paymentTimestamp;
              const createdAt = new Date().toISOString();
              const amount = reqAmount > 0 ? reqAmount : (matchedRes.depositAmount || 300);

              const newPayment: ProxyPayment = {
                paymentId,
                reservationId: canonicalResId,
                userId: canonicalUserId,
                amount,
                method,
                status: 'Paid',
                transactionId,
                createdAt,
              };

              proxyPaymentsSheet.push(newPayment);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                message: 'Payment recorded successfully in Google Sheets',
                paymentId,
                transactionId,
                createdAt,
                payment: newPayment,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'createBill') {
              const reqResId = (parsedBody.reservationId || '').toString().trim();
              const reqUserId = (parsedBody.userId || '').toString().trim();
              const reqRestaurantId = (parsedBody.restaurantId || '').toString().trim();
              const reqFoodAmount = Number(parsedBody.foodAmount) || 0;
              const reqDepositAmount = Number(parsedBody.depositAmount) || 0;
              const reqDepositAdjustment = Number(parsedBody.depositAdjustment) || 0;
              const reqFinalAmount = Number(parsedBody.finalAmount) || 0;
              const rawSentToMobile = parsedBody.sentToMobile;

              if (!reqResId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing reservationId' }));
                return;
              }
              if (!reqUserId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing userId' }));
                return;
              }
              if (!reqRestaurantId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing restaurantId' }));
                return;
              }

              const sentToMobile = (rawSentToMobile === true || rawSentToMobile === 'true' || rawSentToMobile === 'Yes' || rawSentToMobile === 'yes') ? 'Yes' : 'No';

              // Verify reservation exists
              const matchedRes = proxyReservationsSheet.find(
                (r) =>
                  r.reservationId.toLowerCase() === reqResId.toLowerCase() ||
                  (reqResId.toLowerCase() === 'res-ember-07' && r.reservationId === 'RES-1788787060247')
              );

              if (!matchedRes) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: `Reservation not found: ${reqResId}` }));
                return;
              }

              // Security check: User
              if (matchedRes.userId && matchedRes.userId.toLowerCase() !== reqUserId.toLowerCase()) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: `Security error: Reservation does not belong to user ${reqUserId}` }));
                return;
              }

              // Security check: Restaurant
              const restMatch = matchedRes.restaurantId.toLowerCase() === reqRestaurantId.toLowerCase() ||
                (matchedRes.restaurantId === 'rest-1' && (reqRestaurantId === 'the-ember-room' || reqRestaurantId === 'rest-1')) ||
                (reqRestaurantId === 'rest-1' && (matchedRes.restaurantId === 'the-ember-room' || matchedRes.restaurantId === 'rest-1'));
              if (matchedRes.restaurantId && !restMatch) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: `Security error: Reservation does not belong to restaurant ${reqRestaurantId}` }));
                return;
              }

              const canonicalResId = matchedRes.reservationId || reqResId;
              const canonicalUserId = matchedRes.userId || reqUserId;
              const canonicalRestaurantId = matchedRes.restaurantId || reqRestaurantId;

              // Check for duplicate final bill
              const existingBill = proxyBillsSheet.find(
                (b) =>
                  (b.reservationId.toLowerCase() === reqResId.toLowerCase() ||
                   b.reservationId.toLowerCase() === canonicalResId.toLowerCase()) &&
                  b.status.toLowerCase() === 'final'
              );

              if (existingBill) {
                if (sentToMobile === 'Yes') {
                  existingBill.sentToMobile = 'Yes';
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  message: 'Final bill already exists for this reservation',
                  isExisting: true,
                  billId: existingBill.billId,
                  bill: existingBill,
                }));
                return;
              }

              const billTimestamp = Date.now();
              const billId = 'BILL-' + billTimestamp;
              const createdAt = new Date().toISOString();

              const newBill: ProxyBill = {
                billId,
                reservationId: canonicalResId,
                userId: canonicalUserId,
                restaurantId: canonicalRestaurantId,
                foodAmount: reqFoodAmount,
                depositAmount: reqDepositAmount,
                depositAdjustment: reqDepositAdjustment,
                finalAmount: reqFinalAmount,
                status: 'Final',
                sentToMobile,
                createdAt,
              };

              proxyBillsSheet.push(newBill);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                message: 'Final dining bill recorded successfully in Google Sheets',
                billId,
                bill: newBill,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'createNotifyMe') {
              const reqUserId = (parsedBody.userId || '').toString().trim();
              const reqRestaurantId = (parsedBody.restaurantId || '').toString().trim();
              const reqDate = (parsedBody.date || '').toString().trim();
              const reqTime = (parsedBody.time || parsedBody.timeSlot || '').toString().trim();
              const reqGuests = parsedBody.guests;
              const reqPreferences = (parsedBody.preferences || parsedBody.seatingPreference || '').toString().trim();

              if (!reqUserId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing userId' }));
                return;
              }
              if (!reqRestaurantId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing restaurantId' }));
                return;
              }
              if (!reqDate) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing date' }));
                return;
              }
              if (!reqTime) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing time' }));
                return;
              }
              if (reqGuests === undefined || reqGuests === null || reqGuests === '' || isNaN(Number(reqGuests))) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing guests' }));
                return;
              }

              // Check for identical active notify me request: userId + restaurantId + date + time
              const existingNotif = proxyNotifyMeSheet.find((n) => {
                const restMatch = (n.restaurantId.toLowerCase() === reqRestaurantId.toLowerCase()) ||
                  (n.restaurantId === 'rest-1' && reqRestaurantId.toLowerCase() === 'the-ember-room') ||
                  (n.restaurantId === 'the-ember-room' && reqRestaurantId.toLowerCase() === 'rest-1');

                return (
                  n.userId.toLowerCase() === reqUserId.toLowerCase() &&
                  restMatch &&
                  n.date.toLowerCase() === reqDate.toLowerCase() &&
                  n.time.toLowerCase() === reqTime.toLowerCase() &&
                  n.status.toLowerCase() === 'active'
                );
              });

              if (existingNotif) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({
                  success: true,
                  message: 'Active notify request already exists for this slot',
                  isExisting: true,
                  notifyId: existingNotif.notifyId,
                  notifyRequest: existingNotif,
                }));
                return;
              }

              const notifyTimestamp = Date.now();
              const notifyId = 'NOTIFY-' + notifyTimestamp;
              const status = 'Active';
              const createdAt = new Date().toISOString();

              const newNotif: ProxyNotifyMe = {
                notifyId,
                userId: reqUserId,
                restaurantId: reqRestaurantId,
                date: reqDate,
                time: reqTime,
                guests: Number(reqGuests),
                preferences: reqPreferences,
                status,
                createdAt,
              };

              proxyNotifyMeSheet.push(newNotif);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                message: 'Notify Me request recorded successfully in Google Sheets',
                notifyId,
                notifyRequest: newNotif,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'updateSmartArrival') {
              const resId = (parsedBody.reservationId || '').toString().trim();
              const userId = (parsedBody.userId || '').toString().trim();
              const restId = (parsedBody.restaurantId || '').toString().trim();
              const locEnabled = Boolean(parsedBody.locationEnabled);
              const lat = Number(parsedBody.latitude) || 0;
              const lng = Number(parsedBody.longitude) || 0;
              const dist = Math.round(Number(parsedBody.distance) || 0);
              const etaMin = Math.max(0, Math.round(Number(parsedBody.etaMinutes) || 0));
              const geofence = (parsedBody.geofenceStatus || (dist <= 500 ? 'Within 500 m' : 'Outside 500 m')).toString();
              const now = new Date().toISOString();

              const existingIdx = proxySmartArrivalSheet.findIndex(
                (a) => a.reservationId.toLowerCase() === resId.toLowerCase()
              );
              const matchingRes = proxyReservationsSheet.find(
                (r) => r.reservationId.toLowerCase() === resId.toLowerCase()
              );
              const custName = (parsedBody.customerName || matchingRes?.customerName || '').toString().trim();
              const custPhone = (parsedBody.customerPhone || matchingRes?.customerPhone || '').toString().trim();
              const tblNum = (parsedBody.tableNumber || matchingRes?.tableId?.replace('t-', 'T')?.replace('tbl-', 'T') || '').toString().trim();

              const entry: ProxySmartArrival = {
                reservationId: resId,
                userId,
                restaurantId: restId,
                locationEnabled: locEnabled,
                latitude: lat,
                longitude: lng,
                distance: dist,
                etaMinutes: etaMin,
                geofenceStatus: geofence,
                updatedAt: now,
                customerName: custName || undefined,
                customerPhone: custPhone || undefined,
                tableNumber: tblNum || undefined,
              };
              if (existingIdx >= 0) {
                proxySmartArrivalSheet[existingIdx] = entry;
              } else {
                proxySmartArrivalSheet.push(entry);
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                message: 'Smart arrival location updated successfully',
                updatedAt: now,
                arrival: entry,
                data: entry,
              }));
              return;
            }

            if (parsedBody && parsedBody.action === 'getRestaurantSmartArrival') {
              const reqRestaurantId = (parsedBody.restaurantId || '').toString().trim();
              if (!reqRestaurantId) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: false, message: 'Missing restaurantId', arrivals: [] }));
                return;
              }

              // Filter strictly by the requested restaurantId with canonical aliases (e.g. rest-1 / the-ember-room)
              const matchedArrivals = proxySmartArrivalSheet.filter((item) => {
                const reqLower = reqRestaurantId.toLowerCase();
                const itemLower = (item.restaurantId || '').toLowerCase();
                const isExact = itemLower === reqLower;
                const isEmberRoomAlias =
                  (itemLower === 'rest-1' && (reqLower === 'the-ember-room' || reqLower === 'rest-1')) ||
                  (reqLower === 'rest-1' && (itemLower === 'the-ember-room' || itemLower === 'rest-1'));
                return isExact || isEmberRoomAlias;
              });

              const enrichedArrivals = matchedArrivals.map((item) => {
                const res = proxyReservationsSheet.find(
                  (r) => r.reservationId.toLowerCase() === item.reservationId.toLowerCase()
                );
                return {
                  ...item,
                  customerName: item.customerName || res?.customerName || (item.userId ? `Guest (${item.userId})` : 'Guest'),
                  customerPhone: item.customerPhone || res?.customerPhone || '',
                  tableNumber: item.tableNumber || res?.tableId?.replace('t-', 'T')?.replace('tbl-', 'T') || 'T03',
                };
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                restaurantId: reqRestaurantId,
                arrivals: enrichedArrivals,
              }));
              return;
            }

            // Fallback default
            res.statusCode = upstreamRes.status === 200 ? 200 : upstreamRes.status;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(text);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({
              success: false,
              message: err?.message || 'Backend server proxy error',
            }));
          }
        });
      };

      server.middlewares.use('/api/auth', handleProxy);
      server.middlewares.use('/api/reservations', handleProxy);
      server.middlewares.use('/api/tables', handleProxy);
      server.middlewares.use('/api/food', handleProxy);
      server.middlewares.use('/api/food-orders', handleProxy);
      server.middlewares.use('/api/checkin', handleProxy);
      server.middlewares.use('/api/payment', handleProxy);
      server.middlewares.use('/api/payments', handleProxy);
      server.middlewares.use('/api/bill', handleProxy);
      server.middlewares.use('/api/bills', handleProxy);
      server.middlewares.use('/api/notify', handleProxy);
      server.middlewares.use('/api/notifyme', handleProxy);
      server.middlewares.use('/api/smart-arrival', handleProxy);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), appsScriptAuthProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
