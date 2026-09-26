import { SignInAction } from "../../components/sign-in-action";

export default function SignInPage() {
  return (
    <main className="sign-in-page">
      <section className="sign-in-content" aria-labelledby="sign-in-title">
        <div className="brand-mark" aria-hidden="true">
          U
        </div>
        <p className="sign-in-kicker">University Planner</p>
        <h1 id="sign-in-title">Sign in to your planner</h1>
        <p>Your courses and plan stay with your account.</p>
        <SignInAction />
      </section>
    </main>
  );
}
