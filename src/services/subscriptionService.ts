import { RestaurantSubscriptionPlan, RestaurantSubscriptionStatus, SubscriptionPlanId } from '../types';

export const RESTAURANT_SUBSCRIPTION_PLANS: RestaurantSubscriptionPlan[] = [
  {
    id: 'free-month',
    name: '1st Month Free Trial',
    durationMonths: 1,
    durationLabel: '1st Month FREE (30 Days)',
    price: 0,
    regularPrice: 299,
    badge: '100% FREE TRIAL',
    tagline: 'Zero risk, full partner features to experience Flash Table live dining',
    isFree: true,
    features: [
      'Full live table & seating inventory management',
      'Real-time dining timer & seat pacing tracker',
      'Digital QR tableside menu with food rates',
      'Smart Arrival customer ETA notifications',
      'Instant booking confirmations & SMS dispatch',
      'Standard partner email & phone support'
    ]
  },
  {
    id: '3-months',
    name: 'Quarterly Partner Plan',
    durationMonths: 3,
    durationLabel: '3 Months (Quarterly)',
    price: 299,
    regularPrice: 499,
    badge: '₹299 for 3 Months',
    tagline: 'Ideal for neighborhood cafes, bistros, and boutique dining spots (~₹100/mo)',
    features: [
      'Everything in 1st Month Free Trial',
      'Priority seat allocation & live table hold',
      'Automated SMS & WhatsApp table confirmations',
      'Live menu inventory toggles & dietary allergen tagging',
      'Daily occupancy insights & table turnover reports',
      'Priority partner phone support'
    ]
  },
  {
    id: '6-months',
    name: 'Half-Yearly Growth Plan',
    durationMonths: 6,
    durationLabel: '6 Months (~₹100/mo)',
    price: 599,
    regularPrice: 999,
    badge: 'POPULAR CHOICE',
    isPopular: true,
    tagline: 'Best for high-traffic restaurants looking to maximize seat utilization',
    features: [
      'Everything in 3 Months Plan',
      'Bus passenger & Travel Dining pre-order routing',
      'Solo diner safety verification & automated escort notes',
      'Peak-hour predictive occupancy optimization',
      'Promoted partner badge on Customer Discovery',
      'Dedicated partner relationship manager'
    ]
  },
  {
    id: '12-months',
    name: 'Annual Pro Plan',
    durationMonths: 12,
    durationLabel: '12 Months (<₹92/mo)',
    price: 1099,
    regularPrice: 1799,
    badge: 'BEST VALUE • SAVE 70%',
    isBestValue: true,
    tagline: 'Complete annual partnership for premier dining institutions',
    features: [
      'Everything in 6 Months Plan',
      'Top search placement across Flash Table customer discovery',
      'Custom interactive 3D floor layout architecture',
      'Zero transaction commission on bill settlements',
      'Instant SMS guest recall & waitlist broadcasts',
      'VIP 24/7 priority concierge desk'
    ]
  }
];

const STORAGE_PREFIX = 'flashtable_sub_';

export function getRestaurantSubscription(restaurantId: string): RestaurantSubscriptionStatus {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${restaurantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Recalculate days remaining
      const expiry = new Date(parsed.expiryDate);
      const now = new Date();
      const diffTime = expiry.getTime() - now.getTime();
      const days = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      return {
        ...parsed,
        daysRemaining: days,
        status: days <= 0 ? 'expired' : days <= 5 ? 'expiring_soon' : 'active'
      };
    }
  } catch {
    // fallback
  }

  // Default initial subscription: 1st Month Free Trial
  const startDate = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(startDate.getDate() + 30);

  const defaultSub: RestaurantSubscriptionStatus = {
    restaurantId,
    planId: 'free-month',
    planName: '1st Month Free Trial',
    startDate: startDate.toISOString(),
    expiryDate: expiryDate.toISOString(),
    daysRemaining: 30,
    amountPaid: 0,
    status: 'active',
    paymentMethod: 'Free Partner Launch Promotion',
    transactionId: `SUB-FREE-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
  };

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${restaurantId}`, JSON.stringify(defaultSub));
  } catch {
    // ignore
  }

  return defaultSub;
}

export function activateRestaurantSubscription(
  restaurantId: string,
  planId: SubscriptionPlanId,
  paymentMethod: string = 'UPI / NetBanking'
): RestaurantSubscriptionStatus {
  const plan = RESTAURANT_SUBSCRIPTION_PLANS.find((p) => p.id === planId) || RESTAURANT_SUBSCRIPTION_PLANS[0];
  const startDate = new Date();
  const expiryDate = new Date();
  
  // Calculate days based on months
  const totalDays = plan.durationMonths === 1 ? 30 : plan.durationMonths * 30;
  expiryDate.setDate(startDate.getDate() + totalDays);

  const newSub: RestaurantSubscriptionStatus = {
    restaurantId,
    planId: plan.id,
    planName: plan.name,
    startDate: startDate.toISOString(),
    expiryDate: expiryDate.toISOString(),
    daysRemaining: totalDays,
    amountPaid: plan.price,
    status: 'active',
    paymentMethod,
    transactionId: `SUB-${plan.id.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  };

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${restaurantId}`, JSON.stringify(newSub));
    window.dispatchEvent(new CustomEvent('flashtable_subscription_updated', { detail: newSub }));
  } catch {
    // ignore
  }

  return newSub;
}
