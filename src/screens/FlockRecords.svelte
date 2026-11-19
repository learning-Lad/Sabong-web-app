<script lang="ts">
  import { onMount } from "svelte";
  import { store } from "../lib/store.svelte";
  import { readableError } from "../lib/supabase";
  import { formatDate, offsetDate, today } from "../lib/utils";
  import type { ModalKind } from "../lib/types";

  let { open, initialFlock, viewBirds }: {
    open: (kind: ModalKind, values?: Record<string, string>) => void;
    initialFlock: string;
    viewBirds: () => void;
  } = $props();
  let chosenFlock = $state("");
  let flockId = $derived(
    chosenFlock || store.flocks.find((flock) => flock.id === initialFlock)?.id || store.flocks[0]?.id || "",
  );
  let careDate = $state(today());
  let eggDate = $state(today());
  let savingTask = $state("");
  let error = $state("");
  onMount(() => {
    const timer = window.setInterval(() => { careDate = today(); }, 30000);
    return () => window.clearInterval(timer);
  });

  let tasks = $derived(store.flockTasks.filter((task) => task.flockId === flockId));
  let lastCheck = $derived.by(() => {
    const dates = new Map<string, string>();
    for (const entry of store.flockChecks) {
      if (entry.date > (dates.get(entry.taskId) || "")) dates.set(entry.taskId, entry.date);
    }
    return dates;
  });
  let doneCount = $derived(tasks.filter((task) => lastCheck.get(task.id) === careDate).length);
  let dayEntry = $derived(store.eggCollections.find((entry) => entry.flockId === flockId && entry.date === eggDate));
  let recent = $derived(store.eggCollections
    .filter((entry) => entry.flockId === flockId && entry.date >= offsetDate(-6) && entry.date <= careDate)
    .sort((a, b) => b.date.localeCompare(a.date)));
  let weekTotal = $derived(recent.reduce((sum, entry) => sum + entry.count, 0));

  async function toggle(taskId: string) {
    savingTask = taskId;
    error = "";
    try {
      await store.toggleFlockTask(taskId, careDate);
    } catch (cause) {
      error = readableError(cause);
    } finally {
      savingTask = "";
    }
  }
</script>

<div class="page-stack">
  <div class="page-heading"><div><h1>Flock records</h1><p class="page-lead">Track daily chores and egg collection by flock.</p></div></div>
  {#if flockId}
    <label class="field flock-record-filter">
      <span>Flock</span>
      <select value={flockId} onchange={(event) => { chosenFlock = event.currentTarget.value; error = ""; }}>
        {#each store.flocks as flock (flock.id)}
          <option value={flock.id}>{flock.name}</option>
        {/each}
      </select>
    </label>
    <div class="detail-columns">
      <section class="panel page-stack">
        <div class="section-header">
          <div><h2>Flock care checklist</h2><p>{formatDate(careDate)} · {doneCount} of {tasks.length} done</p></div>
          <button class="secondary-button" onclick={() => open("flock-task", { flockId })}>Add task</button>
        </div>
        {#if error}<p class="form-error" role="alert">{error}</p>{/if}
        <div class="record-stack">
          {#each tasks as task (task.id)}
            <div class="history-row">
              <div>
                <strong>{task.name}</strong>
                <small>{lastCheck.has(task.id) ? "Last done " + formatDate(lastCheck.get(task.id)!) : "No completion recorded"}</small>
              </div>
              <button class="secondary-button" aria-pressed={lastCheck.get(task.id) === careDate}
                aria-label={task.name + " completed today"} disabled={!!savingTask} onclick={() => toggle(task.id)}>
                {lastCheck.get(task.id) === careDate ? "Done" : "Mark done"}
              </button>
            </div>
          {:else}
            <p class="muted-note">Add a daily task like checking water or replacing bedding.</p>
          {/each}
        </div>
      </section>
      <section class="panel page-stack">
        <div class="section-header">
          <div><h2>Egg collection log</h2><p>{weekTotal} eggs recorded in the last 7 days</p></div>
        </div>
        <div class="heading-actions">
          <label class="field">
            <span>Collection date</span>
            <input type="date" bind:value={eggDate} max={careDate} />
          </label>
          <button class="secondary-button" disabled={!eggDate || eggDate > careDate}
            onclick={() => open("egg-collection", { flockId, date: eggDate, ...(dayEntry ? { id: dayEntry.id } : {}) })}>
            {dayEntry ? "Edit count" : "Log eggs"}
          </button>
        </div>
        <div class="record-stack">
          {#each recent as entry (entry.id)}
            <div class="history-row">
              <div>
                <strong>{entry.count} {entry.count === 1 ? "egg" : "eggs"}</strong>
                {#if entry.notes}<small>{entry.notes}</small>{/if}
              </div>
              <time datetime={entry.date}>{formatDate(entry.date)}</time>
            </div>
          {:else}
            <p class="muted-note">No collections recorded in the last 7 days.</p>
          {/each}
        </div>
      </section>
    </div>
  {:else}
    <section class="panel page-stack">
      <p class="muted-note">Create a flock in the Bird directory to start tracking its care and egg collection.</p>
      <button class="secondary-button" onclick={viewBirds}>Open Bird directory</button>
    </section>
  {/if}
</div>
