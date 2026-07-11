import type { Metadata } from "next";
import { AIChatClient } from "@/components/AIChatClient";

export const metadata: Metadata = {
  title: "Admin AI Chat - FKS System",
  description: "Ask FKS AI about server data and admin workflows.",
};

export default function AdminAIChatPage() {
  return <AIChatClient audience="admin" />;
}
