<script lang="ts">
  import { photoFrame, type PhotoCrop } from "../lib/photo-crop";

  let { crop = $bindable(), discard }: { crop: PhotoCrop; discard: () => void } = $props();
  let frame = $derived(photoFrame(crop));
  let drag: { id: number; clientX: number; clientY: number; startX: number; startY: number } | null = null;

  function startDrag(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (event.button !== 0 || drag) return;
    drag = {
      id: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      startX: crop.x, startY: crop.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePhoto(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (!drag || event.pointerId !== drag.id) return;
    const size = event.currentTarget.clientWidth;
    const clamp = (value: number) => Math.round(Math.min(100, Math.max(-100, value)));
    if (frame.xRange) crop.x = clamp(drag.startX + (event.clientX - drag.clientX) / (size * frame.xRange) * 100);
    if (frame.yRange) crop.y = clamp(drag.startY + (event.clientY - drag.clientY) / (size * frame.yRange) * 100);
  }
</script>

<section class="photo-crop" aria-label="Crop bird photo">
  <div>
    <h3>Center the bird</h3>
    <p>Drag the photo inside the square or use the sliders. The square is saved with this profile.</p>
  </div>
  <div class="photo-crop-frame" role="presentation" onpointerdown={startDrag}
    onpointermove={movePhoto} onlostpointercapture={() => { drag = null; }}>
    <img
      src={crop.image.src}
      alt="Square crop preview"
      draggable="false"
      style:width={`${frame.width * 100}%`}
      style:height={`${frame.height * 100}%`}
      style:left={`${50 + frame.xRange * crop.x}%`}
      style:top={`${50 + frame.yRange * crop.y}%`}
    />
  </div>
  <div class="photo-crop-controls">
    <label>Zoom <input type="range" min="1" max="3" step="0.01" bind:value={crop.zoom} /></label>
    <label>Horizontal position <input type="range" min="-100" max="100" bind:value={crop.x} disabled={!frame.xRange} /></label>
    <label>Vertical position <input type="range" min="-100" max="100" bind:value={crop.y} disabled={!frame.yRange} /></label>
  </div>
  <button class="text-button" type="button" onclick={discard}>Discard selected photo</button>
</section>
