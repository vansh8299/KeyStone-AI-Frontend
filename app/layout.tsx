import type { Metadata } from "next";
import { ApolloWrapper } from "@/lib/apolloClient";
import { ToastProvider } from "@/components/Toaster";
import { ChatTurnsProvider } from "@/lib/chatTurns";
import { themeInitScript } from "@/lib/theme";
import './globals.css'

export const metadata: Metadata = {
  title: "Keystone AI",
  description: "Keystone AI — answers from your documents, your past chats and the web",
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
            <ChatTurnsProvider>{children}</ChatTurnsProvider>
          </ToastProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}
