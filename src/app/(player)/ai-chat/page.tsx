import type { Metadata } from "next";
import { AIChatClient } from "@/components/AIChatClient";

export const metadata: Metadata = {
  title: "AI Chat - FKS System",
  description: "Ask FKS AI about server data and safe app usage.",
};

export default function PlayerAIChatPage() {
  return <AIChatClient audience="player" />;
}
