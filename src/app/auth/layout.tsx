type AuthLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_minmax(0,1fr)]">
        <aside className="relative hidden overflow-hidden border-r border-border bg-surface lg:block">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-24 size-[420px] rounded-full bg-primary/20 blur-[120px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 right-0 size-[380px] rounded-full bg-info/15 blur-[130px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:36px_36px]"
          />
        </aside>

        <section className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 rounded-full bg-primary/12 blur-[110px] lg:hidden"
          />

          <div className="relative w-full max-w-[500px]">{children}</div>
        </section>
      </div>
    </main>
  );
}
