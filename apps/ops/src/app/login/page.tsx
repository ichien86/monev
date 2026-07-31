import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

async function loginAction(formData: FormData) {
  "use server";
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-8">
        <h1 className="font-display text-xl font-semibold text-ink">SIMONEV Ops</h1>
        <p className="text-sm text-muted mt-1">Bapperida Kabupaten Boyolali</p>

        {params.error && (
          <p className="mt-4 text-sm text-danger bg-danger-tint rounded-lg px-3 py-2">
            Email atau kata sandi salah.
          </p>
        )}

        <form action={loginAction} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? "/"} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono text-muted uppercase tracking-wide">Email</span>
            <input
              name="email"
              type="email"
              required
              className="px-3 py-2 rounded-lg border border-border text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono text-muted uppercase tracking-wide">Kata Sandi</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="px-3 py-2 rounded-lg border border-border text-sm"
            />
          </label>
          <button
            type="submit"
            className="mt-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold"
          >
            Masuk
          </button>
        </form>
      </div>
    </div>
  );
}
