import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Jika env belum dikonfigurasi (misal saat inisialisasi lokal atau build static)
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("placeholder")) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  // Lewati file statis, aset, dan preview publik
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/fonts") ||
    pathname === "/design-preview" ||
    pathname === "/favicon.ico"
  ) {
    return response;
  }

  // Ambil data user dari sesi aktif
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. KONDISI BELUM LOGIN
  if (!user) {
    if (pathname.startsWith("/owner") || pathname.startsWith("/penjahit")) {
      const redirectUrl = new URL("/login", request.url);
      return NextResponse.redirect(redirectUrl);
    }
    if (pathname === "/") {
      const redirectUrl = new URL("/login", request.url);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // 2. KONDISI SUDAH LOGIN: Ambil profil peran di server
  const { data: profile } = await supabase
    .from("users")
    .select("role, aktif")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role;
  const isAktif = profile?.aktif ?? true;

  if (!isAktif) {
    await supabase.auth.signOut();
    const redirectUrl = new URL("/login?error=inactive", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Pengguna yang sudah login mengakses halaman /login atau /
  if (pathname === "/login" || pathname === "/") {
    if (userRole === "owner") {
      return NextResponse.redirect(new URL("/owner", request.url));
    } else {
      return NextResponse.redirect(new URL("/penjahit", request.url));
    }
  }

  // 3. GUARD PERAN (SERVER-SIDE):
  // Penjahit tidak boleh membuka /owner
  if (pathname.startsWith("/owner")) {
    if (userRole !== "owner") {
      return NextResponse.redirect(new URL("/penjahit", request.url));
    }
  }

  // Owner tidak boleh membuka /penjahit
  if (pathname.startsWith("/penjahit")) {
    if (userRole !== "penjahit") {
      return NextResponse.redirect(new URL("/owner", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
