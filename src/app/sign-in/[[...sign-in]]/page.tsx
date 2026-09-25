import { SignIn } from "@clerk/nextjs";
import { Icon } from "@/lib/icons";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <a className="auth-brand" href="/">
          <Icon name="ic-aigiare" viewBox="0 0 24 24" width={24} height={24} />
          AiGiare
        </a>
        <SignIn />
      </div>
    </main>
  );
}
