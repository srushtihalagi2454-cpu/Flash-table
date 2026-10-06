export type TableState = 'available' | 'selected' | 'reserved' | 'occupied' | 'cleaning' | 'unavailable' | 'inactive' | 'removed';

export type UserRole = 'customer' | 'restaurant-owner';

export type SeatingPreference = 'all' | 'window' | 'booth' | 'terrace' | 'quiet' | 'bar';

export type TableShape = 'rect' | 'circle' | 'booth';

export interface Table {
  id: string;
  tableId?: string;
  restaurantId?: string;
  tableNumber: string;
  capacity: number;
  minCapacity: number;
  shape: TableShape;
  section: 'Main Dining' | 'Courtyard Terrace' | 'Bar Lounge' | 'Private Alcove' | string;
  features: string[]; // e.g. ['Window View', 'Quiet', 'Near Bar', 'Garden View']
  x: number; // percentage coordinate 0-100
  y: number; // percentage coordinate 0-100
  width: number;
  height: number;
  status?: TableState;
  // Dynamic slot availability map: `${date}_${timeSlot}` -> TableState
  slotStatus?: Record<string, TableState>;
}

export interface RestaurantReview {
  id?: string;
  comment: string;
  quote?: string;
  author: string;
  rating?: number;
}

export interface Restaurant {
  id: string;
  name: string;
  tagline: string;
  neighborhood: string;
  city: string;
  address: string;
  cuisines: string[];
  costForTwo: number;
  rating: number;
  reviewCount: number;
  heroImage: string;
  galleryImages: string[];
  features: string[];
  openingHours: string;
  contactNumber: string;
  customerCareNumber?: string;
  ownerName?: string;
  floorPlanName: string;
  tables: Table[];
  popularDishes: string[];
  description: string;
  experienceTag?: string;
  category?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  menu?: RestaurantMenu;
  reviews?: RestaurantReview[];
  // Travel Dining & Bus Stop Features
  isTravelStopPartner?: boolean;
  isPopularTravelStop?: boolean; // ⭐ Popular Travel Stop indicator
  travelStopBadgeReason?: string; // e.g. "Frequently selected by travelling passengers"
  travelServices?: ('dine_in' | 'parcel')[];
  nearbyBusStops?: {
    stopName: string;
    distanceKm: number;
    highwayRoute: string;
    walkingOrTransitTimeMin: number;
  }[];
  averageFoodPrepMinutes?: number;
}

export type DietaryType = 'veg' | 'non-veg' | 'vegan';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number; // in INR (₹)
  category: string; // e.g. "Starters", "Mains", "Breads & Rice", "Desserts", "Beverages"
  dietary: DietaryType;
  imageUrl?: string;
  isChefSpecial?: boolean;
  isBestseller?: boolean;
  isJain?: boolean;
  isGlutenFree?: boolean;
  hasEgg?: boolean;
  containsNuts?: boolean;
  dietaryTags?: string[];
  spiceLevel?: 'Mild' | 'Medium' | 'Spicy';
  preparationTime?: string;
  calories?: string;
  portionSize?: string;
  isOutOfStock?: boolean;
}

export interface MenuCategory {
  name: string;
  description?: string;
  items: MenuItem[];
}

export interface RestaurantMenu {
  restaurantId: string;
  restaurantName: string;
  currency: string;
  lastUpdated: string;
  categories: MenuCategory[];
}

export interface PaymentDetails {
  depositAmount: number; // e.g. 200
  paymentStatus: 'paid' | 'pending' | 'adjusted' | 'refunded';
  paymentMethod: 'UPI' | 'RuPay' | 'Net Banking' | string;
  paymentMethodDetail?: string; // e.g. 'UPI (Google Pay)', 'RuPay Platinum Card'
  transactionId: string;
  paidAt: string;
  isRefundable: boolean;
}

export interface BillItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  dietary?: DietaryType;
  intendedFor?: string;
  dietaryTag?: string;
  allergenTags?: string[];
  severity?: AllergenSeverity;
  kitchenNotes?: string;
}

export interface DiningBill {
  billNumber: string;
  reservationId: string;
  restaurantId: string;
  restaurantName: string;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  date: string;
  timeSlot: string;
  items: BillItem[];
  subtotal: number;
  gstAmount: number; // 5% GST
  serviceCharge: number; // 5% optional service charge
  grossTotal: number;
  depositAdjusted: number; // Refundable deposit deducted, e.g. 300
  netPayable: number;
  paymentStatus: 'paid' | 'pending' | 'settled';
  settledVia?: string;
  generatedAt: string;
  digitalBillSmsSentTo?: string;
}

export type SoloSafetyNotifyMethod = 'WhatsApp' | 'SMS' | 'Both';
export type SoloSafetyStatus = 'pending' | 'notified' | 'dispatched';

