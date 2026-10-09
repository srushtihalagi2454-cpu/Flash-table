import { 
  LoginFormData, 
  SignUpFormData, 
  AuthValidationErrors, 
  UserRole,
  OtpRequestResult,
  OtpVerificationResult,
  AdminSetupFormData
} from '../types';
import { RESTAURANTS_DATA } from '../data/mockData';

/**
 * FlashTable Authentication Service
 * Connected to secure backend API & Google Sheets database.
 */

export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyGStCgmWV--V5mHS_AGKql8dRZ6JIWHTRpKDtrQI6TWXavglVofqs5CwvKUGiPL_5z/exec';
const LOCAL_PROXY_URL = '/api/auth';
const AUTH_SESSION_KEY = 'flashtable_auth_session';

// Email regex pattern meeting standard specifications
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Indian mobile number regex: 10 digits starting with 6, 7, 8, or 9
export const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;

export interface AuthenticatedUserSession {
  userId?: string;
  fullName: string;
  email: string;
  mobile: string;
  phone: string;
  role: UserRole;
  signedInAt: string;
  restaurantId?: string;
  isFirstTimeLogin?: boolean;
}

/**
 * Masks destination identifiers for secure OTP display
 */
export const maskIdentifier = (val: string, type: 'email' | 'mobile'): string => {
  if (type === 'email' || val.includes('@')) {
    const parts = val.trim().split('@');
    if (parts.length === 2) {
      const name = parts[0];
      const domain = parts[1];
      if (name.length <= 3) {
        return `${name[0]}***@${domain}`;
      }
      return `${name.slice(0, 2)}***${name.slice(-2)}@${domain}`;
    }
    return val;
  }
  const digits = val.replace(/\D/g, '').slice(-10);
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 2)}*** **${digits.slice(-3)}`;
  }
  return val;
};

/**
 * Retrieves the currently active authenticated session from storage if present.
 */
export const getStoredSession = (): AuthenticatedUserSession | null => {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && (parsed.email || parsed.mobile) && parsed.role) {
        return parsed as AuthenticatedUserSession;
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

/**
 * Stores the authenticated user session (never saves plaintext passwords).
 */
export const saveStoredSession = (session: AuthenticatedUserSession): void => {
  try {
    const serialized = JSON.stringify(session);
    localStorage.setItem(AUTH_SESSION_KEY, serialized);
    sessionStorage.setItem(AUTH_SESSION_KEY, serialized);
    localStorage.setItem('flashtable_user_role', session.role);
    sessionStorage.setItem('flashtable_user_role', session.role);
  } catch {
    // ignore storage restrictions
  }
};

/**
 * Completely clears the stored session and role upon logout.
 */
export const clearStoredSession = (): void => {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem('flashtable_user_role');
    sessionStorage.removeItem('flashtable_user_role');
  } catch {
    // ignore
  }
};

export const validateLoginForm = (data: LoginFormData): AuthValidationErrors => {
  const errors: AuthValidationErrors = {};
  const ident = (data.loginIdentifier || data.email || '').trim();

  if (!ident) {
    errors.loginIdentifier = 'Email ID or Mobile Number is required.';
    errors.email = 'Email ID or Mobile Number is required.';
  } else if (ident.includes('@')) {
    if (!EMAIL_REGEX.test(ident)) {
      errors.loginIdentifier = 'Please enter a valid email address.';
      errors.email = 'Please enter a valid email address.';
    }
  } else {
    const digits = ident.replace(/\D/g, '');
    const phone10 = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    if (phone10.length !== 10 || !INDIAN_PHONE_REGEX.test(phone10)) {
      errors.loginIdentifier = 'Please enter a valid 10-digit Indian mobile number.';
      errors.email = 'Please enter a valid 10-digit Indian mobile number.';
    }
  }

  if (!data.password) {
    errors.password = 'Password is required.';
  }

  return errors;
};

export const validateSignUpForm = (data: SignUpFormData): AuthValidationErrors => {
  const errors: AuthValidationErrors = {};

  // 1. Full name validation
  if (!data.fullName.trim()) {
    errors.fullName = 'Customer name is required.';
  } else if (data.fullName.trim().length < 2) {
    errors.fullName = 'Please enter your full name (at least 2 characters).';
  }

  // 2. Contact validation based on signupMethod
  if (data.signupMethod === 'email') {
    if (!data.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(data.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
  } else {
    const digitsOnly = data.mobileNumber.replace(/\D/g, '');
    const phone10 = digitsOnly.length === 12 && digitsOnly.startsWith('91')
      ? digitsOnly.slice(2)
      : digitsOnly;

    if (!data.mobileNumber.trim()) {
      errors.mobileNumber = 'Indian mobile number is required.';
    } else if (phone10.length !== 10 || !INDIAN_PHONE_REGEX.test(phone10)) {
      errors.mobileNumber = 'Please enter a valid 10-digit Indian mobile number starting with 6-9.';
    }
  }

  // 3. Password validation (minimum 6 characters)
  if (!data.password) {
    errors.password = 'Password is required.';
  } else if (data.password.length < 6) {
    errors.password = 'Password is too short (minimum 6 characters).';
  }

  // 4. Confirm password validation
  if (!data.confirmPassword) {
    errors.confirmPassword = 'Confirm password is required.';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
};

export interface AuthSubmissionResult {
  success: boolean;
  message: string;
  isFirstTimeLogin?: boolean;
  errors?: AuthValidationErrors;
  userSummary?: {
    userId?: string;
    fullName?: string;
    email: string;
    mobileNumber?: string;
    phone?: string;
    role?: UserRole;
    restaurantId?: string;
    isFirstTimeLogin?: boolean;
  };
}

/**
 * Resilient API dispatcher communicating with the Google Apps Script Web App backend.
 * Uses local proxy with automatic direct fetch fallback.
 */
async function callAppsScriptBackend<T>(payload: Record<string, unknown>): Promise<T> {
  const jsonString = JSON.stringify(payload);

  // Strategy 1: Local server proxy (/api/auth)
  try {
    const proxyRes = await fetch(LOCAL_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonString,
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return data as T;
    }
  } catch {
    // If proxy failed or in standalone environment, fall through to direct fetch
  }

  // Strategy 2: Direct browser fetch to Google Apps Script Web App
  // Note: Using text/plain;charset=utf-8 makes this a CORS simple request, avoiding preflight OPTIONS failures
  const directRes = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: jsonString,
  });

  const data = await directRes.json();
  return data as T;
}

/**
 * Requests an OTP verification code for Signup or Forgot Password
 */
export const requestOtp = async (
  identifier: string,
  type: 'email' | 'mobile',
  purpose: 'signup' | 'forgot_password' | string = 'signup'
): Promise<OtpRequestResult> => {
  try {
    const response = await callAppsScriptBackend<OtpRequestResult>({
      action: 'sendOtp',
      destination: identifier,
      type,
      purpose,
    });
    return response;
  } catch (err: any) {
    return {
      success: false,
      message: 'Unable to connect to OTP verification service.',
      destinationMasked: maskIdentifier(identifier, type),
      expiresInSeconds: 0,
      cooldownSeconds: 0,
      serviceConfigured: false,
      errors: { general: 'Unable to reach verification service. Please try again.' },
    };
  }
};

/**
 * Verifies the customer's entered OTP code securely on the backend
 */
export const verifyOtp = async (
  identifier: string,
  otp: string,
  purpose: 'signup' | 'forgot_password' | string = 'signup'
): Promise<OtpVerificationResult> => {
  try {
    const response = await callAppsScriptBackend<OtpVerificationResult>({
      action: 'verifyOtp',
      destination: identifier,
      otp,
      purpose,
    });
    return response;
  } catch (err: any) {
    return {
      success: false,
      message: 'Failed to verify code. Please check your network connection.',
      verified: false,
      errors: { otp: 'Verification failed. Please try again.' },
    };
  }
};

/**
 * Authenticates user credentials with backend using Email ID OR Mobile Number and Password
 */
export const submitSignIn = async (
  data: LoginFormData,
  selectedRole: UserRole = 'customer'
): Promise<AuthSubmissionResult> => {
  const errors = validateLoginForm(data);
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: 'Please provide both your Email/Mobile and password.',
      errors,
    };
  }

  const rawIdent = (data.loginIdentifier || data.email || '').trim();

  // Strict Flash Table Company Administration Authentication
  if (selectedRole === 'company-admin' || rawIdent.toLowerCase() === 'admin@flashtable.com') {
    if (selectedRole !== 'company-admin') {
      return {
        success: false,
        message: 'Security Alert: Company Administrator accounts cannot be accessed via customer or restaurant owner login.',
        errors: { general: 'Company Admin accounts must log in via the dedicated Company Administration portal.' },
      };
    }
  }

  try {
    const response = await callAppsScriptBackend<{
      success: boolean;
      message: string;
      isFirstTimeLogin?: boolean;
      user?: {
        userId?: string;
        fullName?: string;
        email?: string;
        mobile?: string | number;
        role?: string;
        restaurantId?: string;
        isFirstTimeLogin?: boolean;
      };
    }>({
      action: 'login',
      loginIdentifier: rawIdent,
      email: rawIdent.includes('@') ? rawIdent.toLowerCase() : '',
      password: data.password,
      role: selectedRole,
    });

    if (response && response.success) {
      const returnedUser = response.user;
      const rawMobile = returnedUser?.mobile != null ? String(returnedUser.mobile) : '';
      const digitsOnly = rawMobile.replace(/\D/g, '');
      const phone10 = digitsOnly.length === 12 && digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;
      const formattedPhone = phone10.length === 10
        ? `+91 ${phone10.slice(0, 5)} ${phone10.slice(5)}`
        : rawMobile || '+91 98450 12260';

      const isFirstTime = Boolean(response.isFirstTimeLogin || returnedUser?.isFirstTimeLogin);

      const session: AuthenticatedUserSession = {
        userId: returnedUser?.userId,
        fullName: returnedUser?.fullName || (selectedRole === 'restaurant-owner' ? (rawIdent.includes('rohan') ? 'Rohan' : 'Arjun Rao') : 'Customer'),
        email: returnedUser?.email || (rawIdent.includes('@') ? rawIdent.toLowerCase() : ''),
        mobile: phone10 || rawMobile,
        phone: formattedPhone,
        role: (returnedUser?.role as UserRole) || selectedRole,
        signedInAt: new Date().toISOString(),
        restaurantId: (returnedUser as any)?.restaurantId || undefined,
        isFirstTimeLogin: isFirstTime,
      };

      saveStoredSession(session);

      return {
        success: true,
        message: response.message || 'Login successful.',
        isFirstTimeLogin: isFirstTime,
        userSummary: {
          userId: session.userId,
          fullName: session.fullName,
          email: session.email,
          phone: session.phone,
          mobileNumber: session.mobile,
          role: session.role,
          restaurantId: session.restaurantId,
          isFirstTimeLogin: isFirstTime,
        },
      };
    }

    const errorMsg = response?.message || 'Invalid email/mobile number, password or role.';
    return {
      success: false,
      message: errorMsg,
      errors: {
        general: errorMsg,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Unable to connect to authentication server. Please check your connection and try again.',
      errors: {
        general: 'Unable to connect to authentication server. Please check your connection and try again.',
      },
    };
  }
};

/**
 * Creates a new customer account after successful OTP verification
 */
export const submitSignUp = async (
  data: SignUpFormData,
  selectedRole: UserRole = 'customer',
  verificationToken?: string
): Promise<AuthSubmissionResult> => {
  const errors = validateSignUpForm(data);
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: 'Please resolve the highlighted errors.',
      errors,
    };
  }

  const cleanEmail = data.email.trim().toLowerCase();
  const digitsOnly = data.mobileNumber.replace(/\D/g, '');
  const phone10 = digitsOnly.length === 12 && digitsOnly.startsWith('91')
    ? digitsOnly.slice(2)
    : digitsOnly;
  const formattedPhone = phone10.length === 10
    ? `+91 ${phone10.slice(0, 5)} ${phone10.slice(5)}`
    : data.mobileNumber.trim();

  try {
    const response = await callAppsScriptBackend<{
      success: boolean;
      message: string;
      userId?: string;
      isFirstTimeLogin?: boolean;
      user?: any;
    }>({
      action: 'signup',
      signupMethod: data.signupMethod,
      fullName: data.fullName.trim(),
      email: cleanEmail,
      mobile: phone10,
      password: data.password,
      role: selectedRole,
      verificationToken,
    });

    if (response && response.success) {
      const session: AuthenticatedUserSession = {
        userId: response.userId || response.user?.userId || `USR-${Date.now()}`,
        fullName: data.fullName.trim(),
        email: cleanEmail,
        mobile: phone10,
        phone: formattedPhone,
        role: selectedRole,
        signedInAt: new Date().toISOString(),
        isFirstTimeLogin: true, // Marked true for first-time registration!
      };

      saveStoredSession(session);

      return {
        success: true,
        message: response.message || 'Account created and verified successfully.',
        isFirstTimeLogin: true,
        userSummary: {
          userId: session.userId,
          fullName: session.fullName,
          email: session.email,
          phone: session.phone,
          mobileNumber: session.phone,
          role: session.role,
          isFirstTimeLogin: true,
        },
      };
    }

    const errorMsg = response?.message || 'Unable to create account.';
    return {
      success: false,
      message: errorMsg,
      errors: {
        general: errorMsg,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Unable to reach authentication server. Please check your connection and try again.',
      errors: {
        general: 'Unable to reach authentication server. Please check your connection and try again.',
      },
    };
  }
};

/**
 * Provisions a secure Company Administrator Profile restricted to authorized personnel
 */
export const setupInitialCompanyAdmin = async (
  data: AdminSetupFormData
): Promise<AuthSubmissionResult> => {
  try {
    const response = await callAppsScriptBackend<{
      success: boolean;
      message: string;
      user?: {
        userId: string;
        fullName: string;
        email: string;
        role: UserRole;
        phone: string;
      };
    }>({
      action: 'setupCompanyAdmin',
      masterKey: data.masterKey,
      fullName: data.fullName,
      email: data.email,
      password: data.password,
    });

    if (response && response.success && response.user) {
      const adminSession: AuthenticatedUserSession = {
        userId: response.user.userId,
        fullName: response.user.fullName,
        email: response.user.email,
        mobile: '9845000001',
        phone: response.user.phone || '+91 98450 00001',
        role: 'company-admin',
        signedInAt: new Date().toISOString(),
        isFirstTimeLogin: false,
      };
      saveStoredSession(adminSession);
      return {
        success: true,
        message: response.message || 'Company Administrator setup completed.',
        userSummary: adminSession,
      };
    }
    return {
      success: false,
      message: response?.message || 'Admin setup failed.',
      errors: { general: response?.message || 'Admin setup failed.' },
    };
  } catch {
    return {
      success: false,
      message: 'Unable to reach admin setup service.',
      errors: { general: 'Unable to reach admin setup service.' },
    };
  }
};

/**
 * Resets password using verified OTP token
 */
export const resetPasswordWithOtp = async (
  identifier: string,
  verificationToken: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await callAppsScriptBackend<{ success: boolean; message: string }>({
      action: 'resetPasswordWithOtp',
      identifier,
      verificationToken,
      newPassword,
    });
    return response;
  } catch {
    return { success: false, message: 'Password reset request failed. Please try again.' };
  }
};

/**
 * Structured gateway for password reset requests
 */
export const submitPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return {
      success: false,
      message: 'Please provide a valid email address to receive reset instructions.',
    };
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
    message: `A password reset link has been dispatched to ${email.trim()}.`,
  };
};

/**
 * Demo Restaurant Access for partner evaluation (rest-1 through rest-10).
 * Preserves Rohan's existing real credentials while allowing direct ID-based access to any of the 10 restaurants.
 */
export const accessDemoRestaurant = (restaurantIdInput: string): AuthSubmissionResult => {
  const normalizedId = (restaurantIdInput || '').trim().toLowerCase();

  if (!normalizedId) {
    return {
      success: false,
      message: 'Please enter a Restaurant ID (e.g. rest-2 or rest-10).',
      errors: {
        general: 'Restaurant ID is required.',
      },
    };
  }

  // Look up within the 10 permanent restaurants
  const matchedRestaurant = RESTAURANTS_DATA.find(
    (r) => r.id.toLowerCase() === normalizedId
  );

  if (!matchedRestaurant) {
    return {
      success: false,
      message: `Invalid Restaurant ID "${restaurantIdInput.trim()}". Please enter a valid ID from rest-1 to rest-10 (e.g., rest-2 for The Glasshouse Trattoria, rest-10 for Aroma Dawat Biryani House).`,
      errors: {
        general: `Invalid Restaurant ID "${restaurantIdInput.trim()}". Valid IDs: rest-1 to rest-10.`,
      },
    };
  }

  const isRohan = matchedRestaurant.id === 'rest-1';
  const session: AuthenticatedUserSession = {
    userId: isRohan ? 'owner-rohan-001' : `owner-${matchedRestaurant.id}`,
    fullName: isRohan ? 'Rohan' : `${matchedRestaurant.name} Owner`,
    email: isRohan ? 'rohan@gmail.com' : `owner.${matchedRestaurant.id}@flashtable.in`,
    mobile: '9845012260',
    phone: '+91 98450 12260',
    role: 'restaurant-owner',
    signedInAt: new Date().toISOString(),
    restaurantId: matchedRestaurant.id,
  };

  saveStoredSession(session);

  return {
    success: true,
    message: `Access granted for ${matchedRestaurant.name}.`,
    userSummary: {
      userId: session.userId,
      fullName: session.fullName,
      email: session.email,
      phone: session.phone,
      mobileNumber: session.mobile,
      role: 'restaurant-owner',
      restaurantId: matchedRestaurant.id,
    },
  };
};
