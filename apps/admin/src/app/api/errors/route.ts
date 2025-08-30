import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    
    // Add server-side context
    const enrichedErrorData = {
      ...errorData,
      serverTimestamp: new Date().toISOString(),
      ip: request.ip || 'unknown',
      headers: {
        'user-agent': request.headers.get('user-agent') || 'unknown',
        'referer': request.headers.get('referer') || 'unknown',
      },
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[CLIENT ERROR REPORT]', {
        level: enrichedErrorData.level || 'unknown',
        message: enrichedErrorData.message,
        url: enrichedErrorData.url,
        timestamp: enrichedErrorData.timestamp,
        context: enrichedErrorData.context,
      });
    }

    // In production, you would send this to your monitoring service
    // Examples:
    // - Sentry: Sentry.captureException(new Error(errorData.message), { extra: enrichedErrorData });
    // - LogRocket: LogRocket.captureException(new Error(errorData.message));
    // - DataDog: logger.error(errorData.message, enrichedErrorData);
    // - Custom logging service: await logService.error(enrichedErrorData);

    if (process.env.NODE_ENV === 'production') {
      // Replace with your actual error reporting service
      await reportToMonitoringService(enrichedErrorData);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Error reported successfully' 
    });
  } catch (error) {
    console.error('Failed to process error report:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process error report' 
      },
      { status: 500 }
    );
  }
}

async function reportToMonitoringService(errorData: any) {
  // This is where you would integrate with your monitoring service
  // For now, we'll just log to console
  console.error('[PRODUCTION ERROR]', errorData);
  
  // Example implementations:
  
  // Sentry
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(new Error(errorData.message), {
  //     tags: { level: errorData.level },
  //     extra: errorData,
  //   });
  // }
  
  // Custom webhook
  // if (process.env.ERROR_WEBHOOK_URL) {
  //   await fetch(process.env.ERROR_WEBHOOK_URL, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(errorData),
  //   });
  // }
  
  // Email notifications for critical errors
  // if (errorData.level === 'app' && process.env.ADMIN_EMAIL) {
  //   await sendErrorEmail(process.env.ADMIN_EMAIL, errorData);
  // }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Error reporting endpoint is healthy',
    timestamp: new Date().toISOString()
  });
}