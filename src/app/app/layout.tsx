import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import "./dock.css";

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session) {
        redirect("/login");
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[var(--background-app)]">
            {/* Header */}
            <header className="h-16 bg-white border-b border-[var(--border-subtle)] flex items-center justify-between px-6 shrink-0 z-20">
                <Link href="/app/upload" className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[var(--primary)] rounded-lg flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-[20px]">menu_book</span>
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-[var(--primary)] leading-tight">AIDraft</h1>
                        <p className="text-[10px] text-[var(--text-subtle)] font-semibold tracking-wider uppercase">Editor de Tareas</p>
                    </div>
                </Link>

                <div className="flex items-center gap-4 text-sm text-[var(--text-subtle)]">
                    <div className="hidden md:flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        System Operational
                    </div>
                    <span className="hidden sm:block font-medium">{session.user?.email}</span>
                    <form action={async () => {
                        "use server";
                        const { signOut } = await import("@/lib/auth");
                        await signOut({ redirectTo: "/login" });
                    }}>
                        <button
                            type="submit"
                            className="hover:text-[var(--primary)] transition-colors"
                            title="Cerrar sesión"
                        >
                            <span className="material-symbols-outlined text-[22px]">logout</span>
                        </button>
                    </form>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-hidden relative">
                {children}

                {/* Floating Quick Links Dock - Vertical Pill */}
                <div className="dock-floating">
                    <div className="dock-container">
                        <a href="https://fp.foc.es/" target="_blank" rel="noopener noreferrer" className="dock-card dock-card-foc" title="FOC Moodle">
                            <span className="dock-foc">FOC</span>
                        </a>
                        <a href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer" className="dock-card dock-card-gemini" title="Gemini AI">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" fill="currentColor" />
                            </svg>
                        </a>
                        <a href="https://www.pdf24.org/es/" target="_blank" rel="noopener noreferrer" className="dock-card dock-card-pdf" title="PDF24">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM6 20V4H13V9H18V20H6ZM8 15H10V17H8V15ZM12 15H16V17H12V15ZM8 12H16V14H8V12Z" fill="currentColor" />
                            </svg>
                        </a>
                        <a href="https://claude.ai/" target="_blank" rel="noopener noreferrer" className="dock-card dock-card-claude" title="Claude AI">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                                <circle cx="12" cy="12" r="4" fill="currentColor" />
                            </svg>
                        </a>
                    </div>
                </div>
            </main>
        </div>
    );
}
