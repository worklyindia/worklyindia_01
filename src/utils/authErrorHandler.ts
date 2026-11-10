// Authentication error handler utility
// Translates Supabase error codes to user-friendly Hindi/English messages

export interface AuthErrorMessage {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
}

export const handleAuthError = (error: any): AuthErrorMessage => {
  if (!error) {
    return {
      title: "Error",
      description: "Something went wrong",
      variant: "destructive"
    };
  }

  const message = error.message?.toLowerCase() || '';
  const status = error.status;

  // Handle banned/suspended users
  if (message.includes('banned') || message.includes('user is banned') || message.includes('banned_until')) {
    return {
      title: "Account Suspended",
      description: "Account suspended. Contact support.",
      variant: "destructive"
    };
  }

  // Handle specific Supabase error codes and messages
  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    return {
      title: "Invalid Credentials",
      description: "Wrong email or password",
      variant: "destructive"
    };
  }

  if (message.includes('user not found') || message.includes('user_not_found')) {
    return {
      title: "Account Not Found",
      description: "Email not registered",
      variant: "destructive"
    };
  }

  if (message.includes('user already registered') || message.includes('user_already_exists')) {
    return {
      title: "Account Already Exists",
      description: "Email already registered",
      variant: "destructive"
    };
  }

  if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
    return {
      title: "Verify Email",
      description: "Verify your email first",
      variant: "destructive"
    };
  }

  if (message.includes('signup disabled') || message.includes('signup_disabled')) {
    return {
      title: "Registration Disabled",
      description: "Signups are disabled",
      variant: "destructive"
    };
  }

  if (message.includes('weak password') || message.includes('password_too_weak')) {
    return {
      title: "Weak Password",
      description: "Password too short (min 6)",
      variant: "destructive"
    };
  }

  if (message.includes('rate limit') || message.includes('too_many_requests')) {
    return {
      title: "Too Many Attempts",
      description: "Too many attempts. Try later",
      variant: "destructive"
    };
  }

  if (message.includes('network') || message.includes('fetch')) {
    return {
      title: "Network Error",
      description: "No internet connection",
      variant: "destructive"
    };
  }

  if (message.includes('invalid email') || message.includes('email_invalid')) {
    return {
      title: "Invalid Email",
      description: "Invalid email",
      variant: "destructive"
    };
  }

  if (message.includes('email not found') || message.includes('user not found')) {
    return {
      title: "Email Not Found",
      description: "Email not registered",
      variant: "destructive"
    };
  }

  // Handle password reset specific errors
  if (message.includes('user not found') && message.includes('password')) {
    return {
      title: "Email Not Found",
      description: "Email not registered",
      variant: "destructive"
    };
  }

  // Handle "User not found" error for password reset
  if (message.includes('user not found')) {
    return {
      title: "Email Not Found",
      description: "Email not registered",
      variant: "destructive"
    };
  }

  if (message.includes('reset password') || message.includes('password reset')) {
    return {
      title: "Reset Issue",
      description: "Could not send reset email",
      variant: "destructive"
    };
  }

  if (message.includes('database') || status >= 500) {
    return {
      title: "Server Error",
      description: "Server error. Try later",
      variant: "destructive"
    };
  }

  if (message.includes('timeout')) {
    return {
      title: "Timeout",
      description: "Request timed out",
      variant: "destructive"
    };
  }

  // Default error message
  return {
    title: "Error",
    description: error.message || "Something went wrong",
    variant: "destructive"
  };
};

// Email validation utility
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Mobile number validation utility (global — any country's E.164 number)
export const validateMobileNumber = (mobile: string): { isValid: boolean; message: string } => {
  const trimmedMobile = mobile.trim();

  // Remove any non-digit characters except +
  const digitsOnly = trimmedMobile.replace(/[^\d+]/g, '');
  const digits = digitsOnly.replace(/\D/g, '');

  if (!trimmedMobile) {
    return {
      isValid: false,
      message: "Mobile number required"
    };
  }

  // E.164: 7-15 digits, optional leading + (any country code)
  if (!/^\+?\d{7,15}$/.test(digitsOnly) || digits.length < 7 || digits.length > 15) {
    return {
      isValid: false,
      message: "Enter a valid mobile number with country code"
    };
  }

  return {
    isValid: true,
    message: ""
  };
};

// Password strength validation
export const validatePassword = (password: string): { isValid: boolean; message: string } => {
  if (password.length < 6) {
    return {
      isValid: false,
      message: "Password too short (min 6)"
    };
  }
  
  if (password.length > 128) {
    return {
      isValid: false,
      message: "Password too long"
    };
  }

  return {
    isValid: true,
    message: ""
  };
};

// Form validation for signup
export const validateSignupForm = (email: string, password: string, confirmPassword: string, name: string, mobileNumber?: string): string[] => {
  const errors: string[] = [];

  if (!name.trim()) {
    errors.push("Name required");
  }

  if (!email.trim()) {
    errors.push("Email required");
  } else if (!validateEmail(email)) {
    errors.push("Invalid email");
  }

  if (mobileNumber) {
    const mobileValidation = validateMobileNumber(mobileNumber);
    if (!mobileValidation.isValid) {
      errors.push(mobileValidation.message);
    }
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.push(passwordValidation.message);
  }

  if (password !== confirmPassword) {
    errors.push("Passwords don't match");
  }

  return errors;
};

// Form validation for forgot password
export const validateForgotPasswordForm = (email: string): string[] => {
  const errors: string[] = [];

  if (!email.trim()) {
    errors.push("Email required");
  } else if (!validateEmail(email)) {
    errors.push("Invalid email");
  }

  return errors;
};

// Form validation for login
export const validateLoginForm = (email: string, password: string): string[] => {
  const errors: string[] = [];

  if (!email.trim()) {
    errors.push("Email required");
  } else if (!validateEmail(email)) {
    errors.push("Invalid email");
  }

  if (!password.trim()) {
    errors.push("Password required");
  }

  return errors;
};