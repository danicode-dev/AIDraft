import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Get the token (JWT session)
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET
    });
    const isLoggedIn = !!token;

    // Protected routes under /app
    const isProtectedRoute = pathname.startsWith("/app") ||
        pathname.startsWith("/api/documents") ||
        pathname.startsWith("/api/export") ||
        pathname.startsWith("/api/parse");

    // Auth route (login)
    const isAuthRoute = pathname === "/login";

    // Redirect logged-in users away from login page
    if (isLoggedIn && isAuthRoute) {
        return NextResponse.redirect(new URL("/app/upload", request.url));
    }

    // Redirect unauthenticated users to login
    if (!isLoggedIn && isProtectedRoute) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/app/:path*",
        "/login",
        "/api/documents/:path*",
        "/api/export/:path*",
        "/api/parse",
    ],
};
