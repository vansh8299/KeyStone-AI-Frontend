import ChatView from "@/components/ChatView";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChatView />
      {children}
    </>
  );
}
