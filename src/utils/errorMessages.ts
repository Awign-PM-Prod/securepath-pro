/**
 * Error message utility to parse errors and generate user-friendly messages
 */

interface ParsedError {
  userFriendlyMessage: string;
  title?: string;
  technicalDetails?: string;
}

/**
 * Parse database error codes and return user-friendly messages
 */
function parseDatabaseError(error: any): ParsedError | null {
  if (!error?.code && !error?.message) return null;

  const errorCode = error.code;
  const errorMessage = error.message?.toLowerCase() || '';

  // PostgreSQL error codes
  switch (errorCode) {
    case '23505': // Unique constraint violation
      if (errorMessage.includes('email')) {
        return {
          userFriendlyMessage: 'This email address is already registered. Please use a different email.',
          title: 'Email Already Exists',
        };
      }
      if (errorMessage.includes('phone')) {
        return {
          userFriendlyMessage: 'This phone number is already registered. Please use a different phone number.',
          title: 'Phone Number Already Exists',
        };
      }
      if (errorMessage.includes('case_number') || errorMessage.includes('case')) {
        return {
          userFriendlyMessage: 'A case with this number already exists. Please check the case ID.',
          title: 'Duplicate Case',
        };
      }
      if (errorMessage.includes('contract')) {
        return {
          userFriendlyMessage: 'A contract with this client and contract type combination already exists. Please choose a different contract type or edit the existing contract.',
          title: 'Contract Already Exists',
        };
      }
      if (errorMessage.includes('pincode')) {
        return {
          userFriendlyMessage: 'This pincode tier already exists. Please choose a different pincode or update the existing tier.',
          title: 'Pincode Already Exists',
        };
      }
      return {
        userFriendlyMessage: 'This record already exists in the system. Please check for duplicates.',
        title: 'Duplicate Entry',
      };

    case '23503': // Foreign key constraint violation
      if (errorMessage.includes('vendor') || errorMessage.includes('vendor_id')) {
        return {
          userFriendlyMessage: 'The selected vendor does not exist. Please select a valid vendor.',
          title: 'Invalid Vendor',
        };
      }
      if (errorMessage.includes('client') || errorMessage.includes('client_id')) {
        return {
          userFriendlyMessage: 'The selected client does not exist. Please select a valid client.',
          title: 'Invalid Client',
        };
      }
      if (errorMessage.includes('location') || errorMessage.includes('location_id')) {
        return {
          userFriendlyMessage: 'The location reference is invalid. Please check the address details.',
          title: 'Invalid Location',
        };
      }
      if (errorMessage.includes('contract_type')) {
        return {
          userFriendlyMessage: 'The selected contract type is invalid. Please select a valid contract type.',
          title: 'Invalid Contract Type',
        };
      }
      return {
        userFriendlyMessage: 'One or more selected options are invalid. Please ensure all selections are valid.',
        title: 'Invalid Selection',
      };

    case '23502': // Not null constraint violation
      if (errorMessage.includes('pincode')) {
        return {
          userFriendlyMessage: 'Pincode is required. Please enter a valid 6-digit pincode.',
          title: 'Missing Pincode',
        };
      }
      if (errorMessage.includes('email')) {
        return {
          userFriendlyMessage: 'Email address is required. Please enter a valid email.',
          title: 'Missing Email',
        };
      }
      if (errorMessage.includes('phone')) {
        return {
          userFriendlyMessage: 'Phone number is required. Please enter a valid 10-digit phone number.',
          title: 'Missing Phone Number',
        };
      }
      return {
        userFriendlyMessage: 'One or more required fields are missing. Please fill in all required fields.',
        title: 'Missing Required Fields',
      };

    case '23514': // Check constraint violation
      return {
        userFriendlyMessage: 'The entered value does not meet the required constraints. Please check your input.',
        title: 'Invalid Value',
      };

    case 'PGRST116': // PostgREST not found
      return {
        userFriendlyMessage: 'The requested record was not found. It may have been deleted or does not exist.',
        title: 'Record Not Found',
      };

    case '42501': // Insufficient privilege
      return {
        userFriendlyMessage: 'You do not have permission to perform this action. Please contact your administrator.',
        title: 'Access Denied',
      };

    case '42P01': // Undefined table
      return {
        userFriendlyMessage: 'A system error occurred. Please contact support if this issue persists.',
        title: 'System Error',
        technicalDetails: 'Database table not found',
      };

    default:
      return null;
  }
}

