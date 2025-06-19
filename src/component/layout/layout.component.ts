import { Component, OnInit } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { Router, RouterOutlet } from '@angular/router';
import { DividerModule } from 'primeng/divider';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ToastModule } from 'primeng/toast';
import { StockService } from '../../shared/services/stock.service';
import { getAvatarLetters } from '../authentication/functions/helper.function';
import {
  Auth,
  AuthCredential,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  getIdToken,
  idToken,
  reauthenticateWithCredential,
  signInWithCredential,
  updatePassword,
} from '@angular/fire/auth';
import {
  firebaseErrorMessages,
  logoutUser,
} from '../authentication/functions/authentication.function';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { passwordPattern } from '../../shared/validation/form.validation';
import { ToastService } from '../../shared/services/toastService/toast.service';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    AvatarModule,
    OverlayPanelModule,
    ButtonModule,
    MenuModule,
    RouterOutlet,
    DividerModule,
    ConfirmPopupModule,
    ToastModule,
    DialogModule,
    PasswordModule,
    ReactiveFormsModule,
    CommonModule,
    NgOptimizedImage
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit {
  items: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi pi-home',
      routerLink: '/dashboard',
    },
    // {
    //   label: 'Performance',
    //   icon: 'pi pi-chart-line',
    //   routerLink: '/performance',
    // },
    {
      label: 'Storage',
      icon: 'pi pi-database',
      routerLink: '/storage/64e4a5f7c25e4b0a2c9d1234',
    },
    {
      label: 'Bin',
      icon: 'pi pi-trash',
  routerLink:'/bin/64e4a5f7c25e4b0a2c9d5678'
    },
    // {
    //   label: 'Settings',
    //   icon: 'pi pi-cog',
    //   routerLink: '/settings',
    // },
  ];

  changePassword: boolean = false;
  changePasswordForm: FormGroup;
  userHasPassword: boolean = false;
  constructor(
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private firebaseAuth: Auth,
    private toast: ToastService,
    private router: Router,private meta: Meta, private title: Title
  ) {
    
    let formBuilder: FormBuilder = new FormBuilder();
    this.changePasswordForm = formBuilder.group({
      currentPassword: new FormControl('', [
        Validators.required,
        Validators.pattern(passwordPattern),
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
  }

  loadMeta() {
    this.title.setTitle('Layout | Angular Stock');
    this.meta.updateTag({
      name: 'description',
      content: 'Layout to your Angular Stock account to manage structure'
    });
  }

  async ngOnInit() {
    this.loadMeta()
    let res = await fetchSignInMethodsForEmail(
      this.firebaseAuth,
      this.firebaseAuth.currentUser?.email ?? ''
    );
    this.userHasPassword = res.includes('password');
  }

  get formControl() {
    return this.changePasswordForm.controls;
  }

  confirmationValidator = (control: FormGroup): { [s: string]: boolean } => {
    if (!control.value) {
      return { required: true };
    } else if (
      control.value !== this.changePasswordForm.controls['password'].value
    ) {
      return { confirm: true, error: true };
    }
    return {};
  };

  updateConfirmValidator(): void {
    Promise.resolve().then(() =>
      this.changePasswordForm.controls[
        'confirmPassword'
      ].updateValueAndValidity()
    );
  }

  async updatePassword() {
    try {
      if (this.changePasswordForm.valid) {
        if (this.userHasPassword) {
          await this.changePasswordFn();
        } else {
          await this.createPassword();
        }
      } else {
        Object.values(this.changePasswordForm.controls).forEach((control) => {
          if (control.invalid) {
            control.markAsDirty();
            control.updateValueAndValidity({ onlySelf: true });
          }
        });
      }
    } catch (error: any) {
      console.log('updatePassword [ERR]: ', error);
      firebaseErrorMessages(error.code, this.toast.messageService!);
    }
  }

  async changePasswordFn() {
    try {
      if (this.changePasswordForm.valid) {
        let creadentials: AuthCredential = EmailAuthProvider.credential(
          this.firebaseAuth.currentUser?.email ?? '',
          this.changePasswordForm.controls['currentPassword'].value ?? ''
        );
        if (this.firebaseAuth.currentUser) {
          await reauthenticateWithCredential(
            this.firebaseAuth.currentUser,
            creadentials
          );
          await updatePassword(
            this.firebaseAuth.currentUser,
            this.changePasswordForm.controls['password'].value
          );

          const newUserCredential = EmailAuthProvider.credential(
            this.firebaseAuth.currentUser?.email ?? '',
            this.changePasswordForm.controls['password'].value ?? ''
          );
          await signInWithCredential(this.firebaseAuth, newUserCredential);
          this.toast.messageService!.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Password updated',
          });
          this.changePassword = false;
        }
      }
    } catch (error: any) {
      console.log('changePasswordFn [ERR]: ', error);
      firebaseErrorMessages(error.code, this.toast.messageService!);
    }
  }

  async createPassword() {
    try {
      if (this.firebaseAuth.currentUser) {
        await updatePassword(
          this.firebaseAuth.currentUser,
          this.changePasswordForm.controls['password'].value
        );
      }
      const newUserCredential = EmailAuthProvider.credential(
        this.firebaseAuth.currentUser?.email ?? '',
        this.changePasswordForm.controls['password'].value ?? ''
      );
      await signInWithCredential(this.firebaseAuth, newUserCredential);
      this.toast.messageService!.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Password updated',
      });

      this.changePassword = false;
    } catch (error: any) {
      console.log('createPassword [ERR]:', error);
      firebaseErrorMessages(error.code, this.toast.messageService!);
    }
  }

  userLogoutEvent() {
    this.onClickBackToLogin();
    this.messageService.add({
      severity: 'success',
      summary: 'Logout success',
      detail: 'Logout user',
    });
  }
  getUserAvatarName(type?: string) {
    if (type === 'avatar') {
      return getAvatarLetters(this.firebaseAuth.currentUser?.displayName ?? '');
    } else if (type === 'fullName') {
      return this.firebaseAuth.currentUser?.displayName ?? '';
    } else {
      return this.firebaseAuth.currentUser?.email ?? '';
    }
  }
  onClickBackToLogin() {
    logoutUser(this.firebaseAuth, false);
  }

  isLinkActive(routerLink: string): boolean {
    const currentUrl = this.router.url;
    const parts = routerLink.split('/');
    return currentUrl.startsWith(parts[0]+'/'+parts[1]);
  }
}
