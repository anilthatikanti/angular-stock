import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Auth, signInWithCustomToken } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { SERVER_URL } from '../../environments/environment';

// Error thrown by AuthApiService: `code` uses the same auth/... names as Firebase, so the
// existing firebaseErrorMessages() toasts keep working; `message` comes from the backend.
export interface AuthApiError {
  code: string;
  message?: string;
}

/**
 * Login, sign-up, email verification and password reset go through the backend
 * (/auth/*), which talks to Firebase Authentication on the server. After login/sign-up
 * the backend returns a Firebase custom token; signing in with it gives the app the same
 * Firebase user/ID token as before, so guards, the HTTP interceptor and the live feed
 * are unchanged. Google/Microsoft sign-in still use the Firebase popup in the browser.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly base = `${SERVER_URL}/auth`;

  constructor(private http: HttpClient, private firebaseAuth: Auth) {}

  private async post<T>(path: string, body: unknown = {}): Promise<T> {
    try {
      return await firstValueFrom(this.http.post<T>(`${this.base}/${path}`, body));
    } catch (error) {
      const err = error as HttpErrorResponse;
      const apiError: AuthApiError = err.status === 0
        ? { code: 'auth/network-request-failed' }
        : { code: err.error?.code || 'auth/internal-error', message: err.error?.message };
      throw apiError;
    }
  }

  async login(email: string, password: string) {
    const res = await this.post<{ customToken: string; emailVerified: boolean }>('login', { email, password });
    await signInWithCustomToken(this.firebaseAuth, res.customToken);
    return { emailVerified: res.emailVerified };
  }

  async signup(fullName: string, email: string, password: string) {
    const res = await this.post<{ customToken: string }>('signup', { fullName, email, password });
    await signInWithCustomToken(this.firebaseAuth, res.customToken);
  }

  // Uses the logged-in user's ID token (added by the HTTP interceptor).
  sendVerificationEmail() {
    return this.post<{ alreadyVerified?: boolean }>('send-verification');
  }

  verifyEmail(oobCode: string) {
    return this.post('verify-email', { oobCode });
  }

  forgotPassword(email: string) {
    return this.post('forgot-password', { email });
  }

  resetPassword(oobCode: string, newPassword: string) {
    return this.post('reset-password', { oobCode, newPassword });
  }
}
