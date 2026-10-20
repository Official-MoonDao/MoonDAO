type DashboardSignInPromptProps = {
  onSignIn: () => void
}

/**
 * Shown on /dashboard when nobody is signed in. Reminder emails land here,
 * and a redirect to the homepage hides the next step.
 */
export default function DashboardSignInPrompt({ onSignIn }: DashboardSignInPromptProps) {
  return (
    <div
      data-testid="dashboard-sign-in-prompt"
      className="w-full max-w-2xl mx-auto my-16 p-8 rounded-2xl bg-gradient-to-b from-slate-700/20 to-slate-800/30 border border-slate-600/30 flex flex-col items-center text-center gap-4"
    >
      <h1 className="font-heading font-semibold text-2xl text-white">Sign in to your dashboard</h1>
      <p className="text-slate-300 max-w-md">
        Log in the same way you did when you joined (email, Google, or wallet) so your Citizenship
        shows up.
      </p>
      <button
        type="button"
        data-testid="dashboard-sign-in-button"
        onClick={onSignIn}
        className="gradient-2 rounded-full py-3 px-8 text-white font-medium"
      >
        Sign in
      </button>
    </div>
  )
}
