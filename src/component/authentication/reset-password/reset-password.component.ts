import { Component } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { passwordPattern } from '../../../shared/validation/form.validation';
import { AuthApiService } from '../../../shared/services/auth-api.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../../shared/services/toastService/toast.service';
import { firebaseErrorMessages } from '../functions/authentication.function';

@Component({
  selector: 'app-reset-paswword',
  standalone: true,
  imports: [ReactiveFormsModule, PasswordModule, ButtonModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPaswwordComponent {
  resetPasswordForm: FormGroup;
  isFormSubmitted: boolean = false;
  oobCode!: string;
  isPasswordResetSuccess: boolean = false;
  isSetNewPasswordButtonLoading: Boolean = false;
  constructor(
    private authApi: AuthApiService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private toast: ToastService
  ) {
    this.oobCode = this.activatedRoute.snapshot.queryParams['oobCode'] ?? '';
    let formBuilder: FormBuilder = new FormBuilder();
    this.resetPasswordForm = formBuilder.group({
      password: new FormControl('', [
        Validators.required,
        Validators.pattern(passwordPattern),
      ]),
      confirmPassword: new FormControl('', [
        Validators.required,
        this.confirmationValidator,
      ]),
    });
  }

  get formControl() {
    return this.resetPasswordForm.controls;
  }
  confirmationValidator = (control: FormGroup): { [s: string]: boolean } => {
    if (!control.value) {
      return { required: true };
    } else if (
      control.value !== this.resetPasswordForm.controls['password'].value
    ) {
      return { confirm: true, error: true };
    }
    return {};
  };

  updateConfirmValidator(): void {
    Promise.resolve().then(() =>
      this.resetPasswordForm.controls[
        'confirmPassword'
      ].updateValueAndValidity()
    );
  }

  async resetPassword() {
    try {
      this.isFormSubmitted = true;
      if (this.resetPasswordForm.valid) {
        this.isSetNewPasswordButtonLoading = true;
        await this.authApi.resetPassword(
          this.oobCode,
          this.formControl['password'].value
        );
        this.isPasswordResetSuccess = true;
      }
    } catch (error: any) {
      console.error('resetPassword [ERR]: ', error);
      if (error.code == 'auth/invalid-action-code') {
        this.router.navigate(['/auth/login']);
      }
      firebaseErrorMessages(error.code, this.toast.messageService!, error.message);
    } finally {
      this.isSetNewPasswordButtonLoading = false;
    }
  }
  onClickBackToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
