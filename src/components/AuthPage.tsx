import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  User, 
  Phone, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  Armchair, 
  ArrowRight,
  Send,
  Compass,
  Store,
  Check,
  Building2,
  MapPin,
  Utensils,
  X
} from 'lucide-react';
import { AuthMode, LoginFormData, SignUpFormData, AuthValidationErrors, UserRole, Restaurant } from '../types';
import { 
  validateLoginForm, 
  validateSignUpForm, 
  submitSignIn, 
  submitSignUp, 
  submitPasswordReset,
  accessDemoRestaurant,
  getStoredSession,
  saveStoredSession
} from '../services/authService';
import { RESTAURANTS_DATA } from '../data/mockData';

interface AuthPageProps {
  initialMode?: AuthMode;
  onNavigateHome: () => void;
  onAuthSuccess: (
    userSummary?: { userId?: string; fullName?: string; email: string; mobileNumber?: string; phone?: string; restaurantId?: string },
    selectedRole?: UserRole
  ) => void;
  onModeChange?: (mode: AuthMode) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onNavigateHome,
  onAuthSuccess,
  onModeChange,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  
  // Form States
  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [signUpData, setSignUpData] = useState<SignUpFormData>({
    fullName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
  });

  // UI States
  const [errors, setErrors] = useState<AuthValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [demoLoading, setDemoLoading] = useState<'customer' | 'restaurant-owner' | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Role Selection State: 'customer' or 'restaurant-owner'
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  
  // Success redirect state
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotStatus, setForgotStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState<boolean>(false);

  // Demo Restaurant Access State (rest-1 to rest-10)
  const [demoRestaurantId, setDemoRestaurantId] = useState<string>('');
  const [demoRestaurantError, setDemoRestaurantError] = useState<string | null>(null);
  const [demoRestaurantLoading, setDemoRestaurantLoading] = useState<boolean>(false);

  // Restaurant Selection state for Rohan / Owner Login
  const [showRestaurantPicker, setShowRestaurantPicker] = useState<boolean>(false);
  const [pendingOwnerUser, setPendingOwnerUser] = useState<{
    userId?: string;
    fullName?: string;
    email: string;
    mobileNumber?: string;
    phone?: string;
    restaurantId?: string;
  } | null>(null);

  const handleSelectOwnerRestaurant = (restaurant: Restaurant) => {
    const finalSummary = {
      ...(pendingOwnerUser || { email: 'rohan@gmail.com', fullName: 'Rohan' }),
      restaurantId: restaurant.id,
    };

    const session = getStoredSession();
    if (session) {
      saveStoredSession({
        ...session,
        restaurantId: restaurant.id,
      });
    }

    setShowRestaurantPicker(false);
    onAuthSuccess(finalSummary, 'restaurant-owner');
  };

