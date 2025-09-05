import { Providers } from "./providers";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Add Tailwind CSS CDN */}
        <script src="https://cdn.tailwindcss.com"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              theme: {
                extend: {
                  colors: {
                    primary: '#1E40AF',
                    secondary: '#DB2777',
                    cyan: {
                      400: '#22d3ee',
                      500: '#06b6d4',
                      600: '#0891b2',
                    },
                    purple: {
                      500: '#a855f7',
                      600: '#9333ea',
                    }
                  }
                }
              }
            }
          `
        }} />
        {/* Add Inter font for better typography */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        {/* Add custom styles for glassmorphism effects */}
        <style dangerouslySetInnerHTML={{
          __html: `
            body {
              font-family: 'Inter', sans-serif;
            }
            .glass-card {
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 255, 255, 0.2);
            }
            .gradient-bg {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
          `
        }} />
      </head>
      <body className="gradient-bg min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}