<script lang="ts">
  import { ArrowRight, CirclePlus, Search, SlidersHorizontal } from '@lucide/svelte'
  import FlockFilter from '../components/FlockFilter.svelte'
  import BirdAvatar from '../components/BirdAvatar.svelte'
  import { store } from '../lib/store.svelte'
  import type { ModalKind, Page } from '../lib/types'
  import { age, inFlock } from '../lib/utils'

  let { navigate, open, flockFilter = $bindable() }: {
    navigate: (page: Page, birdId?: string) => void
    open: (kind: ModalKind, values?: Record<string, string>) => void
    flockFilter: string
  } = $props()
  let selectedFlock = $derived(store.flocks.find(flock => flock.id === flockFilter))
  let query = $state('')
  let status = $state('All')
  let filtered = $derived(store.birds.filter(bird => {
    const matchesQuery = [bird.id, bird.name, bird.breed, bird.bloodline].some(value => value.toLowerCase().includes(query.toLowerCase()))
    return inFlock(bird, flockFilter) && matchesQuery && (status === 'All' || bird.status === status)
  }))
</script>
<div class="page-stack">
  <div class="page-heading"><div><p class="kicker">Chicken directory</p><h1>Your birds</h1><p class="page-lead">Profiles, pens, lineage, and records for every bird.</p></div><div class="heading-actions"><button class="secondary-button" onclick={() => open('flock')}>Add flock</button><button class="primary-button" onclick={() => open('bird', { flockId: selectedFlock?.id || '' })}><CirclePlus size={18} /> Register bird</button></div></div>
  <div class="toolbar"><label class="search-field"><Search size={18} /><span class="sr-only">Search birds</span><input bind:value={query} placeholder="Search by name, ID, or breed" /></label><label class="filter-field"><SlidersHorizontal size={17} /><span class="sr-only">Filter by status</span><select bind:value={status}><option>All</option><option>Active</option><option>Brood</option><option>Sold</option><option>Deceased</option></select></label><FlockFilter bind:value={flockFilter} />
    {#if selectedFlock}<button class="text-button" onclick={() => open('flock', { id: selectedFlock.id })}>Rename flock</button>{/if}
  </div>
  <div class="list-summary"><strong>{filtered.length} birds</strong><span>{store.birds.length} total in your farm</span></div>
  {#if filtered.length}
    <div class="roster-grid">
      {#each filtered as bird}
        <button class="roster-card" onclick={() => navigate('profile', bird.id)}>
          <div class="roster-top"><BirdAvatar name={bird.name} photo={bird.photo} size="lg" /><span class:active={bird.status === 'Active'} class="status-pill">{bird.status}</span></div>
          <div class="roster-name"><div><h2>{bird.name}</h2><span>{bird.id}</span></div><ArrowRight size={18} /></div>
          <p class="bloodline">{bird.breed || "Unknown breed"}</p>
          <div class="roster-foot"><span>{store.pens.find(pen => pen.id === bird.penId)?.name || 'Unassigned'}</span><span>{store.flocks.find(flock => flock.id === bird.flockId)?.name || "Unassigned flock"}</span><span>{age(bird.hatchDate)}</span><span>{bird.sex}</span></div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="empty-state"><Search size={26} /><h2>No birds found</h2><p>Try another search, status, or flock.</p><button class="secondary-button" onclick={() => { query = ''; status = 'All'; flockFilter = '' }}>Clear filters</button></div>
  {/if}
</div>
