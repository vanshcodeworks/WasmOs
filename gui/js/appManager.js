class AppManager {
    // ...existing methods...

    createImageProcessorApp() {
        return `
            <div style="padding: 1rem;">
                <h2 style="margin-bottom: 1rem; color: var(--text-primary);">
                    <i class="fas fa-image" style="color: var(--primary-color);"></i>
                    Image Processor
                </h2>
                <div style="display: grid; grid-template-columns: 1fr 300px; gap: 1rem; height: calc(100% - 60px);">
                    <div style="background: var(--bg-secondary); border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px dashed var(--border-color);">
                        <div style="text-align: center; color: var(--text-muted);">
                            <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                            <div>Drop an image here or click to browse</div>
                            <button style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Browse Files
                            </button>
                        </div>
                    </div>
                    <div style="background: var(--bg-secondary); border-radius: 8px; padding: 1rem;">
                        <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Filters</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <button class="filter-btn" style="padding: 0.5rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-adjust"></i> Grayscale
                            </button>
                            <button class="filter-btn" style="padding: 0.5rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-sun"></i> Brightness
                            </button>
                            <button class="filter-btn" style="padding: 0.5rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-circle"></i> Blur
                            </button>
                            <button class="filter-btn" style="padding: 0.5rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-border-style"></i> Edge Detection
                            </button>
                            <button class="filter-btn" style="padding: 0.5rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-undo"></i> Invert Colors
                            </button>
                            <button class="filter-btn" style="padding: 0.5rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-download"></i> Export
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}