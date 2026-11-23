import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';

/**
 * Press-and-hold on an element (finger or mouse). Emits `longPress` with the element
 * after `longPressMs`. Moving the finger (scrolling) cancels it. The tap/click that
 * follows a long press is swallowed, so holding a row doesn't also open the folder/file.
 */
@Directive({
  selector: '[appLongPress]',
  standalone: true,
  host: { class: 'long-press' },
})
export class LongPressDirective implements OnDestroy {
  @Input() longPressMs = 500;
  @Output() longPress = new EventEmitter<{ target: HTMLElement; x: number; y: number }>();

  private timer?: ReturnType<typeof setTimeout>;
  private startX = 0;
  private startY = 0;
  private fired = false;

  // Capture phase: runs before the cell's own (click) handler (e.g. open folder).
  private readonly swallowClick = (event: MouseEvent) => {
    if (this.fired) {
      event.stopPropagation();
      event.preventDefault();
      this.fired = false;
    }
  };

  constructor(private el: ElementRef<HTMLElement>) {
    el.nativeElement.addEventListener('click', this.swallowClick, true);
  }

  @HostListener('pointerdown', ['$event'])
  onDown(event: PointerEvent) {
    if (event.button !== 0) return; // primary button / touch only
    this.fired = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.clear();
    this.timer = setTimeout(() => {
      this.fired = true;
      if (navigator.vibrate) navigator.vibrate(15); // small haptic tick on phones
      this.longPress.emit({ target: this.el.nativeElement, x: this.startX, y: this.startY });
    }, this.longPressMs);
  }

  @HostListener('pointermove', ['$event'])
  onMove(event: PointerEvent) {
    // Finger moved more than ~10px: it's a scroll, not a hold.
    if (Math.abs(event.clientX - this.startX) > 10 || Math.abs(event.clientY - this.startY) > 10) {
      this.clear();
    }
  }

  @HostListener('pointerup')
  @HostListener('pointerleave')
  @HostListener('pointercancel')
  onUp() {
    this.clear();
  }

  // Phones show their own copy/share menu on long press; ours replaces it.
  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: Event) {
    event.preventDefault();
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  ngOnDestroy() {
    this.clear();
    this.el.nativeElement.removeEventListener('click', this.swallowClick, true);
  }
}
