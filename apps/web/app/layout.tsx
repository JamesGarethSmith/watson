import "./globals.css";

export const metadata = {
  title: "Watson",
  description: "Personal event discovery for family calendars"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

