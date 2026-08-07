import { redirect } from 'next/navigation';

// There is no standalone /signup page — the login screen hosts both sign-in and
// sign-up via a toggle. A typed or linked /signup used to hit a bare 404; send it
// to the login screen pre-switched to the sign-up form.
export default function SignupRedirect() {
  redirect('/login?mode=signup');
}
