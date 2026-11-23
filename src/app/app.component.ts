import { AfterViewInit, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { Auth, connectAuthEmulator } from '@angular/fire/auth';
import { connectStorageEmulator, Storage } from '@angular/fire/storage';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ToastService } from '../shared/services/toastService/toast.service';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule],
  template: `<p-toast /> <router-outlet></router-outlet>`,
})
export class AppComponent implements AfterViewInit {
  constructor(
    firebaseAuth: Auth,
    firebaseStorage: Storage,
    toast: ToastService,
    messageService: MessageService,
    titleService: Title
  ) {
    titleService.setTitle(`Angular-stock | ${0.01}`);
    toast.messageService = messageService;

    if (environment.useEmulators) {
      console.log('environment.useEmulators', environment.useEmulators);
      connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099');
      connectStorageEmulator(firebaseStorage, '127.0.0.1', 9199);
    }
  }
  ngAfterViewInit(): void {
    this.clearFirebaseWarningTag();
  }

  clearFirebaseWarningTag() {
    const firebaseWarningTag = document.querySelector(
      '.firebase-emulator-warning'
    ) as HTMLElement;

    if (firebaseWarningTag) {
      firebaseWarningTag.remove();
    }
  }
}
