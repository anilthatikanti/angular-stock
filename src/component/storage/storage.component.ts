import { Component, HostListener, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
  combineLatest,
  debounceTime,
  firstValueFrom,
  switchMap,
  tap,
} from 'rxjs';
import { Response } from '../../shared/interface/response.interface';
import { Folder } from '../../shared/interface/folder-file/folder.interface';
import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MoveFolderFileComponent } from '../move-folder-file/move-folder-file.component';
import {
  FileSelectEvent,
  FileUploadEvent,
  FileUploadModule,
} from 'primeng/fileupload';
import { IFile } from '../../shared/interface/folder-file/file.interface';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastService } from '../../shared/services/toastService/toast.service';
import { SERVER_URL } from '../../environments/environment';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-storage',
  standalone: true,
  providers: [AsyncPipe],
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
  templateUrl: './storage.component.html',
  styleUrl: './storage.component.css',
})
export class StorageComponent implements OnInit {
  innerHeight!: number;
  @HostListener('window:resize', ['$event'])
  onResize(event?: any) {
    this.innerHeight = window.innerWidth;
  }
  value: string | undefined;
  tableData: Folder[] = [];
  currentFolderId: string | undefined;
  editForm!: FormGroup;
  currentFolder!: Folder;
  searchValue: string = '';
  stateOptions: any[] = [
    { label: 'Global', value: true },
    { label: 'Folder', value: false },
  ];
  image: any;

  editItem: Folder | IFile | null = null;
  moveItem: Folder | null = null;
  isCopyBtnLoading: string | null = null;
  deleteItemId: string | null = null;

  createFolderModelOpen: boolean = false;
  tableLoading: boolean = false;
  createFolderBtnLoading: boolean = false;
  uploadFileBtnLoading: boolean = false;
  GlobalSearch: boolean = false;
  constructor(
    private activatedRoute: ActivatedRoute,
    private http: HttpClient,
    private router: Router,
    private toast: ToastService,
    private title: Title,
    private meta: Meta
  ) {
    const formBuilder: FormBuilder = new FormBuilder();
    this.editForm = formBuilder.group({
      name: ['', [Validators.required]],
    });
  }

  get Form() {
    return this.editForm.controls['name'];
  }

