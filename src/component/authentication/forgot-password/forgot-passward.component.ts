import { Component } from '@angular/core';
import { AuthApiService } from '../../../shared/services/auth-api.service';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import {
  firebaseErrorMessages,
  logoutUser,
} from '../functions/authentication.function';
import { ToastService } from '../../../shared/services/toastService/toast.service';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { emailPattern } from '../../../shared/validation/form.validation';

@Component({
  selector: 'app-forgot-passward',
  standalone: true,
  imports: [ReactiveFormsModule, PasswordModule, ButtonModule, InputTextModule],
  templateUrl: './forgot-passward.component.html',
  styleUrl: './forgot-passward.component.css',
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;
  isResetPasswordButtonLoading: boolean = false;
  isMailSent: boolean = false;
  isResendButtonDisabled: boolean = true;
  isEmailNotRegistered: boolean = false;
  timer: number = 60;
  timerId!: any;

  constructor(
    private authApi: AuthApiService,
    private toast: ToastService,
    private router: Router
  ) {
    let formBuilder: FormBuilder = new FormBuilder();
    this.forgotPasswordForm = formBuilder.group({
      email: [null, [Validators.required, Validators.pattern(emailPattern)]],
    });
  }
  get email() {
    return this.forgotPasswordForm.get('email');
  }
  async forgotPassword() {
    if (this.isResetPasswordButtonLoading) return; // ignore repeat clicks
    try {
      this.isEmailNotRegistered = false;
      if (this.forgotPasswordForm.valid) {
        this.isResetPasswordButtonLoading = true;
        // Backend sends the reset email; it answers the same way whether or not the
        // email has an account.
        await this.authApi.forgotPassword(
          this.forgotPasswordForm.controls['email'].value
        );
        this.isMailSent = true;
        this.startTimer();
      } else {
        Object.values(this.forgotPasswordForm.controls).forEach((control) => {
          if (control.invalid) {
            control.markAsDirty();
            control.updateValueAndValidity({ onlySelf: true });
          }
        });
      }
    } catch (error: any) {
      // if (error.code == 'auth/user-not-found') {
      //   this.isEmailNotRegistered = true;
      // } else {
      firebaseErrorMessages(error.code, this.toast.messageService!, error.message);
      // }
      console.error('forgotPassword [ERR]: ', error);
    } finally {
      this.isResetPasswordButtonLoading = false;
    }
  }

  startTimer() {
    this.isResendButtonDisabled = true;
    this.timer = 60;
    this.timerId = setInterval(() => {
      this.timer = this.timer - 1;
      if (this.timer === 0) {
        clearInterval(this.timerId);
        this.isResendButtonDisabled = false;
      }
    }, 1000);
  }

  onClickBackToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
