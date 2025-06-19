import { Component, HostListener, OnInit } from '@angular/core';
import { Response } from '../../shared/interface/response.interface';
import { Folder } from '../../shared/interface/folder-file/folder.interface';
import { CommonModule, DatePipe } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MoveFolderFileComponent } from '../move-folder-file/move-folder-file.component';
import { FileUploadModule } from 'primeng/fileupload';
import { IFile } from '../../shared/interface/folder-file/file.interface';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  combineLatest,
  debounceTime,
  firstValueFrom,
  switchMap,
  tap,
} from 'rxjs';
import { ToastService } from '../../shared/services/toastService/toast.service';
import { SERVER_URL } from '../../environments/environment';
import { Meta, Title } from '@angular/platform-browser';
@Component({
  selector: 'app-bin',
  standalone: true,
  imports: [
    ToastModule,
    InputTextModule,
    ButtonModule,
    FloatLabelModule,
    FormsModule,
    DatePipe,
    TableModule,
    CommonModule,
    DialogModule,
    ReactiveFormsModule,
    TooltipModule,
    SelectButtonModule,
    MoveFolderFileComponent,
    FileUploadModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './bin.component.html',
  styleUrl: './bin.component.css',
})
export class BinComponent implements OnInit {
  innerHeight!: number;
  tableData: (Folder | IFile)[] = [];
  currentFolderId!: string;
  currentFolder!: Folder;
  searchValue: string = '';
  image: any;

  restoreBtnLoadingId: string | null = null;
  deleteBtnLoadingId: string | null = null;

  restoreAllBtnLoading: boolean = false;
  deleteAllBtnLoading: boolean = false;
  tableLoading: boolean = true;
  @HostListener('window:resize', ['$event'])
  onResize(event?: any) {
    this.innerHeight = window.innerWidth;
  }
  constructor(
    private http: HttpClient,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
    private title: Title,
    private meta: Meta

  ) {
    this.tableLoading = false;
  }
    loadMeta() {
    this.title.setTitle('Bin | Angular Stock');
    this.meta.updateTag({
      name: 'description',
      content: 'Bin manage delete files and folders in you Angular Stock account'
    });
  }

  async ngOnInit() {
  this.onResize();
  this.loadMeta();

  combineLatest([
    this.activatedRoute.params,
    this.activatedRoute.queryParams,
  ])
    .pipe(
      tap(() => {
        this.tableLoading = true;
      }),
      debounceTime(50),
      switchMap(async ([params, queryParams]) => {
        try {
          const folderId = params['id'];

          // Redirect if not the bin folder
          if (folderId !== '64e4a5f7c25e4b0a2c9d5678') {
            this.router.navigate(['/bin', '64e4a5f7c25e4b0a2c9d5678'], {
              replaceUrl: true,
            });
            return;
          }

          this.currentFolderId = folderId;
          this.searchValue = queryParams['search'] || '';

          const apiUrl = this.searchValue
            ? `${SERVER_URL}/files/search?query=${this.searchValue}&currentFolderId=${this.currentFolderId}&global=false&from=bin`
            : `${SERVER_URL}/files/get-folder-file?parentFolderId=${this.currentFolderId}&from=bin`;

          const res: Response = await firstValueFrom(this.http.get<Response>(apiUrl));

          if (res?.success) {
            this.currentFolder = res.data.currentFolder;
            this.tableData = res.data.data;
          }
        } catch (error) {
          console.error('API Error:', error);
        } finally {
          this.tableLoading = false;
        }
      })
    )
    .subscribe();
}


  async deleteFolderFn(folder: Folder) {
    this.deleteBtnLoadingId = folder._id;
    try {
      const res: Response = await firstValueFrom(
        this.http.post<Response>(`${SERVER_URL}/files/delete-folder`, {
          id: folder._id,
        })
      );
      if (res?.success) {
        this.tableData = this.tableData.filter(
          (item) => item._id !== folder._id
        );
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'Folder Delete Success',
          detail: 'The folder has been successfully deleted.',
        });
      }
    } catch (e) {
      console.error('deleteFolderFn Error:', e);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'Folder Delete Error',
        detail: 'An error occurred while trying to delete the folder.',
      });
    } finally {
      this.deleteBtnLoadingId = null;
    }
  }

  async deleteFileFn(file: IFile) {
    this.deleteBtnLoadingId = file._id;
    try {
      const res: Response = await firstValueFrom(
        this.http.post<Response>(`${SERVER_URL}/files/delete-file`, {
          fileId: file._id,
          folderId: this.currentFolderId,
        })
      );
      if (res?.success) {
        this.tableData = this.tableData.filter((item) => item._id !== file._id);
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'File Delete Success',
          detail: 'The file has been successfully deleted.',
        });
      }
    } catch (e) {
      console.error('deleteFileFn Error:', e);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'File Delete Error',
        detail: 'An error occurred while trying to delete the file.',
      });
    } finally {
      this.deleteBtnLoadingId = null;
    }
  }

  async permanentDeleteAll() {
    this.deleteAllBtnLoading = true;
    try {
      const res: Response = await firstValueFrom(
        this.http.delete<Response>(`${SERVER_URL}/files/delete-all`)
      );
      if (res?.success) {
        this.tableData = [];
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'Folder Restore Success',
          detail: 'The folder has been successfully restored.',
        });
      }
    } catch (error) {
      +console.error('permanentDeleteAll Error:', error);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'All Delete Error',
        detail: 'An error occurred while trying to delete the all permanently.',
      });
    }finally {
      this.deleteAllBtnLoading = false;
    }
  }

  async restoreFolderFn(folder: Folder) {
    this.restoreBtnLoadingId = folder._id;
    try {
      const res: Response = await firstValueFrom(
        this.http.put<Response>(`${SERVER_URL}/files/restore-folder`, {
          folderId: folder._id,
        })
      );
      if (res?.success) {
        this.tableData = this.tableData.filter(
          (item) => item._id !== folder._id
        );
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'Folder Restore Success',
          detail: 'The folder has been successfully restored.',
        });
      }
    } catch (err) {
      console.error('restoreFolderFn Error:', err);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'Folder Restore Error',
        detail: 'An error occurred while trying to restore the folder.',
      });
    }finally {
      this.restoreBtnLoadingId = null;
    }
  }

  async restoreFileFn(file: IFile) {
    this.restoreBtnLoadingId = file._id;
    try {
      const res: Response = await firstValueFrom(
        this.http.put<Response>(`${SERVER_URL}/files/restore-file`, {
          fileId: file._id,
        })
      );
      if (res?.success) {
        this.tableData = this.tableData.filter((item) => item._id !== file._id);
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'File Restore Success',
          detail: 'The file has been successfully restored.',
        });
      }
    } catch (e) {
      console.error('restoreFileFn Error:', e);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'File Restore Error',
        detail: 'An error occurred while trying to restore the file.',
      });
    } finally {
      this.restoreBtnLoadingId = null;
    }
  }

  async restoreAll() {
    try {
      this.restoreAllBtnLoading = true;
      const res: Response = await firstValueFrom(
        this.http.put<Response>(`${SERVER_URL}/files/restore-all`, null)
      );
      if (res?.success) {
        this.tableData = [];
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'File Restore Success',
          detail: 'The file has been successfully restored.',
        });
      }
    } catch (e) {
      console.error('restoreAll Error:', e);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'All Restore Error',
        detail: 'An error occurred while trying to restore the all.',
      });
    }finally {
      this.restoreAllBtnLoading = false;
    }
  }

  searchFn(search: string): void {
    this.appendQuery({
      search: search?.trim() ? search : undefined,
    });
  }

  appendQuery(query: { [key: string]: any }): void {
    this.router.navigate([], {
      queryParams: { ...query },
      queryParamsHandling: 'merge',
    });
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`; // Bytes
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`; // Kilobytes
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`; // Megabytes
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`; // Gigabytes
  }
}
