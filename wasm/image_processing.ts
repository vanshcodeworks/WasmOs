
// Grayscale conversion
export function toGrayscale(pixels: Uint8Array, width: i32, height: i32): void {
  const len = width * height * 4;
  for (let i = 0; i < len; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    // Standard grayscale formula
    const gray = u8((0.299 * f32(r) + 0.587 * f32(g) + 0.114 * f32(b)));
    
    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
    // Alpha channel remains unchanged
  }
}

// Invert colors
export function invertColors(pixels: Uint8Array, width: i32, height: i32): void {
  const len = width * height * 4;
  for (let i = 0; i < len; i += 4) {
    pixels[i] = 255 - pixels[i];         // R
    pixels[i + 1] = 255 - pixels[i + 1]; // G
    pixels[i + 2] = 255 - pixels[i + 2]; // B
    // Alpha channel remains unchanged
  }
}

// Brightness adjustment
export function adjustBrightness(pixels: Uint8Array, width: i32, height: i32, amount: i32): void {
  const len = width * height * 4;
  for (let i = 0; i < len; i += 4) {
    pixels[i] = u8(clamp(i32(pixels[i]) + amount, 0, 255));
    pixels[i + 1] = u8(clamp(i32(pixels[i + 1]) + amount, 0, 255));
    pixels[i + 2] = u8(clamp(i32(pixels[i + 2]) + amount, 0, 255));
  }
}

// Contrast adjustment
export function adjustContrast(pixels: Uint8Array, width: i32, height: i32, factor: f32): void {
  const len = width * height * 4;
  const adjustment = (259.0 * (factor + 255.0)) / (255.0 * (259.0 - factor));
  
  for (let i = 0; i < len; i += 4) {
    pixels[i] = u8(clamp(i32(adjustment * (f32(pixels[i]) - 128.0) + 128.0), 0, 255));
    pixels[i + 1] = u8(clamp(i32(adjustment * (f32(pixels[i + 1]) - 128.0) + 128.0), 0, 255));
    pixels[i + 2] = u8(clamp(i32(adjustment * (f32(pixels[i + 2]) - 128.0) + 128.0), 0, 255));
  }
}

// Blur (simple box blur)
export function boxBlur(pixels: Uint8Array, width: i32, height: i32, radius: i32): void {
  const temp = new Uint8Array(pixels.length);
  
  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          const idx = (y * width + nx) * 4;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
          count++;
        }
      }
      
      const idx = (y * width + x) * 4;
      temp[idx] = u8(r / count);
      temp[idx + 1] = u8(g / count);
      temp[idx + 2] = u8(b / count);
      temp[idx + 3] = pixels[idx + 3];
    }
  }
  
  // Copy back
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = temp[i];
  }
}

// Edge detection (Sobel operator)
export function detectEdges(pixels: Uint8Array, width: i32, height: i32): void {
  const temp = new Uint8Array(pixels.length);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      // Sobel kernels
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          const gray = i32(pixels[idx]);
          
          // X gradient
          gx += gray * getSobelX(dx + 1, dy + 1);
          // Y gradient
          gy += gray * getSobelY(dx + 1, dy + 1);
        }
      }
      
      const magnitude = u8(clamp(i32(Math.sqrt(f64(gx * gx + gy * gy))), 0, 255));
      const idx = (y * width + x) * 4;
      temp[idx] = magnitude;
      temp[idx + 1] = magnitude;
      temp[idx + 2] = magnitude;
      temp[idx + 3] = pixels[idx + 3];
    }
  }
  
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = temp[i];
  }
}

// Helper functions
function clamp(value: i32, min: i32, max: i32): i32 {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getSobelX(x: i32, y: i32): i32 {
  const kernel: i32[] = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  return kernel[y * 3 + x];
}

function getSobelY(x: i32, y: i32): i32 {
  const kernel: i32[] = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  return kernel[y * 3 + x];
}
