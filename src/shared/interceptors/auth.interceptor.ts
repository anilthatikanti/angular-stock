import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { catchError, from, mergeMap, take, throwError } from 'rxjs';
import { SERVER_URL } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only our own backend gets the Firebase login token; requests to any other host
  // (CDNs, S3 links, third-party APIs) are sent without it.
  if (!req.url.startsWith(SERVER_URL)) {
    return next(req);
  }

  const auth = inject(Auth); // Inject Auth in a function-based approach

  return user(auth).pipe(
    take(1),
    mergeMap((firebaseUser) =>
      firebaseUser
        ? from(firebaseUser.getIdToken()).pipe(
            mergeMap((token) =>
              next(
                req.clone({
                  setHeaders: { Authorization: `Bearer ${token}` },
                })
              )
            )
          )
        : next(req)
    ),
    catchError((err) => {
      console.error('HTTP error:', err.status, err.error?.message || err.message);
      return throwError(() => err);
    })
  );
};
