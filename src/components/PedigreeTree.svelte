<script lang="ts">
  import { store } from "../lib/store.svelte";
  import type { Page } from "../lib/types";
  let {
    birdId,
    navigate,
  }: { birdId: string; navigate: (page: Page, birdId?: string) => void } =
    $props();
</script>

{#snippet branch(id: string | undefined, depth: number, path: string[])}
  {@const bird = store.birds.find((item) => item.id === id)}
  <li>
    {#if bird && !path.includes(bird.id)}
      <button class="pedigree-node" onclick={() => navigate("profile", bird.id)}
        ><strong>{bird.name}</strong><small>{bird.bloodline}</small></button
      >
      {#if depth < 5 && (bird.sireId || bird.damId)}<ul>
          <li class="ancestor-label">Sire / Dam</li>
          {@render branch(bird.sireId, depth + 1, [
            ...path,
            bird.id,
          ])}{@render branch(bird.damId, depth + 1, [...path, bird.id])}
        </ul>{/if}
      {#if depth === 5 && (bird.sireId || bird.damId)}<small
          >Open this ancestor to explore further.</small
        >{/if}
    {:else}<span class="unknown-parent">Unknown parent</span>{/if}
  </li>
{/snippet}
<div class="pedigree-scroll" aria-label="Pedigree tree">
  <ul class="pedigree-root">{@render branch(birdId, 0, [])}</ul>
</div>
