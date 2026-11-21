import { inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

// Reads the login state ONCE per navigation. (It used to register a new
// onAuthStateChanged listener on every navigation and never remove it, so old
// listeners kept firing redirects; it also logged the user object, which contains
// tokens, to the console.)
export const authGuard: CanActivateFn = async (route, state) => {
  const firebaseAuth = inject(Auth);
  const router = inject(Router);

  const user = await firstValueFrom(authState(firebaseAuth));
  const onVerifyPage = state.url.includes('/auth/verify-email');

  if (user) {
    if (user.emailVerified) {
      return onVerifyPage ? router.createUrlTree(['']) : true;
    }
    return onVerifyPage ? true : router.createUrlTree(['/auth/verify-email']);
  }

  // Not logged in: only the email-verification link (with its oobCode) may open the page.
  if (onVerifyPage && state.root.queryParams['oobCode']) {
    return true;
  }
  return router.createUrlTree(['/auth/login']);
};
