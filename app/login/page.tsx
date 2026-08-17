import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign In - The Launch Feed",
  description: "Sign in with magic link, Google, or GitHub.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: to } = await searchParams;
  const dest = to && to.startsWith("/") ? to : "/profile";
  redirect(`/handler/sign-in?after_auth_return_to=${encodeURIComponent(dest)}`);
}
