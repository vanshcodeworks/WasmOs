export class WindowManager {
    constructor() {
        this.windows = new Map();
        this.zIndexCounter = 100;
        this.activeWindow = null;
        this.container = document.getElementById('windowsContainer');
    }

    createWindow(id, title, icon, content, options = {}) {
        const defaultOptions = {
            width: 600,
            height: 400,
            x: Math.random() * 200 + 100,
            y: Math.random() * 100 + 50,
            resizable: true,
            minimizable: true,
            maximizable: true,
            closable: true
        };

        const config = { ...defaultOptions, ...options };
        
        const window = document.createElement('div');
        window.className = 'window';
        window.id = `window-${id}`;
        window.style.width = `${config.width}px`;
        window.style.height = `${config.height}px`;
        window.style.left = `${config.x}px`;
        window.style.top = `${config.y}px`;
        window.style.zIndex = ++this.zIndexCounter;

        window.innerHTML = `
            <div class="window-header">
                <div class="window-title">
                    <i class="${icon}"></i>
                    <span>${title}</span>
                </div>
                <div class="window-controls">
                    ${config.minimizable ? '<button class="window-control minimize" data-action="minimize"><i class="fas fa-minus"></i></button>' : ''}
                    ${config.maximizable ? '<button class="window-control maximize" data-action="maximize"><i class="fas fa-square"></i></button>' : ''}
                    ${config.closable ? '<button class="window-control close" data-action="close"><i class="fas fa-times"></i></button>' : ''}
                </div>
            </div>
            <div class="window-content">
                ${content}
            </div>
        `;

        this.container.appendChild(window);
        this.setupWindowControls(window, id);
        this.makeWindowDraggable(window);
        this.makeWindowFocusable(window);

        this.windows.set(id, {
            element: window,
            title,
            icon,
            minimized: false,
            maximized: false,
            originalBounds: null
        });

        this.focusWindow(id);
        this.updateTaskbar();

        return window;
    }

    setupWindowControls(window, id) {
        const controls = window.querySelectorAll('.window-control');
        controls.forEach(control => {
            control.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = control.getAttribute('data-action');
                
                switch (action) {
                    case 'minimize':
                        this.minimizeWindow(id);
                        break;
                    case 'maximize':
                        this.toggleMaximizeWindow(id);
                        break;
                    case 'close':
                        this.closeWindow(id);
                        break;
                }
            });
        });
    }

    makeWindowDraggable(window) {
        const header = window.querySelector('.window-header');
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window-control')) return;
            
            isDragging = true;
            dragOffset.x = e.clientX - window.offsetLeft;
            dragOffset.y = e.clientY - window.offsetTop;
            
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag);
            
            window.style.cursor = 'grabbing';
            header.style.cursor = 'grabbing';
        });

        const handleDrag = (e) => {
            if (!isDragging) return;
            
            const newX = e.clientX - dragOffset.x;
            const newY = e.clientY - dragOffset.y;
            
            window.style.left = `${Math.max(0, newX)}px`;
            window.style.top = `${Math.max(0, newY)}px`;
        };

        const stopDrag = () => {
            isDragging = false;
            window.style.cursor = '';
            header.style.cursor = 'move';
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        // Double-click to maximize
        header.addEventListener('dblclick', (e) => {
            if (e.target.closest('.window-control')) return;
            const id = window.id.replace('window-', '');
            this.toggleMaximizeWindow(id);
        });
    }

    makeWindowFocusable(window) {
        window.addEventListener('mousedown', () => {
            const id = window.id.replace('window-', '');
            this.focusWindow(id);
        });
    }

    focusWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        // Remove focus from other windows
        this.windows.forEach((data, windowId) => {
            data.element.style.zIndex = Math.max(100, parseInt(data.element.style.zIndex) - 1);
        });

        // Focus this window
        windowData.element.style.zIndex = ++this.zIndexCounter;
        this.activeWindow = id;
    }

    minimizeWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        windowData.element.classList.add('minimized');
        windowData.minimized = true;
        this.updateTaskbar();
    }

    restoreWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        windowData.element.classList.remove('minimized');
        windowData.minimized = false;
        this.focusWindow(id);
        this.updateTaskbar();
    }

    toggleMaximizeWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        if (windowData.maximized) {
            // Restore
            if (windowData.originalBounds) {
                windowData.element.style.left = windowData.originalBounds.left;
                windowData.element.style.top = windowData.originalBounds.top;
                windowData.element.style.width = windowData.originalBounds.width;
                windowData.element.style.height = windowData.originalBounds.height;
            }
            windowData.element.classList.remove('maximized');
            windowData.maximized = false;
        } else {
            // Maximize
            windowData.originalBounds = {
                left: windowData.element.style.left,
                top: windowData.element.style.top,
                width: windowData.element.style.width,
                height: windowData.element.style.height
            };
            windowData.element.classList.add('maximized');
            windowData.maximized = true;
        }

        const maximizeBtn = windowData.element.querySelector('[data-action="maximize"] i');
        if (maximizeBtn) {
            maximizeBtn.className = windowData.maximized ? 'fas fa-window-restore' : 'fas fa-square';
        }
    }

    closeWindow(id) {
        const windowData = this.windows.get(id);
        if (!windowData) return;

        windowData.element.remove();
        this.windows.delete(id);
        
        if (this.activeWindow === id) {
            this.activeWindow = null;
        }
        
        this.updateTaskbar();
    }

    updateTaskbar() {
        const taskbarApps = document.getElementById('taskbarApps');
        taskbarApps.innerHTML = '';

        this.windows.forEach((windowData, id) => {
            const taskbarItem = document.createElement('button');
            taskbarItem.className = `taskbar-item ${windowData.minimized ? 'minimized' : ''}`;
            taskbarItem.innerHTML = `
                <i class="${windowData.icon}"></i>
                <span>${windowData.title}</span>
            `;
            
            taskbarItem.addEventListener('click', () => {
                if (windowData.minimized) {
                    this.restoreWindow(id);
                } else {
                    this.focusWindow(id);
                }
            });

            taskbarApps.appendChild(taskbarItem);
        });
    }

    getWindow(id) {
        return this.windows.get(id);
    }

    getAllWindows() {
        return Array.from(this.windows.keys());
    }
}
