export class SidebarView {
  private sidebar: HTMLElement | null;
  private toggleButton: HTMLElement | null;

  constructor() {
    this.sidebar = document.getElementById('sidebar');
    this.toggleButton = document.getElementById('sidebar-toggle');

    this.initialize();
  }

  private initialize(): void {
    this.toggleButton?.addEventListener('click', () => {
      this.toggle();
    });
  }

  private toggle(): void {
    if (!this.sidebar) return;

    this.sidebar.classList.toggle('collapsed');

    const isCollapsed = this.sidebar.classList.contains('collapsed');

    this.toggleButton?.setAttribute(
      'aria-expanded',
      String(!isCollapsed)
    );
  }
}