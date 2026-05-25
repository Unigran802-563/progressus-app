type AuthLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,_#5b2c6f_0%,_#3b1d7a_42%,_#2563eb_100%)] px-4 py-8">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        {children}
      </div>
    </main>
  );
}
