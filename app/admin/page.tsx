import React from "react";
import AdminClientView from "./AdminClientView";

export const metadata = {
  title: "Admin - The Launch Feed",
  description: "Internal admin console for The Launch Feed.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  return <AdminClientView adminEmail={adminEmail} />;
}
