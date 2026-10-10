import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  CreditCard, 
  ArrowRight, 
  Clock, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Receipt,
  QrCode,
  Building2,
  X
} from 'lucide-react';
import { Restaurant, RestaurantSubscriptionPlan, RestaurantSubscriptionStatus, SubscriptionPlanId } from '../types';
import { 
  RESTAURANT_SUBSCRIPTION_PLANS, 
  getRestaurantSubscription, 
  activateRestaurantSubscription 
} from '../services/subscriptionService';
import { formatINR } from '../utils/priceUtils';

interface RestaurantSubscriptionPlansTabProps {
  restaurant: Restaurant;
  onToast?: (message: string) => void;
}

export const RestaurantSubscriptionPlansTab: React.FC<RestaurantSubscriptionPlansTabProps> = ({
  restaurant,
  onToast,
}) => {
  const [currentSub, setCurrentSub] = useState<RestaurantSubscriptionStatus>(() => 
    getRestaurantSubscription(restaurant.id)
  );
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<RestaurantSubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState<string>('partner@upi');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<RestaurantSubscriptionStatus | null>(null);

  // Sync state if subscription changes
  useEffect(() => {
    setCurrentSub(getRestaurantSubscription(restaurant.id));
    const handleUpdate = (e: any) => {
      if (e.detail?.restaurantId === restaurant.id) {
        setCurrentSub(e.detail);
      }
    };
    window.addEventListener('flashtable_subscription_updated', handleUpdate);
    return () => window.removeEventListener('flashtable_subscription_updated', handleUpdate);
  }, [restaurant.id]);

  const handleOpenCheckout = (plan: RestaurantSubscriptionPlan) => {
    setSelectedPlanForCheckout(plan);
    setCheckoutSuccess(null);
  };

  const handleConfirmActivation = () => {
    if (!selectedPlanForCheckout) return;
    setIsProcessing(true);

    setTimeout(() => {
      const paymentLabel = selectedPlanForCheckout.isFree
        ? 'Free 1st Month Trial Activation'
        : paymentMethod === 'upi'
        ? `UPI (${upiId || 'partner@upi'})`
        : paymentMethod === 'card'
        ? 'Credit/Debit Card'
        : 'Net Banking';

      const updated = activateRestaurantSubscription(
        restaurant.id, 
        selectedPlanForCheckout.id, 
        paymentLabel
      );

      setIsProcessing(false);
      setCurrentSub(updated);
      setCheckoutSuccess(updated);

      if (onToast) {
        onToast(`🎉 Subscription Activated: ${selectedPlanForCheckout.name} for ${restaurant.name}!`);
      }
    }, 900);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150" id="section-subscription-plans">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-br from-[#2C3333] via-[#33423b] to-[#1e2424] text-white p-6 sm:p-8 rounded-3xl shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-[#4F6F52]/30 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4F6F52]/30 border border-[#4F6F52]/40 text-emerald-300 text-xs font-bold uppercase tracking-widest">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Restaurant Partner Memberships</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight">
            Partner Subscription Plans for {restaurant.name}
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
            Choose your flexible partner plan: <strong className="text-emerald-300">1st Month FREE</strong> to experience zero-risk table onboarding, then renew quarterly, half-yearly, or annually with guaranteed low partner rates.
          </p>
        </div>
      </div>

      {/* 2. Active Subscription Overview Card */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8E6E1] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-serif text-[#2C3333]">
                  Current Status: {currentSub.planName}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  currentSub.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {currentSub.status === 'active' ? 'Active Membership' : 'Renewal Due'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Venue ID: <code className="font-mono text-stone-700">{restaurant.id}</code> • Reference ID: <code className="font-mono text-stone-700">{currentSub.transactionId || 'FREE-TRIAL'}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Remaining Time</span>
              <span className="text-xl font-bold font-serif text-emerald-700">
                {currentSub.daysRemaining} Days
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
          <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1]">
            <span className="text-stone-500 block text-[10px] uppercase font-bold tracking-wider">Plan Duration</span>
            <span className="font-bold text-[#2C3333] text-sm mt-0.5 block">
              {currentSub.planId === 'free-month' ? '1st Month (30 Days)' : currentSub.planId === '3-months' ? '3 Months (90 Days)' : currentSub.planId === '6-months' ? '6 Months (180 Days)' : '12 Months (360 Days)'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1]">
            <span className="text-stone-500 block text-[10px] uppercase font-bold tracking-wider">Expiry / Next Billing</span>
            <span className="font-bold text-[#2C3333] text-sm mt-0.5 block">
              {new Date(currentSub.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1]">
            <span className="text-stone-500 block text-[10px] uppercase font-bold tracking-wider">Amount Paid</span>
            <span className="font-bold text-emerald-700 text-sm mt-0.5 block font-serif">
              {currentSub.amountPaid === 0 ? '₹0 (Free Trial Active)' : formatINR(currentSub.amountPaid)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. The 4 Official Subscription Plans Grid */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg sm:text-xl font-bold font-serif text-[#2C3333]">
            Select or Upgrade Your Partner Plan
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Transparent pricing with zero hidden fees, instant activation, and guaranteed priority table indexing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {RESTAURANT_SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrentPlan = currentSub.planId === plan.id;

            return (
              <div
                key={plan.id}
                className={`rounded-3xl border-2 transition-all p-5 flex flex-col justify-between relative bg-white ${
                  plan.isBestValue
                    ? 'border-amber-400 shadow-md ring-1 ring-amber-300'
                    : plan.isPopular
                    ? 'border-emerald-600 shadow-md ring-1 ring-emerald-500/30'
                    : 'border-[#E8E6E1] hover:border-[#4F6F52] hover:shadow-sm'
                }`}
                id={`card-plan-${plan.id}`}
              >
                {/* Top Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xs ${
                      plan.isBestValue
                        ? 'bg-amber-400 text-stone-950 border border-amber-500'
                        : plan.isPopular
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#2C3333] text-white'
                    }`}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="space-y-4 pt-1">
                  {/* Plan Name & Tagline */}
                  <div>
                    <h4 className="text-lg font-bold font-serif text-[#2C3333]">
                      {plan.name}
                    </h4>
                    <p className="text-xs text-stone-500 mt-1 min-h-[32px] leading-snug">
                      {plan.tagline}
                    </p>
                  </div>

                  {/* Pricing Display */}
                  <div className="py-3 border-y border-[#E8E6E1]/70">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold font-serif text-[#2C3333]">
                        {plan.isFree ? 'FREE' : `₹${plan.price}`}
                      </span>
                      {plan.regularPrice && !plan.isFree && (
                        <span className="text-sm font-semibold text-stone-600 line-through">
                          ₹{plan.regularPrice}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-stone-500 mt-0.5 block">
                      {plan.durationLabel}
                    </span>
                  </div>

                  {/* Feature Bullets */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                      Included Capabilities:
                    </span>
                    <ul className="space-y-2">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-[#2C3333]">
                          <Check className="w-3.5 h-3.5 text-[#4F6F52] shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="pt-6 mt-4 border-t border-[#E8E6E1]/60">
                  {isCurrentPlan ? (
                    <div className="w-full py-2.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Active Plan</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenCheckout(plan)}
                      className={`w-full py-3 px-4 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                        plan.isBestValue
                          ? 'bg-amber-400 hover:bg-amber-500 text-stone-950 font-black'
                          : plan.isPopular
                          ? 'bg-[#4F6F52] hover:bg-[#3D5A40] text-white shadow-md'
                          : 'bg-[#2C3333] hover:bg-[#4F6F52] text-white'
                      }`}
                      id={`btn-select-${plan.id}`}
                    >
                      <span>{plan.isFree ? 'Start 1st Month Free' : `Select ${plan.name} (₹${plan.price})`}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Plan Benefits Summary Banner */}
      <div className="bg-[#FAF9F6] p-6 rounded-3xl border border-[#E8E6E1] space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold font-serif text-[#2C3333]">
          <ShieldCheck className="w-5 h-5 text-[#4F6F52]" />
          <span>Flash Table Partner Guarantee & Transparent Policies</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-600">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div>
              <strong className="text-[#2C3333] block">1st Month 100% Free</strong>
              <span>No credit card required upfront. Full access to live tables, smart arrivals, and digital menu.</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div>
              <strong className="text-[#2C3333] block">Low Renewal Pricing</strong>
              <span>Renew anytime at ₹299 for 3 months, ₹599 for 6 months, or ₹1099 for a full year.</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div>
              <strong className="text-[#2C3333] block">Zero Commission on Dine-in</strong>
              <span>All diner bill payments go directly to your registered bank account or tableside UPI.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Interactive Checkout / Activation Modal */}
      {selectedPlanForCheckout && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          id="modal-subscription-checkout"
        >
          <div className="relative bg-white rounded-3xl border border-[#E8E6E1] shadow-2xl max-w-lg w-full overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-[#FAF9F6] p-5 sm:p-6 border-b border-[#E8E6E1] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#4F6F52]/10 text-[#4F6F52] flex items-center justify-center">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-serif text-[#2C3333]">
                    {selectedPlanForCheckout.isFree ? 'Activate Free Month Trial' : 'Confirm Subscription Plan'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {restaurant.name} • {selectedPlanForCheckout.durationLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlanForCheckout(null)}
                className="w-8 h-8 rounded-full border border-[#E8E6E1] bg-white hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 space-y-5">
              {checkoutSuccess ? (
                /* Success View */
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold font-serif text-[#2C3333]">
                      Subscription Activated!
                    </h4>
                    <p className="text-xs text-stone-600 mt-1">
                      {restaurant.name} is now active on <strong>{checkoutSuccess.planName}</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] text-left text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Reference / Transaction:</span>
                      <span className="font-mono font-bold text-[#2C3333]">{checkoutSuccess.transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Duration:</span>
                      <span className="font-bold text-[#2C3333]">{checkoutSuccess.daysRemaining} Days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Valid Until:</span>
                      <span className="font-bold text-[#2C3333]">
                        {new Date(checkoutSuccess.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#E8E6E1]">
                      <span className="text-stone-500">Amount Paid:</span>
                      <span className="font-bold text-emerald-700 font-serif">
                        {checkoutSuccess.amountPaid === 0 ? '₹0 (Free Trial)' : formatINR(checkoutSuccess.amountPaid)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedPlanForCheckout(null)}
                    className="w-full py-3 rounded-full bg-[#2C3333] hover:bg-[#4F6F52] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Return to Partner Console
                  </button>
                </div>
              ) : (
                /* Checkout Form View */
                <>
                  {/* Order Summary Box */}
                  <div className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600">Selected Plan:</span>
                      <span className="font-bold text-[#2C3333]">{selectedPlanForCheckout.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600">Validity Period:</span>
                      <span className="font-bold text-[#2C3333]">{selectedPlanForCheckout.durationLabel}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[#E8E6E1] text-sm">
                      <span className="font-bold text-[#2C3333]">Total Payable:</span>
                      <span className="font-extrabold font-serif text-emerald-700 text-lg">
                        {selectedPlanForCheckout.isFree ? '₹0 (FREE TRIAL)' : `₹${selectedPlanForCheckout.price}`}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method Selector (if non-free) */}
                  {!selectedPlanForCheckout.isFree && (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#2C3333]/80">
                        Select Payment Method:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('upi')}
                          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                            paymentMethod === 'upi'
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                              : 'border-[#E8E6E1] bg-white text-stone-600'
                          }`}
                        >
                          <QrCode className="w-5 h-5 mx-auto mb-1 text-emerald-700" />
                          <span className="text-xs block">UPI / GPay</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('card')}
                          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                            paymentMethod === 'card'
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                              : 'border-[#E8E6E1] bg-white text-stone-600'
                          }`}
                        >
                          <CreditCard className="w-5 h-5 mx-auto mb-1 text-emerald-700" />
                          <span className="text-xs block">Card</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('netbanking')}
                          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                            paymentMethod === 'netbanking'
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                              : 'border-[#E8E6E1] bg-white text-stone-600'
                          }`}
                        >
                          <Building2 className="w-5 h-5 mx-auto mb-1 text-emerald-700" />
                          <span className="text-xs block">NetBanking</span>
                        </button>
                      </div>

                      {paymentMethod === 'upi' && (
                        <div className="space-y-1">
                          <label className="text-[11px] text-stone-500 font-medium">Enter Virtual Payment Address (VPA / UPI ID):</label>
                          <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="restaurant@okaxis"
                            className="w-full px-3.5 py-2 rounded-xl border border-[#E8E6E1] bg-white text-xs text-[#2C3333] focus:outline-none focus:ring-1 focus:ring-emerald-600"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleConfirmActivation}
                    className="w-full py-3.5 rounded-full bg-[#4F6F52] hover:bg-[#3D5A40] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                    id="btn-confirm-subscription"
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>
                          {selectedPlanForCheckout.isFree 
                            ? 'Activate Free Month Now' 
                            : `Pay ₹${selectedPlanForCheckout.price} & Activate Subscription`}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
