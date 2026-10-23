export function previewViewport(device: 'desktop' | 'mobile', available: number) {
  const space = Math.max(0, available);
  const width = device === 'desktop' ? Math.max(1280, space) : 390;
  const scale = space ? Math.min(1, space / width) : 0;
  const visibleHeight = device === 'desktop' ? 520 : 620;
  const height = scale ? Math.round(visibleHeight / scale) : visibleHeight;
  return { width, height, scale, visibleWidth: width * scale, visibleHeight };
}
