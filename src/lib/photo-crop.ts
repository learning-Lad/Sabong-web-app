export interface PhotoCrop {
  image: HTMLImageElement;
  zoom: number;
  x: number;
  y: number;
}

function readImage(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(file);
  });
}

export async function loadPhotoCrop(file: File): Promise<PhotoCrop> {
  const image = new Image();
  image.src = await readImage(file);
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error("The photo has no image data.");
  return { image, zoom: 1, x: 0, y: 0 };
}

// Use the same proportions for the preview and the saved square.
export function photoFrame(crop: PhotoCrop) {
  const { naturalWidth: width, naturalHeight: height } = crop.image;
  const side = Math.min(width, height) / crop.zoom;
  const xRange = (width / side - 1) / 2;
  const yRange = (height / side - 1) / 2;
  return { side, width: width / side, height: height / side, xRange, yRange };
}

export async function savePhotoCrop(crop: PhotoCrop) {
  const { side, xRange, yRange } = photoFrame(crop);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.max(1, Math.min(768, Math.round(side)));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo cropping is unavailable in this browser.");
  const left = side * xRange * (1 - crop.x / 100);
  const top = side * yRange * (1 - crop.y / 100);
  context.drawImage(crop.image, left, top, side, side, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("The cropped photo could not be saved.")),
      "image/webp",
      0.9,
    );
  });
  const extension = blob.type === "image/webp" ? "webp" : "png";
  return { file: new File([blob], "bird-photo." + extension, { type: blob.type }), preview: await readImage(blob) };
}
