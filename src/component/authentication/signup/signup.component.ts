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
import {
  Auth,
  createUserWithEmailAndPassword,
  updateProfile,
} from '@angular/fire/auth';
import { firebaseErrorMessages } from '../functions/authentication.function';
import { ToastService } from '../../../shared/services/toastService/toast.service';
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
    private firebaseAuth: Auth,
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
        const userDetails = await createUserWithEmailAndPassword(
          this.firebaseAuth,
          this.signupForm.value.email!,
          this.signupForm.value.password!
        );
        if (userDetails) {
          await updateProfile(this.firebaseAuth.currentUser!, {
            displayName: this.formControl['fullName'].value,
          });
          this.router.navigate([`/auth/verify-email`]);
        } else {
          throw { code: 'signup-failed' };
        }
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
      firebaseErrorMessages(error.code, this.toast.messageService!);
    } finally {
      this.isSignupButtonLoading = false;
    }
  }
}
