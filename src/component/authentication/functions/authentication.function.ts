import {
  Auth,
  getAuth,
  sendEmailVerification,
  signOut,
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { environment, WEB_APP_URL } from '../../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

/**
 *
 * Handles all firebase auth related error messages and displays appropriate toasts.
 */
export const firebaseErrorMessages = (
  message: string,
  messageService: MessageService
) => {
  messageService.clear();
  switch (message) {
    case 'auth/account-exists-with-different-credential':
      messageService.add({
        severity: 'warning',
        summary: 'Warning',
        detail: 'This email signed up using different method.',
      });
      break;
    case 'auth/user-not-found':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'This email address is not registered.',
      });
      break;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Invalid credentials or wrong login method.',
      });
      break;
    case 'auth/too-many-requests':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'You’ve reached the maximum attempts. Try after some time.',
      });
      break;
    case 'auth/email-already-in-use':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'User already exists. Please try to login.',
      });
      break;
    case 'auth/network-request-failed':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Check the internet connection.',
      });
      break;
    case 'auth/invalid-action-code':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail:
          'Your request to verify your email has expired or the link has already been used',
      });
      break;
    case 'auth/invalid-email':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Please check your email address for typos.',
      });
      break;
    case 'auth/internal-error':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Something went wrong. Try again later.',
      });
      break;
    // case 'verify-email-failed':
    //   messageService.add({
    //     severity: 'error',
    //     summary: 'Error',
    //     detail: 'Failed to send the verification email. Try again later',
    //   });
    //   break;
    case 'auth/cancelled-popup-request':
      break;
    case 'auth/popup-closed-by-user':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Popup closed before process completion',
      });
      break;
    case 'signup-failed':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to signup. Try again later',
      });
      break;
    case 'agreement-failed':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Please agree the TOS & Privacy policy',
      });
      break;
    case 'user-creation-failed':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to create user. Try again later',
      });
      break;
    default:
      console.error('@@ firebaseErrorMessages [ERR]', message);
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Something went wrong. Try again later.',
      });
  }
};

/**
 *
 * Handles all firebase mobile registration related error messages and displays appropriate toasts.
 */
export const mobileVerificationErrors = (
  code: string,
  messageService: MessageService
) => {
  switch (code) {
    case 'auth/invalid-verification-code':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Invalid OTP!',
      });
      break;
    case 'no-already-exists':
    case 'auth/account-exists-with-different-credential':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'The user already exist by this mobile number.',
      });
      break;
    case 'auth/code-expired':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'OTP expired!',
      });
      break;
    case 'auth/too-many-requests':
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Too many attempts. Please try after some time.',
      });
      break;
    default:
      messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Something went wrong. Try again later.',
      });
  }
};

/**
 * This will logout the user and reload the entire app once to ensure that the service variables
 * were reset properly.
 */
export const logoutUser = async (firebaseAuth: Auth, force: boolean = true) => {
  try {
    await signOut(firebaseAuth);
    if (force) {
      window.location.reload();
    }
  } catch (error: any) {
    console.error('logoutUser: [ERR]', error.message);
  }
};

/**
 * This is will send the verification link in the register email address.
 *
 * @param auth
 * @param messageService
 */
export const sendUserEmailVerificationLink = async (
  appUrl: string,
  auth: Auth,
  messageService: MessageService
) => {
  let actionCodeSettings = {
    url: environment.production ? `https://${appUrl}` : WEB_APP_URL,
    handleCodeInApp: true,
  };
  try {
    if (environment.useEmulators) {
      await sendEmailVerification(auth.currentUser!);
    } else {
      await sendEmailVerification(auth.currentUser!, actionCodeSettings);
    }
    messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Verification email has been sent to your email address',
    });
    return true;
  } catch (error: any) {
    console.error('sendUserEmailVerificationLink: [ERR]: ', error.message);
    messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to send the verification email. Try again later',
    });
    return false;
  }
};

/**
 * A function to create user document in mongodb after the successful user creation in the firebase.
 * @param firebaseAuth
 * @param http
 */
// export const createUser = async (firebaseAuth: Auth, http: HttpClient) => {
//   try {
//     const accessToken = await firebaseAuth.currentUser?.getIdToken();
//     const header = new HttpHeaders({
//       authorization: `Bearer ${accessToken}`,
//     });

//     let createUserResponse: any = await lastValueFrom(
//       http.get(`${SERVER_URL}/createUser`, {
//         headers: header,
//       })
//     );
//     return createUserResponse;
//   } catch (error: any) {
//     console.error('createUser [ERR]: ', error);
//     return null;
//   }
// };

/**
 * A function to verify that the given mobile number is already registered with another an account.
 *
 * This send http request the node server and server will check it by using firebase admin sdk.
 * @param firebaseAuth
 * @param http
 * @param mobile
 */
// export const verifyMobileNumberAlreadyExists = async (
//   firebaseAuth: Auth,
//   http: HttpClient,
//   mobile: string
// ): Promise<boolean> => {
//   try {
//     const accessToken = await firebaseAuth.currentUser?.getIdToken();
//     const header = new HttpHeaders({
//       authorization: `Bearer ${accessToken}`,
//     });

//     const body = {
//       mobileNumber: mobile,
//     };

//     let response: any = await lastValueFrom(
//       http.post(`${SERVER_URL}/checkUserIdentifiers`, body, {
//         headers: header,
//       })
//     );
//     return response?.status ?? false;
//   } catch (error: any) {
//     console.error('verifyMobileNumberAlreadyExists [ERR]: ', error);
//     return false;
//   }
// };
