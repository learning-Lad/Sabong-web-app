<script lang="ts">
  import { store } from "../lib/store.svelte";
  import { UNASSIGNED_FLOCK } from "../lib/utils";

  let { value = $bindable() }: { value: string } = $props();
</script>

<label class="filter-field">
  <span class="sr-only">Filter by flock</span>
  <select bind:value>
    <option value="">All flocks</option>
    <option value={UNASSIGNED_FLOCK}>Unassigned birds</option>
    {#each store.flocks as flock (flock.id)}
      <option value={flock.id}>{flock.name}</option>
    {/each}
  </select>
</label>
