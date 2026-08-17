import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication - The Launch Feed",
  description: "Sign in to The Launch Feed.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function HandlerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
