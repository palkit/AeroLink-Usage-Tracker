export const metadata = {
  title: 'Aerolink Panel',
  description: 'Multi-account Aerolink usage panel',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