export interface SoloDinerSafetyDispatchLog {
  dispatchId: string;
  channel: SoloSafetyNotifyMethod;
  recipientName: string;
  recipientPhone: string;
  relationship: string;
  timestamp: string;
  restaurantName: string;
  tableNumber: string;
  neighborhood: string;
  messageText: string;
  deliveryStatus: 'delivered' | 'sent';
}

export interface SoloDinerSafetyContact {
  enabled: boolean;
  contactName: string;
  contactPhone: string;
  relationship: string; // 'Parent / Family' | 'Partner' | 'Friend' | 'Sibling' | 'Colleague' | 'Roommate' | 'Other'
  notifyMethod: SoloSafetyNotifyMethod;
  customNote?: string;
  status: SoloSafetyStatus;
  notifiedAt?: string;
  notificationDispatchLog?: SoloDinerSafetyDispatchLog;
}

export interface DiningClockSession {
  clockInTime: string; // ISO timestamp string e.g. "2026-09-12T19:30:00.000Z"
  clockInDisplayTime: string; // Formatted 12-hour string e.g. "07:30 PM"
  clockOutTime?: string; // ISO timestamp string e.g. "2026-09-12T21:15:00.000Z"
  clockOutDisplayTime?: string; // Formatted 12-hour string e.g. "09:15 PM"
  durationMinutes?: number;
  durationFormatted?: string; // e.g. "1 hr 45 min" or "45 min"
  status: 'clocked_in' | 'clocked_out';
  notes?: string;
  updatedAt: string;
}

export type TravelFulfillmentType = 'dine_in' | 'parcel';

export type TravelBookingStatus =
  | 'Booking Requested'
  | 'Restaurant Confirmed'
  | 'Food Preparation'
  | 'Ready'
  | 'Passenger Arrived'
  | 'QR Check-in / Parcel Collected'
  | 'Completed'
  | 'Cancelled';

export type TravelFoodPrepStatus = 'Prepare Soon' | 'Preparing' | 'Ready' | 'Served / Handed Over';

export interface TravelAllocatedTable {
  tableId: string;
  tableNumber: string;
  section: string;
  capacity: number;
}

export interface TravelDetails {
  isTravellingByBus: boolean;
  busOperator?: string; // e.g. "KSRTC Airavat", "BMTC Volvo", "VRL Travels"
  routeNumber?: string; // e.g. "Route 1 (NH 75 East)"
  busNumberOrPnr?: string; // e.g. "KA-01-F-9920" or "PNR 78829"
  busStopName?: string; // e.g. "Indiranagar 100 Feet Road Bus Stop"
  expectedArrivalTime: string; // e.g. "08:15 PM"
  expectedArrivalTimestamp?: string;
  fulfillmentType: TravelFulfillmentType; // 'dine_in' | 'parcel'
  passengerCount: number;
  isGroupBooking?: boolean;
  allocatedTables?: TravelAllocatedTable[];
  allocatedTableNumbers?: string[]; // e.g. ['T03', 'T04'] for group of 8
  prepStatus: TravelFoodPrepStatus;
  travelStatus: TravelBookingStatus;
  estimatedPrepMinutes?: number;
  pickupCounterOrCurbside?: string;
  dietaryRequirementsSummary?: string[];
  notes?: string;
}

export interface Reservation {
  id: string;
  userId?: string;
  bookingRef: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  tableId: string;
  tableNumber: string;
  section: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "08:00 PM" or "07:30 PM - 09:15 PM"
  timeIn?: string; // e.g. "07:30 PM" (Expected arrival)
  timeOut?: string; // e.g. "09:15 PM" (Expected departure)
  durationFormatted?: string; // e.g. "1 hr 45 min"
  durationMinutes?: number; // e.g. 105
  guests: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  specialRequests?: string;
  status: 'confirmed' | 'arrived' | 'seated' | 'checked-in' | 'completed' | 'cancelled' | 'no-show';
  createdAt: string;
  qrCodeData: string;
  noShowRiskScore?: 'Low' | 'Moderate' | 'High';
  depositAmount?: number;
  paymentStatus?: 'paid' | 'pending' | 'adjusted' | 'refunded';
  paymentMethod?: string;
  paymentTransactionId?: string;
  paymentDetails?: PaymentDetails;
  diningBill?: DiningBill;
  billSent?: boolean;
  foodOrder?: FoodOrder;
  soloDinerSafety?: SoloDinerSafetyContact;
  diningClockSession?: DiningClockSession;
  clockInTime?: string;
  clockOutTime?: string;
  diningDurationMinutes?: number;
  diningDurationFormatted?: string;
  // Cancellation and ₹100 Penalty Tracking
  cancellationDate?: string;
  cancellationCount?: number;
  penaltyAmount?: number;
  cancellationPenalty?: number; // 0 for 1st cancellation, ₹100 for 2nd+
  penaltyApplicability?: 'none_first_cancellation' | 'applicable' | 'waived';
  cancellationStatus?: 'not_cancelled' | 'cancelled';
  penaltyStatus?: 'none' | 'pending' | 'paid' | 'waived';
  cancellationPaymentMethod?: string;
  cancellationTransactionId?: string;
  cancellationRecord?: CancellationRecord;
  restaurantCustomerCareNumber?: string;
  travelDetails?: TravelDetails;
}

