import type { Metadata, Viewport } from "next";
import { ApolloWrapper } from "@/lib/apolloClient";
import { ToastProvider } from "@/components/Toaster";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { ChatTurnsProvider } from "@/lib/chatTurns";
import { themeInitScript } from "@/lib/theme";
import './globals.css'

export const metadata: Metadata = {
  title: "Keystone AI",
  description: "Keystone AI — answers from your documents, your past chats and the web",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ApolloWrapper>
          <ToastProvider>
            <ConfirmProvider>
              <ChatTurnsProvider>{children}</ChatTurnsProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}
