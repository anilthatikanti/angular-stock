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
import { emailPattern } from '../../../shared/validation/form.validation';
import { PasswordModule } from 'primeng/password';
import {
  Auth,
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
} from '@angular/fire/auth';

import { ToastService } from '../../../shared/services/toastService/toast.service';
import { AuthApiService } from '../../../shared/services/auth-api.service';
import { firebaseErrorMessages } from '../functions/authentication.function';
import { NgOptimizedImage } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PanelModule,
    ButtonModule,
    InputTextModule,
    RouterModule,
    PasswordModule,
    NgOptimizedImage
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;

  passwordRemember: boolean = true;

  constructor(
    private firebaseAuth: Auth,
    private toast: ToastService,
    private router: Router,
    private title: Title,
    private meta: Meta,
    private authApi: AuthApiService
  ) {
    let formBuilder: FormBuilder = new FormBuilder();
    this.loginForm = formBuilder.group({
      email: [null, [Validators.required, Validators.pattern(emailPattern)]],
      password: [null, [Validators.required]],
    });
  }

  get email() {
    return this.loginForm.get('email');
  }
  get password() {
    return this.loginForm.get('password');
  }

  ngOnInit() {
    this.loadMeta();
  }

    loadMeta() {
    this.title.setTitle('Login | Angular Stock');
    this.meta.updateTag({
      name: 'description',
      content: 'This page allow you to login into the application',
    });
  }

  async loginSubmit() {
    try {
      if (this.loginForm.valid) {
        // Password is checked by the backend (/auth/login), not in the browser.
        await this.authApi.login(
          this.loginForm.value.email,
          this.loginForm.value.password
        );
        this.toast.messageService!.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Login Successful',
        });
        this.router.navigate(['']);

        /**After submitting the valid form the login function will trigger*/
      } else {
        Object.values(this.loginForm.controls).forEach((control) => {
          if (control.invalid) {
            control.markAsDirty();
            control.updateValueAndValidity({ onlySelf: true });
          }
        });
      }
    } catch (error: any) {
      console.error('onClickLogin [ERR]: ', error);
      firebaseErrorMessages(error.code, this.toast.messageService!, error.message);
    }
  }

  async onGoogleSignup() {
    try {
      const provider = new GoogleAuthProvider();
      const auth = getAuth();

      provider.setCustomParameters({
        prompt: 'select_account',
      });
      const result = await signInWithPopup(auth, provider);
      const userMetadata = result.user.metadata;

      if (userMetadata.creationTime === userMetadata.lastSignInTime) {
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Account created successfully.',
        });
      } else {
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Login successful',
        });
      }
      // this.router.navigate(['']);
    } catch (error: any) {
      console.error('onGoogleSignup [ERR]: ', error);
      firebaseErrorMessages(error.code, this.toast.messageService!);
    } finally {
    }
  }

  async onMicrosoftSignup() {
    try {
      const provider = new OAuthProvider('microsoft.com');
      const auth = getAuth();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      let result = await signInWithPopup(auth, provider);
      const credential = OAuthProvider.credentialFromResult(result);
    } catch (error: any) {
      console.error('onMicrosoftSignup [ERR]: ', error);
      firebaseErrorMessages(error.code, this.toast.messageService!);
    }
  }
}
