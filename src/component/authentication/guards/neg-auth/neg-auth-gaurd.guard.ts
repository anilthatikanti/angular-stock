import { inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

// Login/signup pages: a verified, logged-in user goes to the app instead.
// Reads the login state once (no listener left behind).
export const negAuthGuard: CanActivateFn = async () => {
  const firebaseAuth = inject(Auth);
  const router = inject(Router);

  const user = await firstValueFrom(authState(firebaseAuth));
  return user?.emailVerified ? router.createUrlTree(['']) : true;
};
