<script lang="ts">
  import { ArrowRight, ClipboardList, Bird, FileText, HeartPulse, Package, Sparkles } from '@lucide/svelte'
  import type { Page } from '../lib/types'
  let { navigate }: { navigate: (page: Page) => void } = $props()
  const items: { page: Page; title: string; description: string; icon: typeof Bird }[] = [
    { page: 'breeding', title: 'Breeding & lineage', description: 'Pairings, hatch rates, and pedigree trees', icon: Bird },
    { page: 'health', title: 'Care & schedule', description: 'Health logs, vaccinations, and reminders', icon: HeartPulse },
    { page: 'supplies', title: 'Supply tracker', description: 'Feed, medicine, and stock balances', icon: Package },
    { page: 'assistant', title: 'Care assistant', description: 'Optional AI observations and care notes', icon: Sparkles },
    { page: 'flock-records', title: 'Flock records', description: 'Daily care checklist and egg collection', icon: ClipboardList },
    { page: 'reports', title: 'Reports', description: 'Printable farm records', icon: FileText },
  ]
</script>
<div class="page-stack"><div class="page-heading"><div><p class="kicker">Explore Sabong</p><h1>More tools</h1><p class="page-lead">Open your farm records and tools.</p></div></div><div class="more-grid">{#each items as item}<button onclick={() => navigate(item.page)}><span class="more-icon"><item.icon size={24} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowRight size={18} /></button>{/each}</div></div>