/**
 * Parse Supabase-specific errors
 */
function parseSupabaseError(error: any): ParsedError | null {
  if (!error?.message) return null;

  const message = error.message.toLowerCase();

  // Authentication errors
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return {
      userFriendlyMessage: 'The email or password you entered is incorrect. Please check your credentials and try again.',
      title: 'Invalid Login Credentials',
    };
  }

  if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
    return {
      userFriendlyMessage: 'Please verify your email address before logging in. Check your inbox for the confirmation email.',
      title: 'Email Not Verified',
    };
  }

  if (message.includes('too many requests') || message.includes('rate limit')) {
    return {
      userFriendlyMessage: 'Too many login attempts. Please wait a few minutes and try again.',
      title: 'Too Many Attempts',
    };
  }

  if (message.includes('user not found')) {
    return {
      userFriendlyMessage: 'No account found with this email address. Please check your email or sign up for a new account.',
      title: 'Account Not Found',
    };
  }

  if (message.includes('network') || message.includes('fetch')) {
    return {
      userFriendlyMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      title: 'Connection Error',
    };
  }

  // RLS (Row Level Security) errors
  if (message.includes('permission denied') || message.includes('policy') || message.includes('rls')) {
    return {
      userFriendlyMessage: 'You do not have permission to access this resource. Please contact your administrator if you believe this is an error.',
      title: 'Access Denied',
    };
  }

  return null;
}

/**
 * Parse business logic errors from error messages
 */
function parseBusinessLogicError(error: any): ParsedError | null {
  if (!error?.message) return null;

  const message = error.message.toLowerCase();

  // Pincode errors
  if (message.includes('pincode') && (message.includes('not found') || message.includes('not exist') || message.includes('unregistered'))) {
    return {
      userFriendlyMessage: 'The pincode entered is not registered in our system. Please ensure the pincode is correct or contact support to register this pincode.',
      title: 'Pincode Not Registered',
    };
  }

  // Contract errors
  if (message.includes('contract') && (message.includes('not found') || message.includes('missing') || message.includes('not exist'))) {
    return {
      userFriendlyMessage: 'No contract found for this client and contract type combination. Please set up a contract first before creating cases.',
      title: 'Contract Not Found',
    };
  }

  // Location errors
  if (message.includes('location') && (message.includes('failed') || message.includes('error'))) {
    return {
      userFriendlyMessage: 'Unable to save the location details. Please verify the address information and try again.',
      title: 'Location Error',
    };
  }

  // Payout calculation errors
  if (message.includes('payout') || message.includes('rate calculation')) {
    return {
      userFriendlyMessage: 'Unable to calculate payout rates. Please ensure a valid contract and pincode tier exist for this combination.',
      title: 'Payout Calculation Failed',
    };
  }

  // Allocation errors
  if (message.includes('allocation') || message.includes('allocate')) {
    if (message.includes('no available') || message.includes('no worker')) {
      return {
        userFriendlyMessage: 'No available workers found for this pincode tier. Please try a different area or contact support.',
        title: 'No Workers Available',
      };
    }
    if (message.includes('capacity') || message.includes('full')) {
      return {
        userFriendlyMessage: 'All workers are currently at full capacity. Please try again later or contact support.',
        title: 'Workers At Capacity',
      };
    }
  }

  // File upload errors
  if (message.includes('file')) {
    if (message.includes('size') || message.includes('too large')) {
      return {
        userFriendlyMessage: 'The file is too large. Please upload a smaller file or compress the file before uploading.',
        title: 'File Too Large',
      };
    }
    if (message.includes('type') || message.includes('format')) {
      return {
        userFriendlyMessage: 'The file type is not supported. Please upload a file in the correct format.',
        title: 'Invalid File Type',
      };
    }
  }

  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    if (message.includes('email')) {
      return {
        userFriendlyMessage: 'Please enter a valid email address in the correct format (e.g., user@example.com).',
        title: 'Invalid Email Format',
      };
    }
    if (message.includes('phone')) {
      return {
        userFriendlyMessage: 'Please enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9.',
        title: 'Invalid Phone Number',
      };
    }
    if (message.includes('pincode')) {
      return {
        userFriendlyMessage: 'Please enter a valid 6-digit pincode (numbers only).',
        title: 'Invalid Pincode',
      };
    }
  }

  return null;
}

