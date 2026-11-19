<script lang="ts">
  import { Activity, ArrowRight, Bird, CalendarDays, CirclePlus, ClipboardPlus, HeartPulse, Package,  TriangleAlert } from '@lucide/svelte'
  import FlockFilter from '../components/FlockFilter.svelte'
  import BirdAvatar from '../components/BirdAvatar.svelte'
  import { store } from '../lib/store.svelte'
  import type { ModalKind, Page } from '../lib/types'
  import { age, birdName, formatDate, inFlock, today } from '../lib/utils'

  let { navigate, open, farmName, flockFilter = $bindable() }: { navigate: (page: Page, birdId?: string) => void; open: (kind: ModalKind) => void; farmName: string; flockFilter: string } = $props()
  let shortFarmName = $derived(farmName.replace(/\s+Farm$/i, ''))
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  let activeBirds = $derived(store.birds.filter(bird => bird.status === 'Active' || bird.status === 'Brood'))
  let recentBirds = $derived(store.birds.filter(bird => inFlock(bird, flockFilter)).slice(0, 4))
  let lowStock = $derived(store.lowStock)
  let upcoming = $derived(store.reminders.filter(item => !item.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3))
  let dueCount = $derived(store.reminders.filter(item => !item.done && item.dueDate <= today()).length)
</script>

<div class="page-stack">
  <div class="welcome-row">
    <div><p class="kicker">Farm overview</p><h1>{greeting}, {shortFarmName}</h1><p class="page-lead">Review your birds, care schedule, and supplies.</p></div>
    <span class="date-chip"><CalendarDays size={16} /> {formatDate(today())}</span>
  </div>

  <section class="stable-hero">
    <div class="hero-emblem"><img src="/sabong-mark.png" alt="" /></div>
    <div class="hero-copy"><span>Your farm</span><h2>{activeBirds.length} birds under your care</h2><p>Keep records current and see what needs attention today.</p></div>
    <button class="hero-add" onclick={() => open('bird')}><CirclePlus size={18} /> Register bird</button>
  </section>

  <div class="section-header"><div><h2>Farm overview</h2><p>A snapshot of your farm records.</p></div></div>
  <div class="metric-grid">
    <div class="metric-card"><span class="metric-icon gold"><Bird size={22} /></span><strong>{activeBirds.length}</strong><span>Active birds</span><small>{store.pens.length} pens in use</small></div>
    <div class="metric-card"><span class="metric-icon gold"><HeartPulse size={22} /></span><strong>{store.health.length}</strong><span>Care records</span><small>Logged treatments and care</small></div>
    <div class="metric-card"><span class="metric-icon red"><CalendarDays size={22} /></span><strong>{dueCount}</strong><span>Care due now</span><small>Today and overdue</small></div>
    <div class="metric-card"><span class="metric-icon gold"><Activity size={22} /></span><strong>{store.breeding.length}</strong><span>Breeding records</span><small>Lineage tracked</small></div>
  </div>

  <div class="dashboard-columns">
    <div class="page-stack">
      <section class="panel attention-panel">
        <div class="panel-title"><span class="panel-icon amber"><TriangleAlert size={20} /></span><div><h3>Needs attention</h3><p>{lowStock.length} supplies are low · {upcoming.length} care reminders ahead</p></div></div>
        <div class="attention-actions">
          {#if lowStock.length}<button onclick={() => navigate('supplies')}>Review inventory <ArrowRight size={16} /></button>{/if}
          <button onclick={() => navigate('health')}>View care schedule <ArrowRight size={16} /></button>
        </div>
      </section>

      <section class="panel">
        <div class="section-header compact"><div><h2>Recent birds</h2><p>Quick access to the roster.</p></div><button class="text-button" onclick={() => navigate('roster')}>View all <ArrowRight size={16} /></button></div>
        <FlockFilter bind:value={flockFilter} />
        <div class="bird-list">
          {#each recentBirds as bird}
            <button class="bird-row" onclick={() => navigate('profile', bird.id)}>
              <BirdAvatar name={bird.name} photo={bird.photo} />
              <span class="bird-row-main"><strong>{bird.name}</strong><small>{bird.breed || "Unknown breed"} · {age(bird.hatchDate)}</small></span>
              <span class="row-meta"><span class="tag">{store.pens.find(pen => pen.id === bird.penId)?.name || 'Unassigned'}</span><small>{bird.status}</small></span>
              <ArrowRight size={17} class="row-arrow" />
            </button>
          {:else}<p class="muted-note">{flockFilter ? 'No birds in this view.' : 'No birds registered yet. Add your first bird above.'}</p>{/each}
        </div>
      </section>
    </div>

    <div class="page-stack">
      <section class="panel">
        <div class="section-header compact"><div><h2>Quick actions</h2><p>Common tasks, one tap away.</p></div></div>
        <div class="action-grid">
          <button onclick={() => open('bird')}><span class="action-icon"><CirclePlus size={22} /></span><strong>Register bird</strong><small>Add a profile</small></button>
          <button onclick={() => open('health')}><span class="action-icon"><HeartPulse size={22} /></span><strong>Log treatment</strong><small>Health and care</small></button>
          <button onclick={() => open('breeding')}><span class="action-icon"><Bird size={22} /></span><strong>Record breeding</strong><small>Pair and offspring</small></button>
          <button onclick={() => open('supply')}><span class="action-icon"><Package size={22} /></span><strong>Add supply</strong><small>Feed and inventory</small></button>
        </div>
      </section>
      <section class="panel">
        <div class="section-header compact"><div><h2>Coming up</h2><p>Care events on the calendar.</p></div><button class="text-button" onclick={() => navigate('health')}>Schedule <ArrowRight size={16} /></button></div>
        <div class="timeline">
          {#each upcoming as reminder}
            <div class="timeline-item"><span class="timeline-dot"></span><div><strong>{reminder.description}</strong><small>{birdName(store.birds, reminder.birdId)} · {formatDate(reminder.dueDate)}</small></div></div>
          {:else}<p class="muted-note">No pending care reminders.</p>{/each}
        </div>
      </section>
      <section class="mini-banner"><Package size={20} /><span><strong>Inventory at a glance</strong><small>{lowStock.length ? lowStock.map(item => item.name).join(', ') + ' need restocking' : 'All stock levels are healthy'}</small></span><button aria-label="Open inventory" onclick={() => navigate('supplies')}><ArrowRight size={19} /></button></section>
    </div>
  </div>
</div>
