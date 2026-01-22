/**
 * Vercel Serverless Function: Wise Payment Link Creator
 * 
 * POST /api/wise/create-link
 * 
 * Body: { amount: number, orderId: string }
 * Returns: { paymentUrl: string }
 * 
 * Uses process.env.WISE_API_TOKEN and process.env.WISE_MEMBERSHIP_NUMBER (set in Vercel dashboard)
 * 
 * Note: This function runs in Node.js environment (Vercel serverless)
 * Uses Node.js global fetch (available in Node.js 18+)
 * 
 * Wise Membership Number: Starts with "P" (e.g., P61100320) from Wise business account
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported' 
    });
  }

  try {
    // Validate required environment variables
    const apiToken = process.env.WISE_API_TOKEN;
    const membershipNumber = process.env.WISE_MEMBERSHIP_NUMBER;
    
    if (!apiToken) {
      console.error('WISE_API_TOKEN is not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Payment service is not properly configured' 
      });
    }
    
    if (!membershipNumber) {
      console.error('WISE_MEMBERSHIP_NUMBER is not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Payment service is not properly configured' 
      });
    }

    // Validate membership number format (should start with "P")
    if (!membershipNumber.startsWith('P')) {
      console.error('WISE_MEMBERSHIP_NUMBER format invalid (should start with P)');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Invalid membership number format' 
      });
    }

    // Parse and validate request body
    const { amount, orderId } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid amount',
        message: 'Amount must be a positive number' 
      });
    }

    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid orderId',
        message: 'Order ID is required' 
      });
    }

    // Prepare Wise Payment Links API request
    // Try multiple endpoint variations as Wise API may vary by region/account type
    // Primary: https://api.wise.com/v1/payment-links
    // Alternative: https://api.wise.com/v2/payment-links
    // Alternative: https://api.transferwise.com/v1/payment-links
    const wiseApiUrl = 'https://api.wise.com/v1/payment-links';
    const redirectUrl = 'https://iceyout.com/thank-you';

    // Wise API request body format - try both profileId and profile field names
    // Some Wise API versions use 'profile' instead of 'profileId'
    // Amount should be a number (decimal format)
    const requestBody = {
      profileId: membershipNumber,
      amount: {
        value: amount,
        currency: 'USD'
      },
      redirectUrl: redirectUrl,
      metadata: {
        orderId: orderId
      }
    };

    // Alternative request body format (if profileId doesn't work)
    const requestBodyAlternative = {
      profile: membershipNumber,
      amount: {
        value: amount,
        currency: 'USD'
      },
      redirectUrl: redirectUrl,
      metadata: {
        orderId: orderId
      }
    };

    // Log request details (without sensitive data) for debugging
    console.log('Wise API request:', {
      url: wiseApiUrl,
      method: 'POST',
      hasToken: !!apiToken,
      hasMembershipNumber: !!membershipNumber,
      membershipNumberPrefix: membershipNumber ? membershipNumber.substring(0, 2) : 'N/A',
      amount: amount,
      currency: 'USD',
      orderId: orderId,
      redirectUrl: redirectUrl
    });

    // Call Wise API - try primary format first
    let response = await fetch(wiseApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // If 404, try alternative format with 'profile' instead of 'profileId'
    if (response.status === 404) {
      console.log('Primary request returned 404, trying alternative format with "profile" field...');
      
      // Try with 'profile' instead of 'profileId'
      response = await fetch(wiseApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBodyAlternative)
      });
    }

    // Handle Wise API response
    if (!response.ok) {
      const errorText = await response.text();
      let errorBody = errorText;
      
      // Try to parse as JSON for better logging
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        // Keep as text if not JSON
        errorBody = errorText;
      }
      
      // Log full Wise API error details (server-side only)
      let responseHeaders = {};
      try {
        responseHeaders = Object.fromEntries(response.headers.entries());
      } catch (e) {
        responseHeaders = { error: 'Could not read headers' };
      }
      
      // Log comprehensive error details for debugging
      console.error('Wise API error response:', {
        status: response.status,
        statusText: response.statusText,
        url: wiseApiUrl,
        headers: responseHeaders,
        body: errorBody,
        requestBody: {
          profileId: membershipNumber ? `${membershipNumber.substring(0, 2)}***` : 'MISSING',
          amount: amount,
          currency: 'USD',
          redirectUrl: redirectUrl,
          orderId: orderId
        }
      });
      
      // Extract clear error message from Wise response
      let errorMessage = 'Failed to create payment link. Please try again.';
      if (typeof errorBody === 'object' && errorBody !== null) {
        // Try common error message fields
        errorMessage = errorBody.message || 
                      errorBody.error?.message || 
                      errorBody.error || 
                      (errorBody.errors && Array.isArray(errorBody.errors) ? errorBody.errors[0]?.message : null) ||
                      errorMessage;
      } else if (typeof errorBody === 'string' && errorBody.trim()) {
        // Use error text if it's a meaningful string
        errorMessage = errorBody;
      }

      // Provide more specific error message for common issues
      if (response.status === 404) {
        errorMessage = 'Payment link endpoint not found. Please verify your Wise account has Payment Links enabled and the API endpoint is correct.';
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = 'Authentication failed. Please verify your Wise API token and membership number are correct.';
      } else if (response.status === 400) {
        errorMessage = errorMessage || 'Invalid request. Please check the amount and order ID format.';
      }
      
      return res.status(response.status || 500).json({ 
        error: 'Payment link creation failed',
        message: errorMessage 
      });
    }

    const wiseResponse = await response.json();

    // Extract payment URL from Wise response
    // Wise API may return: { id, url, paymentUrl, link, href, ... }
    const paymentUrl = wiseResponse.url || 
                       wiseResponse.paymentUrl || 
                       wiseResponse.link || 
                       wiseResponse.href ||
                       wiseResponse.payment_url;

    if (!paymentUrl) {
      console.error('Wise API response missing payment URL:', JSON.stringify(wiseResponse));
      return res.status(500).json({ 
        error: 'Invalid response from payment service',
        message: 'Payment link creation failed. Please try again.' 
      });
    }

    // Return success response
    return res.status(200).json({ 
      paymentUrl: paymentUrl 
    });

  } catch (error) {
    // Log error for debugging (server-side only)
    console.error('Error creating Wise payment link:', error);
    
    // Return safe error response
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'An error occurred while creating the payment link. Please try again.' 
    });
  }
}
