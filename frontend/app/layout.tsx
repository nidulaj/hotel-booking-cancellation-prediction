import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { Splash } from "@/components/Splash";
import { ToastProvider } from "@/components/Toast";
import { Topbar } from "@/components/Topbar";
import { BOOT_SCRIPT } from "@/utils/boot";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking Shield · Hotel Cancellation Prediction",
  description: "Booking Shield predicts hotel booking cancellation risk so you can act before guests cancel.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans">
        <Splash />
        <ToastProvider>
          {/* Framed app shell: sidebar, top bar and content sit as soft panels on a white board. */}
          <div className="min-h-screen bg-panel lg:bg-transparent lg:p-3">
            <div className="lg:flex lg:min-h-[calc(100vh-24px)] lg:gap-3 lg:rounded-[36px] lg:bg-white lg:p-3">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <Topbar />
                <main className="flex-1 px-4 py-6 sm:px-6 lg:rounded-3xl lg:bg-panel lg:px-8 lg:py-8">
                  <div className="mx-auto max-w-[1400px]">{children}</div>
                </main>
              </div>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
