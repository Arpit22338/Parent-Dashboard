import { Inter } from 'next/font/google';
import './globals.css';
import { SocketProvider } from '@/context/SocketContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Family Monitor',
  description: 'Parent monitoring dashboard for child devices',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-dark-900 min-h-screen`}>
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
