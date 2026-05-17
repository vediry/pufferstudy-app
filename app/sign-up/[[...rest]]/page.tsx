import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6 py-16">
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/" />
    </main>
  );
}