/**
 * Parse network/connection errors
 */
function parseNetworkError(error: any): ParsedError | null {
  if (!error) return null;

  // Network request failed
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return {
      userFriendlyMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      title: 'Connection Error',
    };
  }

  // Timeout errors
  if (error.message?.toLowerCase().includes('timeout') || error.name === 'TimeoutError') {
    return {
      userFriendlyMessage: 'The request took too long to complete. Please try again. If the problem persists, the server may be busy.',
      title: 'Request Timeout',
    };
  }

  // CORS errors
  if (error.message?.toLowerCase().includes('cors')) {
    return {
      userFriendlyMessage: 'Cannot connect to the service. Please contact support if this issue persists.',
      title: 'Service Connection Error',
    };
  }

  return null;
}

/**
 * Main function to parse any error and return user-friendly message
 */
export function getUserFriendlyError(error: any): ParsedError {
  if (!error) {
    return {
      userFriendlyMessage: 'An unexpected error occurred. Please try again.',
      title: 'Error',
    };
  }

  // Try database error first
  const dbError = parseDatabaseError(error);
  if (dbError) return dbError;

  // Try Supabase error
  const supabaseError = parseSupabaseError(error);
  if (supabaseError) return supabaseError;

  // Try business logic error
  const businessError = parseBusinessLogicError(error);
  if (businessError) return businessError;

  // Try network error
  const networkError = parseNetworkError(error);
  if (networkError) return networkError;

  // Check if error message already contains useful information
  if (error.message && typeof error.message === 'string') {
    // If it's already user-friendly (doesn't contain technical terms), return as is
    const message = error.message;
    const technicalTerms = ['sql', 'database', 'query', 'syntax', 'constraint', 'violation', 'postgres'];
    const isTechnical = technicalTerms.some(term => message.toLowerCase().includes(term));

    if (!isTechnical && message.length < 200) {
      return {
        userFriendlyMessage: message,
        title: 'Error',
      };
    }

    // Extract meaningful parts from technical errors
    if (message.includes('unique constraint') || message.includes('duplicate')) {
      if (message.includes('email')) {
        return {
          userFriendlyMessage: 'This email address is already registered. Please use a different email.',
          title: 'Email Already Exists',
        };
      }
      if (message.includes('phone')) {
        return {
          userFriendlyMessage: 'This phone number is already registered. Please use a different phone number.',
          title: 'Phone Number Already Exists',
        };
      }
    }

    if (message.includes('foreign key') || message.includes('invalid reference')) {
      return {
        userFriendlyMessage: 'One or more selected options are invalid or no longer exist. Please check your selections.',
        title: 'Invalid Reference',
      };
    }
  }

  // Generic fallback
  return {
    userFriendlyMessage: 'An unexpected error occurred. Please try again. If the problem persists, contact support.',
    title: 'Error',
    technicalDetails: error.message || 'Unknown error',
  };
}

/**
 * Helper to get error message for toast notifications
 */
export function getErrorToast(error: any) {
  const parsed = getUserFriendlyError(error);
  return {
    title: parsed.title || 'Error',
    description: parsed.userFriendlyMessage,
    variant: 'destructive' as const,
  };
}

/**
 * Helper to get error message for alerts
 */
export function getErrorAlertMessage(error: any): string {
  return getUserFriendlyError(error).userFriendlyMessage;
}

