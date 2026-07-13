import { redirect } from 'next/navigation';

// Version B is now the main experience at `/`. Keep this path working for
// anyone with an old /v2 link (user-test bookmarks, shared URLs).
export default function V2Redirect() {
  redirect('/');
}
