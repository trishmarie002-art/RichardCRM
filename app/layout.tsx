import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Star Roofing CRM",
  description: "Private roofing lead, customer, estimate and roof measurement CRM"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}