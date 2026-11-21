import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Folder } from '../../shared/interface/folder-file/folder.interface';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Response } from '../../shared/interface/response.interface';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SERVER_URL } from '../../environments/environment';
import { ToastService } from '../../shared/services/toastService/toast.service';
@Component({
  selector: 'app-move-folder-file',
  standalone: true,
  imports: [
    DialogModule,
    ButtonModule,
    TableModule,
    CommonModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './move-folder-file.component.html',
  styleUrl: './move-folder-file.component.css',
})
export class MoveFolderFileComponent implements OnChanges {
  @Input() moveItem: any | null = null;
  @Input() currentFolder!: Folder;
  @Input() tableData: Folder[] = [];
  @Output() closeEvent: EventEmitter<any> = new EventEmitter();
  @Output() responseEvent: EventEmitter<string> = new EventEmitter<string>();
  tableLoading: boolean = false;
  moveBtnLoading: boolean = false;
  isSameParentFolder: boolean = false;

  constructor(private http: HttpClient, private toast: ToastService) {}
  ngOnChanges(changes: SimpleChanges): void {
    // Only the inputs that changed are present in `changes`; reading a missing one used
    // to throw and leave the dialog stuck after a successful move.
    const folderChange = changes['currentFolder'];
    if (folderChange && folderChange.previousValue !== folderChange.currentValue && this.currentFolder) {
      this.getData(this.currentFolder._id);
    }
    const tableChange = changes['tableData'];
    if (tableChange && tableChange.previousValue !== tableChange.currentValue && this.tableData) {
      this.isSameParentFolder = this.tableData.some((item: any) => item._id === this.moveItem?._id);
      this.tableData = this.destinationFolders(this.tableData);
    }
  }

  // Folders you can open as a destination: no files, and never the folder being moved
  // (opening it would let you pick one of its own subfolders).
  private destinationFolders(items: any[]) {
    return items.filter((item: any) => !item.fileUrl && item._id !== this.moveItem?._id);
  }

  async getData(folderId: string) {
    const url = `${SERVER_URL}/files/get-folder-file?parentFolderId=${folderId}`;

    try {
      this.tableLoading = true;
      const res: Response = await firstValueFrom(this.http.get<Response>(url));
      if (res?.success) {
        this.isSameParentFolder = res.data.data.some((item:any) => item._id === this.moveItem?._id);
        this.currentFolder = res.data.currentFolder;
        this.tableData = this.destinationFolders(res.data.data);
      }
      // Call your API to get the list of folders and files in the current folder
    } catch (e) {
      console.error('Error getting data', e);
    } finally {
      this.tableLoading = false;
    }
  }

  BackToParent() {
    if (this.currentFolder?.parentFolderId) {
      this.getData(this.currentFolder.parentFolderId);
    }
  }
  navigateToChildFolder(folderId: string) {
    this.getData(folderId);
  }
  async moveItemFn() {
    try {
      this.moveBtnLoading = true;
      let res: Response;
      if (this.moveItem && 'fileUrl' in this.moveItem) {
        res = await firstValueFrom(
          this.http.put<Response>(`${SERVER_URL}/files/move-file`, {
            fileId: this.moveItem._id,
            destinationFolderId: this.currentFolder._id,
          })
        );
      } else {
        res = await firstValueFrom(
          this.http.put<Response>(`${SERVER_URL}/files/move-folder`, {
            folderId: this.moveItem?._id,
            newParentFolderId: this.currentFolder._id,
          })
        );
      }
      if (res?.success) {
        this.moveItem = null;
        this.responseEvent.emit(this.currentFolder._id);
      }
    } catch (error: any) {
      console.error('Error moving file', error);
      // Show why the server refused the move (e.g. "cannot be moved into itself").
      this.toast.messageService?.add({
        severity: 'error',
        summary: 'Move failed',
        detail: error?.error?.message || 'Unable to move. Please try again.',
      });
    }finally {
      this.moveBtnLoading = false;
    }
  }
  cancelMoveFn() {
    this.closeEvent.emit();
  }
}
