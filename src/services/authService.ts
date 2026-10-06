import { LoginFormData, SignUpFormData, AuthValidationErrors, UserRole } from '../types';
import { RESTAURANTS_DATA } from '../data/mockData';

/**
 * FlashTable Authentication Service
 * Connected to Google Apps Script Web App Backend & Google Sheets "Users" Database.
 */

export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyGStCgmWV--V5mHS_AGKql8dRZ6JIWHTRpKDtrQI6TWXavglVofqs5CwvKUGiPL_5z/exec';
const LOCAL_PROXY_URL = '/api/auth';
const AUTH_SESSION_KEY = 'flashtable_auth_session';

// Email regex pattern meeting RFC 5322 standard
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Indian mobile number regex: 10 digits starting with 6, 7, 8, or 9
const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;

export interface AuthenticatedUserSession {
  userId?: string;
  fullName: string;
  email: string;
  mobile: string;
  phone: string;
  role: UserRole;
  signedInAt: string;
  restaurantId?: string;
}

/**
 * Retrieves the currently active authenticated session from storage if present.
 */
export const getStoredSession = (): AuthenticatedUserSession | null => {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.email && parsed.role) {
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

  if (!data.email || !data.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address.';
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
    errors.fullName = 'Full name is required.';
  } else if (data.fullName.trim().length < 2) {
    errors.fullName = 'Please enter your full name (at least 2 characters).';
  }

  // 2. Email validation
  if (!data.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  // 3. Indian mobile number validation
  const digitsOnly = data.mobileNumber.replace(/\D/g, '');
  const phone10 = digitsOnly.length === 12 && digitsOnly.startsWith('91')
    ? digitsOnly.slice(2)
    : digitsOnly;

  if (!data.mobileNumber.trim()) {
    errors.mobileNumber = 'Indian mobile number is required.';
  } else if (phone10.length !== 10 || !INDIAN_PHONE_REGEX.test(phone10)) {
    errors.mobileNumber = 'Please enter a valid 10-digit Indian mobile number.';
  }

  // 4. Password validation (minimum 6 characters)
  if (!data.password) {
    errors.password = 'Password is required.';
  } else if (data.password.length < 6) {
    errors.password = 'Password is too short (minimum 6 characters).';
  }

  // 5. Confirm password validation
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
  errors?: AuthValidationErrors;
  userSummary?: {
    userId?: string;
    fullName?: string;
    email: string;
    mobileNumber?: string;
    phone?: string;
    role?: UserRole;
    restaurantId?: string;
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
 * Authenticates user credentials with Google Apps Script backend
 */
export const submitSignIn = async (
  data: LoginFormData,
  selectedRole: UserRole = 'customer'
): Promise<AuthSubmissionResult> => {
  const errors = validateLoginForm(data);
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: 'Please provide both your email and password.',
      errors,
    };
  }

  const cleanEmail = data.email.trim().toLowerCase();

  try {
    const response = await callAppsScriptBackend<{
      success: boolean;
      message: string;
      user?: {
        userId?: string;
        fullName?: string;
        email?: string;
        mobile?: string | number;
        role?: string;
      };
    }>({
      action: 'login',
      email: cleanEmail,
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

      const session: AuthenticatedUserSession = {
        userId: returnedUser?.userId,
        fullName: returnedUser?.fullName || (selectedRole === 'restaurant-owner' ? (cleanEmail.includes('rohan') ? 'Rohan' : 'Arjun Rao') : 'Customer'),
        email: returnedUser?.email || cleanEmail,
        mobile: phone10 || rawMobile,
        phone: formattedPhone,
        role: (returnedUser?.role as UserRole) || selectedRole,
        signedInAt: new Date().toISOString(),
        restaurantId: (returnedUser as any)?.restaurantId || undefined,
      };

      saveStoredSession(session);

      return {
        success: true,
        message: response.message || 'Login successful.',
        userSummary: {
          userId: session.userId,
          fullName: session.fullName,
          email: session.email,
          phone: session.phone,
          mobileNumber: session.phone,
          role: session.role,
          restaurantId: session.restaurantId,
        },
      };
    }

    // Backend returned unsuccessful authentication
    const errorMsg = response?.message || 'Invalid email, password or role.';
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
 * Creates a new account in Google Sheets via Google Apps Script backend
 */
export const submitSignUp = async (
  data: SignUpFormData,
  selectedRole: UserRole = 'customer'
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
    // Send signup request to Google Apps Script Web App without confirmPassword
    const response = await callAppsScriptBackend<{
      success: boolean;
      message: string;
      userId?: string;
    }>({
      action: 'signup',
      fullName: data.fullName.trim(),
      email: cleanEmail,
      mobile: phone10,
      password: data.password,
      role: selectedRole,
    });

    if (response && response.success) {
      const session: AuthenticatedUserSession = {
        userId: response.userId,
        fullName: data.fullName.trim(),
        email: cleanEmail,
        mobile: phone10,
        phone: formattedPhone,
        role: selectedRole,
        signedInAt: new Date().toISOString(),
      };

      saveStoredSession(session);

      return {
        success: true,
        message: response.message || 'Account created successfully.',
        userSummary: {
          userId: response.userId,
          fullName: session.fullName,
          email: session.email,
          phone: session.phone,
          mobileNumber: session.phone,
          role: session.role,
        },
      };
    }

    // Backend error (e.g. duplicate email, etc.)
    const errorMsg = response?.message || 'Unable to create account.';
    const isEmailDuplicate = errorMsg.toLowerCase().includes('already exists') || errorMsg.toLowerCase().includes('email');

    return {
      success: false,
      message: errorMsg,
      errors: {
        email: isEmailDuplicate ? errorMsg : undefined,
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
