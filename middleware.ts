import { NextRequest, NextResponse } from 'next/server';

// Define route access by role
const PROTECTED_ROUTES: Record<string, string[]> = {
  '/driver': ['driver'],
  '/admin': ['admin'],
  '/manager': ['admin', 'manager'],
  '/viewer': ['admin', 'viewer'],
};

// Routes that require authentication
const AUTH_REQUIRED_ROUTES = Object.keys(PROTECTED_ROUTES);

// Public routes (no auth required)
const PUBLIC_ROUTES = ['/auth/login', '/auth/signup', '/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if route requires authentication (prefix match)
  const matchedPrefix = AUTH_REQUIRED_ROUTES.find((route) =>
    pathname.startsWith(route)
  );
  if (!matchedPrefix) {
    // Route is not protected, allow access
    return NextResponse.next();
  }

  // Read lightweight role cookie set by client after successful login
  const roleCookie = request.cookies.get('toyota_role')?.value as
    | 'driver'
    | 'admin'
    | 'manager'
    | 'viewer'
    | undefined;

  // If no role cookie and the route is protected, redirect to login
  if (!roleCookie) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify role is allowed for the route prefix
  const allowedRoles = PROTECTED_ROUTES[matchedPrefix];
  const isAllowed = allowedRoles.includes(roleCookie);

  if (!isAllowed) {
    // Redirect to role's default home
    const defaultHome =
      roleCookie === 'driver'
        ? '/driver'
        : roleCookie === 'admin' || roleCookie === 'manager'
        ? '/admin/dashboard'
        : '/viewer';
    const url = new URL(defaultHome, request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Define which routes trigger middleware
export const config = {
  matcher: [
    // Protected routes
    // Keep matchers for future enforcement, but middleware currently allows all
    '/driver/:path*',
    '/admin/:path*',
    '/manager/:path*',
    '/viewer/:path*',
    // Exclude public assets and api
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};