export interface CancellationRecord {
  reservationId: string;
  userId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantCustomerCareNumber?: string;
  bookingDate: string;
  timeIn: string;
  timeOut: string;
  tableNumber: string;
  cancellationDate: string; // ISO or formatted IST date
  cancellationCount: number; // 1 for 1st cancellation, 2 for 2nd, etc.
  penaltyAmount: number; // 0 for 1st, 100 for 2nd+
  cancellationPenalty: number; // alias for penaltyAmount
  penaltyApplicability: 'none_first_cancellation' | 'applicable' | 'waived';
  paymentStatus: 'waived' | 'paid' | 'pending' | 'free';
  cancellationStatus: 'cancelled';
  penaltyStatus: 'none' | 'paid' | 'pending' | 'waived';
  paymentMethod: string;
  transactionId: string;
  notes?: string;
}

export type FoodOrderStatus = 'Pending' | 'Accepted' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled';

export type AllergenSeverity = 'severe' | 'intolerance' | 'preference';

export interface ItemDietaryTag {
  intendedFor?: string;
  dietaryPreference?: string;
  allergens?: string[];
  severity?: AllergenSeverity;
  kitchenNotes?: string;
}

export interface FoodOrderItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  price?: number;
  total: number;
  dietary?: DietaryType;
  category?: string;
  imageUrl?: string;
  // Allergen & Dietary Safety Tagging tied to kitchen prep
  intendedFor?: string;
  dietaryTag?: string;
  allergenTags?: string[];
  severity?: AllergenSeverity;
  kitchenNotes?: string;
}

export interface FoodOrder {
  id?: string; // Canonical alias for foodOrderId
  foodOrderId: string;
  reservationId: string;
  userId: string;
  restaurantId: string;
  tableId: string;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  date: string;
  time: string;
  items: FoodOrderItem[];
  foodTotal: number;
  status: FoodOrderStatus;
  createdAt: string;
  updatedAt: string;
  hasAllergenAlert?: boolean;
  allergenSummary?: string[];
  kitchenAcknowledged?: boolean;
  kitchenAcknowledgedAt?: string;
}

export interface SmartMatchResult {
  table: Table;
  matchScore: number;
  matchReasons: string[];
}

export interface NotifyRequest {
  id: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  timeSlot: string;
  guests: number;
  seatingPreference: string;
  phone: string;
  email: string;
  createdAt: string;
  status: 'active' | 'notified';
}

export interface UserProfile {
  name: string;
  phone: string;
  email: string;
  city: string;
  loyaltyPoints: number;
}

export type AuthMode = 'login' | 'signup';

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignUpFormData {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  confirmPassword: string;
}

export interface AuthValidationErrors {
  fullName?: string;
  email?: string;
  mobileNumber?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export interface MockCustomer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: string;
  loyaltyTier?: string;
  status: 'active';
}

export type SmartArrivalDistanceOption = '1.2 km' | '800 m' | '500 m' | '300 m';

export interface SmartArrivalState {
  isEnabled: boolean;
  reservationId: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  restaurantId?: string;
  restaurantName: string;
  restaurantLocation: string;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  tableNumber: string;
  timeSlot: string;
  guests: number;
  preferences: string;
  distanceOption?: SmartArrivalDistanceOption;
  distanceMeters: number | null;
  distanceText?: string;
  etaMinutes?: number | null;
  etaText?: string;
  customerStatus: string;
  restaurantStatus: string;
  isInsideGeofence: boolean;
  geofenceRadiusMeters: number;
  // Real Customer Geolocation fields
  isGpsActive?: boolean;
  customerLat?: number | null;
  customerLng?: number | null;
  customerAccuracy?: number | null;
  gpsStatus?: 'idle' | 'requesting' | 'active' | 'error' | 'unsupported';
  gpsError?: string | null;
  // Backend Sync fields (updateSmartArrival)
  backendSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  backendSyncError?: string | null;
  lastSyncedAt?: string | null;
}

export interface SmartArrivalRecord {
  reservationId: string;
  userId?: string;
  restaurantId: string;
  locationEnabled: boolean;
  latitude: number;
  longitude: number;
  distance: number;
  etaMinutes: number;
  geofenceStatus: string;
  lastUpdated?: string;
  updatedAt?: string;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
}
