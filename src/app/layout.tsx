import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import { SITE_NAME } from "@/lib/site";

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: "ระบบเรียนออนไลน์",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={prompt.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem("lms-theme")||"light";document.documentElement.setAttribute("data-theme",t)})()` }} />
      </head>
      {/* suppressHydrationWarning: ส่วนขยายเบราว์เซอร์ (เช่น ColorZilla) แอบใส่ attribute ใน body ก่อน React โหลด */}
      <body className="font-sans antialiased overflow-x-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
