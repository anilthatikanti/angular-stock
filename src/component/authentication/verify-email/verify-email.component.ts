import { Component, OnDestroy, OnInit } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import {
  logoutUser,
  sendUserEmailVerificationLink,
} from '../functions/authentication.function';
import { applyActionCode, Auth } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { WEB_APP_URL } from '../../../environments/environment';
import { ToastService } from '../../../shared/services/toastService/toast.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css',
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  email!: string;
  mode: string = '';
  oobCode: string = '';
  apiKey: string = '';
  continueUrl: string = '';
  isVerifyEmailSend: Boolean = false;

  isResendButtonDisabled: boolean = true;
  timer: number = 60;
  timerId!: any;
  emailVerified: boolean = false;
  emailVerificationFailureMessage: string = '';
  private verifyPollId?: ReturnType<typeof setInterval>;

  constructor(
    private firebaseAuth: Auth,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe((params) => {
      this.mode = params['mode'] ?? 'checkInbox';
      this.oobCode = params['oobCode'];
      this.apiKey = params['apiKey'];
      this.continueUrl = params['continueUrl'] ?? WEB_APP_URL;
    });

    this.emailVerifyComponentInit();
  }

  async emailVerifyComponentInit() {
    this.userEmailVerifyStatusCheck();
    switch (this.mode) {
      case 'checkInbox':
        await this.onClickResendVerificationLink();
        break;
      case 'resetPassword':
        this.router.navigate([`/auth/reset-password`], {
          queryParams: { oobCode: `${this.oobCode}` },
        });
        break;
      case 'verifyEmail':
        await this.applyVerificationCode();
        break;
      case 'emailVerifyFailed':
        break;
      default:
        this.router.navigate(['']);
    }
  }

  // Polls until the email is verified, then reloads so the guard sends the user to the
  // dashboard. The backend creates the user record on the first authenticated API call,
  // so no extra request is needed here. (It used to POST to a hard-coded
  // http://localhost:3000/user/create-user, which failed in production before the
  // redirect and left users stuck on this page.)
  userEmailVerifyStatusCheck() {
    this.stopVerifyPolling();
    this.verifyPollId = setInterval(async () => {
      try {
        const user = this.firebaseAuth.currentUser;
        if (!user) return;
        await user.reload();
        if (user.emailVerified) {
          this.stopVerifyPolling();
          await user.getIdToken(true); // refresh so the token carries email_verified
          window.location.href = this.router.url || WEB_APP_URL;
        }
      } catch (error) {
        console.error('Error in userEmailVerifyStatusCheck:', error);
      }
    }, 3000);
  }

  private stopVerifyPolling() {
    if (this.verifyPollId) {
      clearInterval(this.verifyPollId);
      this.verifyPollId = undefined;
    }
  }

  ngOnDestroy(): void {
    this.stopVerifyPolling();
  }

  async applyVerificationCode() {
    try {
      await applyActionCode(this.firebaseAuth, this.oobCode);
      this.mode = 'emailVerifySuccess';
    } catch (error: any) {
      console.error('verifyEmail: [ERR] ', error);
      if (error.code == 'auth/invalid-action-code') {
        this.emailVerificationFailureMessage =
          'Either your verification link has expired or the link has already been used';
      } else {
        this.emailVerificationFailureMessage =
          "Unfortunately, we couldn't verify your email. Please try again.";
      }
      this.mode = 'emailVerifyFailed';
    }
  }

  async onClickResendVerificationLink() {
    if (this.firebaseAuth.currentUser?.emailVerified) {
      window.location.href = `${this.continueUrl}`;
      return;
    }
    let isEmailSent = await sendUserEmailVerificationLink(
      window.location.host,
      this.firebaseAuth,
      this.toast.messageService!
    );
    if (isEmailSent) {
      this.startTimer();
    } else {
      await logoutUser(this.firebaseAuth);
    }
  }

  startTimer() {
    this.isVerifyEmailSend = true;
    this.isResendButtonDisabled = true;
    this.timer = 60;
    this.timerId = setInterval(() => {
      this.timer = this.timer - 1;
      if (this.timer === 0) {
        clearInterval(this.timerId);
        this.isResendButtonDisabled = false;
        this.isVerifyEmailSend = false;
      }
    }, 1000);
  }

  onClickBackToLogin() {
    logoutUser(this.firebaseAuth, false);
    this.router.navigate(['/auth/login']);
  }
}