  // Switch between Login and Sign Up
  const handleSwitchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
    setTouched({});
    setSubmissionFeedback(null);
    if (onModeChange) onModeChange(newMode);
  };

  // Login input change
  const handleLoginChange = (field: keyof LoginFormData, value: string) => {
    setLoginData((prev) => ({ ...prev, [field]: value }));
    if (errors[field] || errors.general) {
      setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
    }
  };

  // Sign up input change
  const handleSignUpChange = (field: keyof SignUpFormData, value: string) => {
    setSignUpData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (mode === 'login') {
      const validation = validateLoginForm(loginData);
      setErrors((prev) => ({
        ...prev,
        [field]: validation[field as keyof AuthValidationErrors],
      }));
    } else {
      const validation = validateSignUpForm(signUpData);
      setErrors((prev) => ({
        ...prev,
        [field]: validation[field as keyof AuthValidationErrors],
      }));
    }
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionFeedback(null);

    if (mode === 'login') {
      const validationErrors = validateLoginForm(loginData);
      if (Object.keys(validationErrors).length > 0) {
        setErrors({
          ...validationErrors,
          general: 'Invalid email or password.',
        });
        setTouched({ email: true, password: true });
        setIsSubmitting(false);
        return;
      }

      try {
        const result = await submitSignIn(loginData, selectedRole);
        if (result.success) {
          setIsSubmitting(false);
          if (selectedRole === 'restaurant-owner' && !result.userSummary?.restaurantId) {
            setPendingOwnerUser(result.userSummary || {
              email: loginData.email,
              fullName: loginData.email.toLowerCase().includes('rohan') ? 'Rohan' : 'Restaurant Owner',
            });
            setShowRestaurantPicker(true);
            return;
          }
          onAuthSuccess(result.userSummary, selectedRole);
        } else {
          setErrors(result.errors || { general: result.message || 'Invalid email or password.' });
          setIsSubmitting(false);
        }
      } catch {
        setErrors({ general: 'Invalid email or password.' });
        setIsSubmitting(false);
      }
    } else {
      // Validate all required fields
      const validationErrors = validateSignUpForm(signUpData);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        setTouched({
          fullName: true,
          email: true,
          mobileNumber: true,
          password: true,
          confirmPassword: true,
        });
        setIsSubmitting(false);
        return;
      }

      try {
        const result = await submitSignUp(signUpData, selectedRole);
        if (result.success) {
          setIsSubmitting(false);
          onAuthSuccess(result.userSummary, selectedRole);
        } else {
          setErrors(result.errors || { general: result.message });
          setIsSubmitting(false);
        }
      } catch {
        setErrors({ general: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  };

  // Forgot password submit
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsForgotLoading(true);
    setForgotStatus(null);

    const res = await submitPasswordReset(forgotEmail);
    setIsForgotLoading(false);
    setForgotStatus(res);
  };

  // Quick Demo Access Login using the real live backend login API
  const handleDemoLogin = async (role: 'customer' | 'restaurant-owner') => {
    if (isSubmitting || demoLoading !== null) return;
    setDemoLoading(role);
    setErrors({});
    setSubmissionFeedback(null);

    const demoCredentials = role === 'customer'
      ? { email: 'sanket@gmail.com', password: 'sanket2006', role: 'customer' as UserRole }
      : { email: 'rohan@gmail.com', password: 'rohan2006', role: 'restaurant-owner' as UserRole };

    // Update input fields for visual continuity
    setLoginData({
      email: demoCredentials.email,
      password: demoCredentials.password,
    });
    setSelectedRole(demoCredentials.role);

    try {
      // Calls the same live backend authentication function
      const result = await submitSignIn(
        { email: demoCredentials.email, password: demoCredentials.password },
        demoCredentials.role
      );

      if (result.success) {
        setDemoLoading(null);
        if (demoCredentials.role === 'restaurant-owner') {
          setPendingOwnerUser(result.userSummary || {
            email: demoCredentials.email,
            fullName: 'Rohan',
          });
          setShowRestaurantPicker(true);
          return;
        }
        onAuthSuccess(result.userSummary, demoCredentials.role);
      } else {
        setErrors(result.errors || { general: result.message || 'Demo login failed. Please try again.' });
        setDemoLoading(null);
      }
    } catch {
      setErrors({ general: 'An unexpected authentication error occurred.' });
      setDemoLoading(null);
    }
  };

  // Demo Restaurant Access Handler for evaluating any of the 10 permanent partner restaurants
  const handleDemoRestaurantAccess = (idToUse?: string) => {
    if (isSubmitting || demoRestaurantLoading) return;
    const rawId = idToUse !== undefined ? idToUse : demoRestaurantId;
    const trimmedId = (rawId || '').trim();

    if (!trimmedId) {
      setDemoRestaurantError('Please enter a Restaurant ID (e.g. rest-2 or rest-10).');
      return;
    }

    setDemoRestaurantLoading(true);
    setDemoRestaurantError(null);

    const result = accessDemoRestaurant(trimmedId);
    setDemoRestaurantLoading(false);

    if (result.success && result.userSummary) {
      // Synchronize role state
      setSelectedRole('restaurant-owner');
      onAuthSuccess(result.userSummary, 'restaurant-owner');
    } else {
      setDemoRestaurantError(
        result.message || `Invalid Restaurant ID "${trimmedId}". Valid IDs are rest-1 through rest-10.`
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#2C3333] flex flex-col justify-between">
      
      {/* Top Navigation Bar */}
      <header className="border-b border-[#E8E6E1] bg-white/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo with Home Link */}
          <button 
            onClick={onNavigateHome}
            className="flex items-center gap-3 group text-left cursor-pointer focus:outline-none"
            id="auth-brand-logo-btn"
          >
            <div className="w-9 h-9 rounded-xl bg-[#4F6F52] flex items-center justify-center text-white shadow-sm group-hover:bg-[#3D5A40] transition-colors">
              <div className="relative flex items-center justify-center">
                <div className="w-3.5 h-3.5 border-2 border-white rounded-[3px] bg-white/10 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                <div className="absolute -top-1 w-2.5 h-0.5 bg-white/80 rounded-full" />
                <div className="absolute -bottom-1 w-2.5 h-0.5 bg-white/80 rounded-full" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#4F6F52] font-display flex items-center gap-1.5">
                Flash<span className="text-[#2C3333]">Table</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] px-1.5 py-0.5 bg-[#4F6F521A] text-[#4F6F52] rounded-sm">IN</span>
              </div>
            </div>
          </button>

          {/* Return to Home link */}
          <button
            onClick={onNavigateHome}
            className="text-xs font-semibold text-[#2C3333]/70 hover:text-[#4F6F52] flex items-center gap-2 py-2 px-3.5 rounded-full hover:bg-white border border-transparent hover:border-[#E8E6E1] transition-all cursor-pointer"
            id="auth-return-home-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Restaurants</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          
          {/* Main Form Column (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="bg-white rounded-3xl border border-[#E8E6E1] shadow-sm p-6 sm:p-10 md:p-12 relative overflow-hidden">
              
              {/* Subtle accent line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4F6F52] via-[#4F6F52]/60 to-[#FAF9F6]" />



                  {/* Mode switch tabs */}
                  <div className="flex items-center gap-2 p-1 bg-[#FAF9F6] border border-[#E8E6E1] rounded-full w-fit mb-8">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('login')}
                      className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        mode === 'login'
                          ? 'bg-white text-[#2C3333] shadow-xs'
                          : 'text-[#2C3333]/60 hover:text-[#2C3333]'
                      }`}
                      id="auth-tab-login"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('signup')}
                      className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        mode === 'signup'
                          ? 'bg-white text-[#2C3333] shadow-xs'
                          : 'text-[#2C3333]/60 hover:text-[#2C3333]'
                      }`}
                      id="auth-tab-signup"
                    >
                      Sign Up
                    </button>
                  </div>

              {/* Form Header */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-[#4F6F521A] text-[#4F6F52] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4F6F52]">
                    {mode === 'login' ? 'Diner Access' : 'New Member Registration'}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold font-serif text-[#2C3333] tracking-tight">
                  {mode === 'login' ? 'Welcome back' : 'Create your FlashTable account'}
                </h1>
                
                <p className="text-sm text-[#2C3333]/60 mt-2 font-sans">
                  {mode === 'login'
                    ? 'Sign in to continue your reservation.'
                    : 'Reserve exact tables, unlock smart arrival, and enjoy priority table alerts across Bengaluru.'}
                </p>
              </div>

              {/* Success / Status Banner */}
              {submissionFeedback && (
                <div className="mb-6 p-4 rounded-2xl bg-[#4F6F521A] border border-[#4F6F52]/30 flex items-center gap-3 text-xs font-semibold text-[#4F6F52] animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>{submissionFeedback.message}</span>
                </div>
              )}

              {/* General Error Banner */}
              {errors.general && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs font-semibold text-rose-700 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{errors.general}</span>
                </div>
              )}

              {/* ===================== LOGIN FORM ===================== */}
              {mode === 'login' && (
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
                  
                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <label 
                      htmlFor="login-email" 
                      className="block text-[11px] font-bold uppercase tracking-widest text-[#2C3333]/80"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2C3333]/40">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="login-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={loginData.email}
                        onChange={(e) => handleLoginChange('email', e.target.value)}
                        onBlur={() => handleBlur('email')}
                        placeholder="name@example.com"
                        className={`w-full pl-10 pr-4 py-3 bg-[#FAF9F6] border rounded-2xl text-xs sm:text-sm text-[#2C3333] outline-none transition-all placeholder:text-[#2C3333]/30 ${
                          errors.email
                            ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 ring-1 ring-rose-200'
                            : 'border-[#E8E6E1] focus:border-[#4F6F52] focus:bg-white focus:ring-1 focus:ring-[#4F6F52]/20'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.email}</span>
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label 
                        htmlFor="login-password" 
                        className="block text-[11px] font-bold uppercase tracking-widest text-[#2C3333]/80"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(loginData.email);
                          setForgotStatus(null);
                          setIsForgotModalOpen(true);
                        }}
                        className="text-xs text-[#4F6F52] hover:text-[#3D5A40] hover:underline font-medium cursor-pointer"
                        id="login-forgot-password-link"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2C3333]/40">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={loginData.password}
                        onChange={(e) => handleLoginChange('password', e.target.value)}
                        onBlur={() => handleBlur('password')}
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-11 py-3 bg-[#FAF9F6] border rounded-2xl text-xs sm:text-sm text-[#2C3333] outline-none transition-all placeholder:text-[#2C3333]/30 ${
                          errors.password
                            ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 ring-1 ring-rose-200'
                            : 'border-[#E8E6E1] focus:border-[#4F6F52] focus:bg-white focus:ring-1 focus:ring-[#4F6F52]/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#2C3333]/40 hover:text-[#2C3333] cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.password}</span>
                      </p>
                    )}
                  </div>

                  {/* Role selection: "How will you use FlashTable?" */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-[#2C3333]/80">
                        How will you use FlashTable?
                      </label>
                      <span className="text-[10px] text-[#2C3333]/50">Choose account type</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* CUSTOMER CARD */}
                      <div
                        id="role-login-customer"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedRole('customer');
                          if (errors.general) setErrors((prev) => ({ ...prev, general: undefined }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedRole('customer');
                            if (errors.general) setErrors((prev) => ({ ...prev, general: undefined }));
                          }
                        }}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all text-left flex flex-col justify-between ${
                          selectedRole === 'customer'
                            ? 'border-[#4F6F52] bg-[#4F6F520A] ring-2 ring-[#4F6F52]/20 shadow-xs'
                            : 'border-[#E8E6E1] bg-[#FAF9F6] hover:border-[#4F6F52]/40 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              selectedRole === 'customer' ? 'bg-[#4F6F52] text-white' : 'bg-[#4F6F521A] text-[#4F6F52]'
                            }`}>
                              <Compass className="w-4 h-4" />
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              selectedRole === 'customer' ? 'border-[#4F6F52] bg-[#4F6F52] text-white' : 'border-[#E8E6E1] bg-white'
                            }`}>
                              {selectedRole === 'customer' && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F6F52]">
                            Customer
                          </div>
                          <p className="text-xs text-[#2C3333]/80 mt-0.5 leading-snug">
                            Discover restaurants and reserve your perfect table.
                          </p>
                        </div>
                      </div>

                      {/* RESTAURANT OWNER CARD */}
                      <div
                        id="role-login-restaurant-owner"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedRole('restaurant-owner');
                          if (errors.general) setErrors((prev) => ({ ...prev, general: undefined }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedRole('restaurant-owner');
                            if (errors.general) setErrors((prev) => ({ ...prev, general: undefined }));
                          }
                        }}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all text-left flex flex-col justify-between ${
                          selectedRole === 'restaurant-owner'
                            ? 'border-[#4F6F52] bg-[#4F6F520A] ring-2 ring-[#4F6F52]/20 shadow-xs'
                            : 'border-[#E8E6E1] bg-[#FAF9F6] hover:border-[#4F6F52]/40 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              selectedRole === 'restaurant-owner' ? 'bg-[#4F6F52] text-white' : 'bg-[#4F6F521A] text-[#4F6F52]'
                            }`}>
                              <Store className="w-4 h-4" />
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              selectedRole === 'restaurant-owner' ? 'border-[#4F6F52] bg-[#4F6F52] text-white' : 'border-[#E8E6E1] bg-white'
                            }`}>
                              {selectedRole === 'restaurant-owner' && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F6F52]">
                            Restaurant Owner
                          </div>
                          <p className="text-xs text-[#2C3333]/80 mt-0.5 leading-snug">
                            Manage your restaurant, tables, reservations and guests.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Log In Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || demoLoading !== null}
                    className="w-full py-3.5 px-6 rounded-full bg-[#2C3333] hover:bg-[#4F6F52] text-white text-xs font-bold uppercase tracking-widest transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-3"
                    id="login-submit-btn"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Log In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Toggle to Sign Up */}
                  <div className="text-center pt-3 text-xs text-[#2C3333]/70">
                    <span>Don't have an account? </span>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('signup')}
                      className="font-bold text-[#4F6F52] hover:text-[#3D5A40] hover:underline cursor-pointer"
                      id="link-to-signup"
                    >
                      Sign up
                    </button>
                  </div>

                  {/* Demo Restaurant Access: Clearly separated on Restaurant Owner Login */}
                  {selectedRole === 'restaurant-owner' && (
                    <div 
                      id="section-demo-restaurant-access"
                      className="mt-6 pt-5 pb-5 px-4 sm:px-5 rounded-2xl bg-[#FAF9F6] border border-[#E8E6E1] shadow-2xs space-y-3.5 animate-in fade-in duration-200"
                    >
                      <div className="flex items-center justify-between border-b border-[#E8E6E1]/70 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[#4F6F52] text-white flex items-center justify-center">
                            <Store className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#2C3333]">
                            Demo Restaurant Access
                          </span>
                        </div>
                        <span className="text-[10px] font-bold tracking-wider text-[#4F6F52] bg-[#4F6F521A] px-2 py-0.5 rounded-full uppercase">
                          rest-1 to rest-10
                        </span>
                      </div>

                      <p className="text-xs text-[#2C3333]/70 leading-relaxed">
                        Instant partner console evaluation: Enter any valid Restaurant ID (from <span className="font-semibold text-[#2C3333]">rest-1</span> to <span className="font-semibold text-[#2C3333]">rest-10</span>) to open that venue's complete dashboard.
                      </p>

                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <input
                              id="demo-restaurant-id-input"
                              type="text"
                              value={demoRestaurantId}
                              onChange={(e) => {
                                setDemoRestaurantId(e.target.value);
                                setDemoRestaurantError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleDemoRestaurantAccess();
                                }
                              }}
                              placeholder="Restaurant ID (e.g. rest-2 or rest-10)"
                              className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs text-[#2C3333] font-mono outline-none transition-all placeholder:font-sans placeholder:text-[#2C3333]/30 ${
                                demoRestaurantError
                                  ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-200'
                                  : 'border-[#E8E6E1] focus:border-[#4F6F52] focus:ring-1 focus:ring-[#4F6F52]/20'
                              }`}
                            />
                          </div>

                          <button
                            type="button"
                            id="demo-restaurant-access-btn"
                            disabled={demoRestaurantLoading}
                            onClick={() => handleDemoRestaurantAccess()}
                            className="px-5 py-2.5 rounded-xl bg-[#4F6F52] hover:bg-[#3D5A40] text-white text-xs font-bold uppercase tracking-wider transition-all duration-150 shadow-2xs hover:shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                          >
                            {demoRestaurantLoading ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <span>Access / Continue</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </div>

                        {/* Clear error message if invalid ID */}
                        {demoRestaurantError && (
                          <div
                            id="demo-restaurant-error-msg"
                            className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs font-medium text-rose-700 animate-in fade-in"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                            <span className="leading-snug">{demoRestaurantError}</span>
                          </div>
                        )}
                      </div>

                      {/* Quick selectable test chips for the 10 permanent partner restaurants */}
                      <div className="pt-2 border-t border-[#E8E6E1]/70">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#2C3333]/50 mb-1.5 flex items-center justify-between">
                          <span>Quick Test IDs:</span>
                          <span className="text-[9px] font-normal text-[#2C3333]/40">Click any ID to populate</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {RESTAURANTS_DATA.map((r) => {
                            const isSelected = demoRestaurantId.trim().toLowerCase() === r.id.toLowerCase();
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setDemoRestaurantId(r.id);
                                  setDemoRestaurantError(null);
                                  handleDemoRestaurantAccess(r.id);
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#4F6F52] text-white border-[#4F6F52] font-bold shadow-2xs'
                                    : 'bg-white hover:bg-[#4F6F521A] text-[#2C3333]/80 border-[#E8E6E1]'
                                }`}
                                title={`Instant Access: ${r.id} (${r.name} · ${r.neighborhood})`}
                              >
                                {r.id}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Demo Access for SIH Presentation */}
                  <div className="mt-5 pt-4 border-t border-[#E8E6E1]" id="section-quick-demo-access">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2C3333]/70">
                        <Sparkles className="w-3.5 h-3.5 text-[#4F6F52]" />
                        <span>Quick Demo Access</span>
                      </div>
                      <span className="text-[10px] font-semibold text-[#4F6F52] bg-[#4F6F521A] px-2 py-0.5 rounded-full">
                        SIH Presentation
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Customer Demo Button */}
                      <button
                        type="button"
                        id="btn-demo-login-sanketh"
                        disabled={isSubmitting || demoLoading !== null}
                        onClick={() => handleDemoLogin('customer')}
                        className="w-full py-2.5 px-3.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F6] hover:bg-white hover:border-[#4F6F52]/60 text-[#2C3333] transition-all flex items-center justify-between text-xs group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-[#4F6F521A] text-[#4F6F52] flex items-center justify-center shrink-0">
                            <Compass className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-left truncate">
                            <div className="font-semibold text-[#2C3333] text-xs">Login as Sanketh</div>
                            <div className="text-[10px] text-[#2C3333]/50">Customer</div>
                          </div>
                        </div>
                        {demoLoading === 'customer' ? (
                          <div className="w-3.5 h-3.5 border-2 border-[#4F6F52]/30 border-t-[#4F6F52] rounded-full animate-spin shrink-0 ml-1" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5 text-[#2C3333]/30 group-hover:text-[#4F6F52] group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                        )}
                      </button>

                      {/* Restaurant Owner Demo Button */}
                      <button
                        type="button"
                        id="btn-demo-login-rohan"
                        disabled={isSubmitting || demoLoading !== null}
                        onClick={() => handleDemoLogin('restaurant-owner')}
                        className="w-full py-2.5 px-3.5 rounded-xl border border-[#E8E6E1] bg-[#FAF9F6] hover:bg-white hover:border-[#4F6F52]/60 text-[#2C3333] transition-all flex items-center justify-between text-xs group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-[#4F6F521A] text-[#4F6F52] flex items-center justify-center shrink-0">
                            <Store className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-left truncate">
                            <div className="font-semibold text-[#2C3333] text-xs">Login as Rohan</div>
                            <div className="text-[10px] text-[#2C3333]/50">Restaurant Owner</div>
                          </div>
                        </div>
                        {demoLoading === 'restaurant-owner' ? (
                          <div className="w-3.5 h-3.5 border-2 border-[#4F6F52]/30 border-t-[#4F6F52] rounded-full animate-spin shrink-0 ml-1" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5 text-[#2C3333]/30 group-hover:text-[#4F6F52] group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
                        )}
                      </button>
                    </div>
                  </div>

                </form>
              )}

              {/* ===================== SIGN UP FORM ===================== */}
              {mode === 'signup' && (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  
                  {/* Full Name Field */}
                  <div className="space-y-1.5">
                    <label 
                      htmlFor="signup-fullname" 
                      className="block text-[11px] font-bold uppercase tracking-widest text-[#2C3333]/80"
                    >
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2C3333]/40">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="signup-fullname"
                        name="fullName"
                        type="text"
                        autoComplete="name"
                        value={signUpData.fullName}
                        onChange={(e) => handleSignUpChange('fullName', e.target.value)}
                        onBlur={() => handleBlur('fullName')}
                        placeholder="e.g. Sanketh Sharma"
                        className={`w-full pl-10 pr-4 py-3 bg-[#FAF9F6] border rounded-2xl text-xs sm:text-sm text-[#2C3333] outline-none transition-all placeholder:text-[#2C3333]/30 ${
                          errors.fullName
                            ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 ring-1 ring-rose-200'
                            : 'border-[#E8E6E1] focus:border-[#4F6F52] focus:bg-white focus:ring-1 focus:ring-[#4F6F52]/20'
                        }`}
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.fullName}</span>
                      </p>
                    )}
                  </div>

                  {/* Email Field */}
                  <div className="space-y-1.5">
                    <label 
                      htmlFor="signup-email" 
                      className="block text-[11px] font-bold uppercase tracking-widest text-[#2C3333]/80"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2C3333]/40">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="signup-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={signUpData.email}
                        onChange={(e) => handleSignUpChange('email', e.target.value)}
                        onBlur={() => handleBlur('email')}
                        placeholder="name@example.com"
                        className={`w-full pl-10 pr-4 py-3 bg-[#FAF9F6] border rounded-2xl text-xs sm:text-sm text-[#2C3333] outline-none transition-all placeholder:text-[#2C3333]/30 ${
                          errors.email
                            ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 ring-1 ring-rose-200'
                            : 'border-[#E8E6E1] focus:border-[#4F6F52] focus:bg-white focus:ring-1 focus:ring-[#4F6F52]/20'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.email}</span>
                      </p>
                    )}
                  </div>

                  {/* Indian Mobile Number */}
                  <div className="space-y-1.5">
                    <label 
                      htmlFor="signup-mobile" 
                      className="block text-[11px] font-bold uppercase tracking-widest text-[#2C3333]/80"
                    >
                      Indian Mobile Number
                    </label>
                    <div className={`flex rounded-2xl border bg-[#FAF9F6] overflow-hidden transition-all ${
                      errors.mobileNumber
                        ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-200'
                        : 'border-[#E8E6E1] focus-within:border-[#4F6F52] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#4F6F52]/20'
                    }`}>
                      <span className="px-3.5 py-3 text-xs font-semibold text-[#2C3333]/70 border-r border-[#E8E6E1] bg-[#FAF9F6] flex items-center gap-1 select-none">
                        <Phone className="w-3.5 h-3.5 text-[#4F6F52]" />
                        <span>+91</span>
                      </span>
                      <input
                        id="signup-mobile"
                        name="mobileNumber"
                        type="tel"
                        maxLength={15}
                        value={signUpData.mobileNumber}
                        onChange={(e) => handleSignUpChange('mobileNumber', e.target.value)}
                        onBlur={() => handleBlur('mobileNumber')}
                        placeholder="98450 12260"
                        className="w-full px-3.5 py-3 text-xs sm:text-sm bg-transparent text-[#2C3333] outline-none placeholder:text-[#2C3333]/30"
                      />
                    </div>
                    {errors.mobileNumber ? (
                      <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.mobileNumber}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-[#2C3333]/50">Used for instant table readiness SMS and QR check-in boarding passes.</p>
                    )}
                  </div>

                  {/* Password & Confirm Password Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Password */}
                    <div className="space-y-1.5">
                      <label 
                        htmlFor="signup-password" 
                        className="block text-[11px] font-bold uppercase tracking-widest text-[#2C3333]/80"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2C3333]/40">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="signup-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={signUpData.password}
                          onChange={(e) => handleSignUpChange('password', e.target.value)}
                          onBlur={() => handleBlur('password')}
                          placeholder="Min. 6 chars"
                          className={`w-full pl-10 pr-10 py-3 bg-[#FAF9F6] border rounded-2xl text-xs sm:text-sm text-[#2C3333] outline-none transition-all placeholder:text-[#2C3333]/30 ${
                            errors.password
                              ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 ring-1 ring-rose-200'
                              : 'border-[#E8E6E1] focus:border-[#4F6F52] focus:bg-white focus:ring-1 focus:ring-[#4F6F52]/20'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#2C3333]/40 hover:text-[#2C3333] cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.password}</span>
                        </p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label 
                        htmlFor="signup-confirm-password" 
                        className="block text-[11px] font-bold uppercase tracking-widest text-[#2C3333]/80"
                      >
                        Confirm Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2C3333]/40">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="signup-confirm-password"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={signUpData.confirmPassword}
                          onChange={(e) => handleSignUpChange('confirmPassword', e.target.value)}
                          onBlur={() => handleBlur('confirmPassword')}
                          placeholder="Re-enter password"
                          className={`w-full pl-10 pr-10 py-3 bg-[#FAF9F6] border rounded-2xl text-xs sm:text-sm text-[#2C3333] outline-none transition-all placeholder:text-[#2C3333]/30 ${
                            errors.confirmPassword
                              ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 ring-1 ring-rose-200'
                              : 'border-[#E8E6E1] focus:border-[#4F6F52] focus:bg-white focus:ring-1 focus:ring-[#4F6F52]/20'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#2C3333]/40 hover:text-[#2C3333] cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{errors.confirmPassword}</span>
                        </p>
                      )}
                    </div>

                  </div>

                  {/* Role selection: "How will you use FlashTable?" */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-widest text-[#2C3333]/80">
                        How will you use FlashTable?
                      </label>
                      <span className="text-[10px] text-[#2C3333]/50">Choose account type</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* CUSTOMER CARD */}
                      <div
                        id="role-signup-customer"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRole('customer')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedRole('customer'); }}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all text-left flex flex-col justify-between ${
                          selectedRole === 'customer'
                            ? 'border-[#4F6F52] bg-[#4F6F520A] ring-2 ring-[#4F6F52]/20 shadow-xs'
                            : 'border-[#E8E6E1] bg-[#FAF9F6] hover:border-[#4F6F52]/40 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              selectedRole === 'customer' ? 'bg-[#4F6F52] text-white' : 'bg-[#4F6F521A] text-[#4F6F52]'
                            }`}>
                              <Compass className="w-4 h-4" />
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              selectedRole === 'customer' ? 'border-[#4F6F52] bg-[#4F6F52] text-white' : 'border-[#E8E6E1] bg-white'
                            }`}>
                              {selectedRole === 'customer' && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F6F52]">
                            Customer
                          </div>
                          <p className="text-xs text-[#2C3333]/80 mt-0.5 leading-snug">
                            Discover restaurants and reserve your perfect table.
                          </p>
                        </div>
                      </div>

                      {/* RESTAURANT OWNER CARD */}
                      <div
                        id="role-signup-restaurant-owner"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRole('restaurant-owner')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedRole('restaurant-owner'); }}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all text-left flex flex-col justify-between ${
                          selectedRole === 'restaurant-owner'
                            ? 'border-[#4F6F52] bg-[#4F6F520A] ring-2 ring-[#4F6F52]/20 shadow-xs'
                            : 'border-[#E8E6E1] bg-[#FAF9F6] hover:border-[#4F6F52]/40 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              selectedRole === 'restaurant-owner' ? 'bg-[#4F6F52] text-white' : 'bg-[#4F6F521A] text-[#4F6F52]'
                            }`}>
                              <Store className="w-4 h-4" />
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              selectedRole === 'restaurant-owner' ? 'border-[#4F6F52] bg-[#4F6F52] text-white' : 'border-[#E8E6E1] bg-white'
                            }`}>
                              {selectedRole === 'restaurant-owner' && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F6F52]">
                            Restaurant Owner
                          </div>
                          <p className="text-xs text-[#2C3333]/80 mt-0.5 leading-snug">
                            Manage your restaurant, tables, reservations and guests.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Create Account Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-full bg-[#2C3333] hover:bg-[#4F6F52] text-white text-xs font-bold uppercase tracking-widest transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-3"
                    id="signup-submit-btn"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Toggle to Sign In */}
                  <div className="text-center pt-3 text-xs text-[#2C3333]/70">
                    <span>Already have an account? </span>
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('login')}
                      className="font-bold text-[#4F6F52] hover:text-[#3D5A40] hover:underline cursor-pointer"
                      id="link-to-signin"
                    >
                      Sign in
                    </button>
                  </div>

                </form>
              )}

              {/* Data & Persistence Architecture Notice */}
              <div className="mt-8 pt-5 border-t border-[#E8E6E1] text-[11px] text-[#2C3333]/50 flex items-center justify-between">
                <span>Structured for persistent authentication gateway.</span>
                <span className="flex items-center gap-1 text-[#4F6F52] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Zero-Spam Privacy</span>
                </span>
              </div>

            </div>
          </div>

          {/* Premium Restaurant Visual Column (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="relative rounded-3xl border border-[#E8E6E1] shadow-sm overflow-hidden min-h-[460px] lg:min-h-[580px] flex flex-col justify-end p-6 sm:p-8 md:p-10 group">
              
              {/* Background Restaurant Image */}
              <img
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
                alt="Fine dining architectural seating in Bengaluru"
                className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />

              {/* Refined gradient overlay for readability & warmth */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#2C3333]/95 via-[#2C3333]/50 to-transparent" />
              <div className="absolute inset-0 bg-[#4F6F52]/10 mix-blend-multiply pointer-events-none" />

              {/* Content overlay */}
              <div className="relative z-10 text-white space-y-4">
                
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-[0.2em] border border-white/20">
                  <Armchair className="w-3.5 h-3.5" />
                  <span>The FlashTable Standard</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold font-serif leading-tight">
                  Reserve the exact table you desire. Dine with absolute certainty.
                </h2>

                <p className="text-xs text-white/80 leading-relaxed font-sans">
                  From intimate garden courtyard tables in Lavelle Road to prime balcony corners in Indiranagar, FlashTable eliminates table guesswork.
                </p>

                {/* Editorial Feature Highlights */}
                <div className="pt-2 space-y-2.5 border-t border-white/20 text-xs text-white/90">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4F6F52]" />
                    <span>Real-time 2D architectural seating blueprints</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4F6F52]" />
                    <span>Zero-wait host podium check-in boarding passes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4F6F52]" />
                    <span>Instant vacancy SMS alerts for high-demand dinner slots</span>
                  </div>
                </div>

                {/* Subtle trust badge */}
                <div className="pt-2 flex items-center justify-between text-[11px] text-white/70">
                  <span>Bengaluru Culinary Network</span>
                  <span className="font-semibold text-white">Indiranagar • Lavelle Rd • Koramangala</span>
                </div>

              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            className="bg-white w-full max-w-md rounded-3xl border border-[#E8E6E1] shadow-2xl p-7 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#4F6F521A] text-[#4F6F52] flex items-center justify-center border border-[#4F6F52]/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-serif text-[#2C3333]">
                  Reset Password
                </h3>
                <p className="text-xs text-[#2C3333]/60">
                  Enter your email to receive recovery instructions
                </p>
              </div>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#2C3333]/70">
                  Registered Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#2C3333]/40">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F6] border border-[#E8E6E1] rounded-2xl text-xs sm:text-sm text-[#2C3333] outline-none focus:border-[#4F6F52]"
                  />
                </div>
              </div>

              {forgotStatus && (
                <div className={`p-3.5 rounded-2xl text-xs font-semibold ${
                  forgotStatus.success
                    ? 'bg-[#4F6F521A] text-[#4F6F52] border border-[#4F6F52]/20'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {forgotStatus.message}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full bg-[#FAF9F6] hover:bg-[#F2EFE9] text-[#2C3333] text-xs font-bold uppercase tracking-widest border border-[#E8E6E1] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className="flex-1 py-2.5 rounded-full bg-[#2C3333] hover:bg-[#4F6F52] text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isForgotLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Link</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Select Restaurant Modal for Restaurant Owner / Rohan */}
      {showRestaurantPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#E8E6E1] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#E8E6E1] bg-[#FAF9F6] flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#4F6F521A] text-[#4F6F52] flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-serif text-[#2C3333]">
                    Select Restaurant
                  </h3>
                  <p className="text-xs text-[#2C3333]/70">
                    Choose the restaurant venue you would like to manage for this session
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {pendingOwnerUser && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E8E6E1] text-[11px] font-medium text-[#2C3333]/80">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{pendingOwnerUser.fullName || 'Owner'}</span>
                    <span className="text-[#2C3333]/40 font-mono text-[10px]">({pendingOwnerUser.email})</span>
                  </div>
                )}
                <button
                  onClick={() => setShowRestaurantPicker(false)}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                  title="Cancel and return to login"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - 10 Restaurants List */}
            <div className="p-6 overflow-y-auto max-h-[65vh] space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
              {RESTAURANTS_DATA.map((restaurant) => (
                <button
                  key={restaurant.id}
                  onClick={() => handleSelectOwnerRestaurant(restaurant)}
                  className="group relative flex items-center gap-3.5 p-3.5 rounded-2xl border border-[#E8E6E1] hover:border-[#4F6F52] hover:bg-[#FAF9F6] hover:shadow-md transition-all cursor-pointer text-left bg-white w-full"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-stone-100 relative">
                    <img
                      src={restaurant.heroImage}
                      alt={restaurant.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                        {restaurant.id}
                      </span>
                      <span className="text-[11px] text-stone-400 font-medium truncate">
                        {restaurant.cuisines?.join(' • ') || 'Multi-Cuisine'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-[#2C3333] group-hover:text-[#4F6F52] transition-colors truncate">
                      {restaurant.name}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                      <span className="truncate">{restaurant.neighborhood}</span>
                      <span className="mx-1 text-stone-300">•</span>
                      <span>{restaurant.tables?.length || 10} tables</span>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-stone-100 group-hover:bg-[#4F6F52] group-hover:text-white flex items-center justify-center shrink-0 transition-colors text-stone-400">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-[#E8E6E1] bg-[#FAF9F6] flex items-center justify-between text-xs text-stone-500">
              <span>Clicking a venue locks the dashboard context to that restaurant.</span>
              <button
                type="button"
                onClick={() => setShowRestaurantPicker(false)}
                className="px-4 py-1.5 rounded-full hover:bg-stone-200/60 font-semibold text-stone-600 transition-colors cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtle Page Footer */}
      <footer className="py-6 border-t border-[#E8E6E1] text-center text-xs text-[#2C3333]/50">
        <p>© 2026 FlashTable Technologies India Pvt. Ltd. • Indiranagar, Bengaluru</p>
      </footer>

    </div>
  );
};