    loadMeta() {
    this.title.setTitle('Storage | Angular Stock');
    this.meta.updateTag({
      name: 'description',
      content: 'Storage is work for your Angular Stock account to manage files and folders',
    });
  }
  ngOnInit() {
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
          // Update state
          this.currentFolderId = params['id'] || this.currentFolderId;
          this.GlobalSearch = queryParams['global'] === 'true';
          this.searchValue = queryParams['search'] || '';

          // Build URL
          const apiUrl = this.searchValue
            ? `${SERVER_URL}/files/search?query=${this.searchValue}&currentFolderId=${this.currentFolderId}&global=${queryParams['global']}`
            : `${SERVER_URL}/files/get-folder-file?parentFolderId=${this.currentFolderId}`;

          const res: Response = await firstValueFrom(
            this.http.get<Response>(apiUrl)
          );

          if (res?.success) {
            this.currentFolder = res.data.currentFolder;

            if (this.currentFolder?.isDeleted) {
              this.router.navigate(['/storage', '64e4a5f7c25e4b0a2c9d1234'], {
                replaceUrl: true,
              });
              return;
            } else {
              this.tableData = res.data.data;;
            }
          }
        } catch (error) {
          console.error('API Error:', error);
        } finally {
          this.tableLoading = false; // Ensure this always runs
        }
      })
    )
    .subscribe();
}


  async uploadFile(files: any, fileUpload: any) {
    const file = files.files[0]; // Get the selected file
    if (file.size < 1024 * 1024) {
      try {
        this.uploadFileBtnLoading = true;
        // Manually send file to the backend
        console.log('this.currentFolder', this.currentFolder);
        const formData = new FormData();
        formData.append('folderId', this.currentFolder._id);
        formData.append('file', file);

        const res: Response = await firstValueFrom(
          this.http.post<Response>(`${SERVER_URL}/files/upload-file`, formData)
        );
        if (res?.success) {
          this.tableData.push(res.data);
          this.toast.messageService?.add({
            severity: 'success',
            summary: 'Success',
            detail: 'File uploaded successfully',
          });
        }
      } catch (err: any) {
        console.error('File upload error:', err);
        this.toast.messageService?.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to upload file',
        });
      }
    } else {
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'Error',
        detail: 'File size should not exceed 1MB',
      });
    }
    fileUpload.clear();
    this.uploadFileBtnLoading = false;
  }

  async createFolder() {
    try {
      if (this.editForm.valid) {
        this.createFolderBtnLoading = true;
        const res: Response = await firstValueFrom(
          this.http.post<Response>(`${SERVER_URL}/files/create-folder`, {
            name: this.editForm.controls['name']?.value,
            parentFolderId: this.currentFolderId,
          })
        );
        if (res?.data) {
          this.tableData = [...this.tableData, res.data];
          this.editForm.reset();
          this.createFolderModelOpen = false;
          this.toast.messageService?.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Folder created successfully',
          });
        }
      } else {
        this.toast.messageService?.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Invalid Form',
        });
        throw new Error('Invalid Form');
      }
    } catch (e) {
      console.error('createFolder Error:', e);
    } finally {
      this.createFolderBtnLoading = false;
    }
  }
  openEditModelFn(item: Folder | IFile) {
    this.editItem = item;
    this.createFolderModelOpen = true;
    let name;
    if (this.editItem && 'fileUrl' in this.editItem) {
      name = this.filExtensionSeparateFn().name;
    } else {
      name = this.editItem?.name;
    }
    this.editForm.patchValue({ name: name });
  }
  async updateFolderFn() {
    let res: Response;
    try {
      if (this.editForm.valid) {
        this.createFolderBtnLoading = true;
        if (this.editItem && !('fileUrl' in this.editItem)) {
          res = await firstValueFrom(
            this.http.put<Response>(`${SERVER_URL}/files/edit-folder-name`, {
              newName: this.editForm.controls['name'].value,
              folderId: this.editItem?._id,
            })
          );
        } else {
          let fileData = this.filExtensionSeparateFn();
          res = await firstValueFrom(
            this.http.put<Response>(`${SERVER_URL}/files/edit-file-name`, {
              newName:
                this.editForm.controls['name'].value + '.' + fileData.extension,
              fileId: this.editItem?._id,
            })
          );
        }
        if (res?.success) {
          this.tableData = this.tableData.map((item) => {
            if (item._id === this.editItem?._id) {
              item = { ...item, ...res.data };
            }
            return item;
          });

          this.toast.messageService?.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Folder updated successfully',
          });
        } else {
          this.toast.messageService?.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Invalid Form',
          });
          throw new Error('Invalid Form');
        }
      }
    } catch (e) {
      console.error('UpdateFolderFn Error:', e);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error occurred while updating folder',
      });
    } finally {
      this.editItem = null;
      this.createFolderModelOpen = false;
      this.createFolderBtnLoading = false;
    }
  }

  copy(rowData: any) {
    this.isCopyBtnLoading = rowData._id;
    if (rowData.fileUrl) {
      this.copyFile(rowData);
    } else {
      this.copyFolderFn(rowData);
    }
  }
  async copyFile(rowData: IFile) {
    try {
      const index = this.tableData.findIndex(
        (item) => item._id === rowData._id
      );
      const res: Response = await firstValueFrom(
        this.http.put<Response>(`${SERVER_URL}/files/copy-file`, {
          fileId: rowData._id,
          destinationFolderId: this.currentFolderId,
        })
      );
      if (res?.success) {
        this.tableData.splice(index, 0, { ...res.data });
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'Success',
          detail: 'File copied successfully',
        });
      }
    } catch (e) {
      console.error('deleteFolderFn Error:', e);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error occurred while Copying file',
      });
    } finally {
      this.isCopyBtnLoading = null;
    }
  }
  async copyFolderFn(folder: Folder) {
    try {
      const index = this.tableData.findIndex((item) => item._id === folder._id);
      const res: Response = await firstValueFrom(
        this.http.post<Response>(`${SERVER_URL}/files/copy-folder`, {
          folderId: folder._id,
        })
      );
      if (res?.success) {
        this.tableData.splice(index, 0, { ...res.data, count: folder.count });
        this.toast.messageService?.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Folder copied successfully',
        });
      }
    } catch (e) {
      console.error('deleteFolderFn Error:', e);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error occurred while Copying folder',
      });
    } finally {
      this.isCopyBtnLoading = null;
    }
  }

  async deleteFolderFn(folder: Folder) {
    this.deleteItemId = folder._id;
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
          summary: 'Success',
          detail: 'Folder deleted successfully',
        });
      }
    } catch (e) {
      console.error('deleteFolderFn Error:', e);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error occurred while deleting folder',
      });
    } finally {
      this.deleteItemId = null;
    }
  }

  async deleteFileFn(file: IFile) {
    try {
      this.deleteItemId = file._id;
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
          summary: 'Success',
          detail: 'File deleted successfully',
        });
      }
    } catch (e) {
      console.error('deleteFileFn Error:', e);
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error occurred while deleting file',
      });
    } finally {
      this.deleteItemId = null;
    }
  }

  routeToNewFolder(folder: Folder): void {
    this.router.navigate(['storage', folder._id], {
      queryParams: {}, // This clears all query params
      queryParamsHandling: '', // Ensure no query parameters are preserved
    });
  }

  BackToParent(folder: Folder): void {
    if (folder.parentFolderId) {
      this.router.navigate(['storage', folder.parentFolderId]);
    }
  }
  appendQuery(query: { [key: string]: any }): void {
    this.router.navigate([], {
      queryParams: { ...query },
      queryParamsHandling: 'merge',
    });
  }

  searchFn(search: string): void {
    this.appendQuery({
      search: search?.trim() ? search : undefined,
      global: search?.trim() ? this.GlobalSearch : undefined,
    });
  }
  selectSearchFromFn() {
    if (this.searchValue?.trim())
      this.appendQuery({ global: this.GlobalSearch });
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`; // Bytes
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`; // Kilobytes
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`; // Megabytes
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`; // Gigabytes
  }

  filExtensionSeparateFn(): { name: string; extension: string } {
    if (this.editItem && 'fileUrl' in this.editItem) {
      const lastDotIndex = this.editItem.file.fileName.lastIndexOf('.');
      const name = this.editItem.file.fileName.slice(0, lastDotIndex);
      const extension = this.editItem.file.fileName.slice(lastDotIndex + 1);
      return { name, extension };
    }
    throw new Error('Invalid file');
  }

  moveFileFolderFn(parentId: string) {
    const movedId = this.moveItem?._id;
    const oldParentId = this.moveItem?.parentFolderId;

    this.tableData = this.tableData.reduce((acc, item) => {
      if (item._id === parentId) {
        item.count += 1;
      }
      // Exclude the moved item itself
      if (item._id !== movedId) {
        acc.push(item);
      }

      return acc;
    }, [] as typeof this.tableData);
  }

  closeCreateFolderModel() {
    this.editForm.reset(); // Resets the control value
    this.createFolderModelOpen = false;
    this.editItem = null;
    // console.log('valid', this.editForm.valid);
  }
}
