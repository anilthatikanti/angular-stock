import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import {
  emailPattern,
  passwordPattern,
} from '../../../shared/validation/form.validation';
import { PasswordModule } from 'primeng/password';
import { firebaseErrorMessages } from '../functions/authentication.function';
import { ToastService } from '../../../shared/services/toastService/toast.service';
import { AuthApiService } from '../../../shared/services/auth-api.service';
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PanelModule,
    ButtonModule,
    InputTextModule,
    RouterModule,
    PasswordModule,
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent implements OnInit {
  signupForm: FormGroup;
  isSignupButtonLoading: boolean = false;
  constructor(
    private authApi: AuthApiService,
    private router: Router,
    private toast: ToastService
  ) {
    let formBuilder: FormBuilder = new FormBuilder();
    this.signupForm = formBuilder.group({
      fullName: new FormControl('', [Validators.required]),
      email: new FormControl('', [
        Validators.required,
        Validators.pattern(emailPattern),
      ]),
      password: new FormControl('', [
        Validators.required,
        Validators.pattern(passwordPattern),
      ]),
      confirmPassword: new FormControl('', [
        Validators.required,
        this.confirmationValidator,
      ]),
    });
    this.signupForm.valueChanges.subscribe(() => {});
  }

  ngOnInit() {}

  get formControl() {
    return this.signupForm.controls;
  }

  confirmationValidator = (control: FormGroup): { [s: string]: boolean } => {
    if (!control.value) {
      return { required: true };
    } else if (control.value !== this.signupForm.controls['password'].value) {
      return { confirm: true, error: true };
    }
    return {};
  };

  updateConfirmValidator(): void {
    Promise.resolve().then(() =>
      this.signupForm.controls['confirmPassword'].updateValueAndValidity()
    );
  }

  async signupSubmit() {
    try {
      if (this.signupForm.valid) {
        this.isSignupButtonLoading = true;
        // The backend creates the account (with the name) and logs the user in; the
        // verify-email page then sends the verification email.
        await this.authApi.signup(
          this.formControl['fullName'].value,
          this.signupForm.value.email!,
          this.signupForm.value.password!
        );
        this.router.navigate([`/auth/verify-email`]);
      } else {
        Object.values(this.signupForm.controls).forEach((control) => {
          if (control.invalid) {
            control.markAsDirty();
            control.updateValueAndValidity({ onlySelf: true });
          }
        });
      }
    } catch (error: any) {
      console.error('signupSubmit [ERR] ', error);
      firebaseErrorMessages(error.code, this.toast.messageService!, error.message);
    } finally {
      this.isSignupButtonLoading = false;
    }
  }
}
