/**
 * Vercel Serverless Function: Wise Payment Link Creator
 * 
 * POST /api/wise/create-link
 * 
 * Body: { amount: number, orderId: string }
 * Returns: { paymentUrl: string }
 * 
 * Uses process.env.WISE_API_TOKEN and process.env.WISE_PROFILE_ID (set in Vercel dashboard)
 * 
 * Note: This function runs in Node.js environment (Vercel serverless)
 * Uses Node.js global fetch (available in Node.js 18+)
 * 
 * Common Issues:
 * 1. Verify WISE_API_TOKEN has correct permissions (payment links creation)
 * 2. Verify WISE_PROFILE_ID is correct for your Wise business account
 * 3. Check if your Wise account has Payment Links feature enabled
 * 4. API endpoint might need to be different based on your Wise account region
 * 5. Amount format might need to be in minor units (cents) - check Wise API docs
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
    const profileId = process.env.WISE_PROFILE_ID;
    
    if (!apiToken) {
      console.error('WISE_API_TOKEN is not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Payment service is not properly configured' 
      });
    }
    
    if (!profileId) {
      console.error('WISE_PROFILE_ID is not configured');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Payment service is not properly configured' 
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
    // Note: Wise API endpoint may vary - try both common endpoints
    // Primary: https://api.wise.com/v1/payment-links
    // Alternative: https://api.transferwise.com/v1/payment-links
    const wiseApiUrl = 'https://api.wise.com/v1/payment-links';
    const redirectUrl = 'https://iceyout.com/thank-you';

    // Wise API request body format
    // Amount should be in minor units (cents for USD) or as decimal string
    // Try both formats to handle different API versions
    const requestBody = {
      profileId: profileId,
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
      hasProfileId: !!profileId,
      amount: amount,
      orderId: orderId,
      redirectUrl: redirectUrl
    });

    // Call Wise API
    const response = await fetch(wiseApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

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
      // Note: These are response headers from Wise, not our request headers (which contain the token)
      let responseHeaders = {};
      try {
        responseHeaders = Object.fromEntries(response.headers.entries());
      } catch (e) {
        // Fallback if headers can't be read
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
          profileId: profileId ? '***' : 'MISSING',
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
                      errorMessage;
      } else if (typeof errorBody === 'string' && errorBody.trim()) {
        // Use error text if it's a meaningful string
        errorMessage = errorBody;
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
