<script lang="ts">
  import {
    CirclePlus,
    Minus,
    Package,
    Pencil,
    Plus,
    TriangleAlert,
  } from "@lucide/svelte";
  import { store } from "../lib/store.svelte";
  import { readableError } from "../lib/supabase";
  import type { ModalKind } from "../lib/types";
  let {
    open,
    notify,
  }: {
    open: (kind: ModalKind, values?: Record<string, string>) => void;
    notify: (message: string) => void;
  } = $props();
  let category = $state("All"),
    working = $state<string[]>([]),
    amounts = $state<Record<string, number>>({});
  let visible = $derived(
    store.supplies.filter(
      (item) => category === "All" || item.category === category,
    ),
  );
  let low = $derived(
    store.supplies.filter((item) => item.quantity <= item.reorderLevel),
  );
  async function adjust(id: string, direction: number, name: string) {
    if (working.includes(id)) return;
    const amount = amounts[id] ?? 1;
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Enter a positive quantity.");
      return;
    }
    working = [...working, id];
    try {
      await store.adjustSupply(id, direction * amount);
      notify(name + " stock updated");
    } catch (error) {
      notify(readableError(error));
    } finally {
      working = working.filter((item) => item !== id);
    }
  }
</script>

<div class="page-stack">
  <div class="page-heading">
    <div>
      <p class="kicker">Supply tracker</p>
      <h1>Know what is on hand</h1>
      <p class="page-lead">
        Feed, medicine, vitamins, and equipment in one view.
      </p>
    </div>
    <button class="primary-button" onclick={() => open("supply")}
      ><CirclePlus size={18} /> Add supply</button
    >
  </div>
  {#if low.length}<div class="warning-banner">
      <TriangleAlert size={20} />
      <div>
        <strong
          >{low.length} item{low.length === 1 ? "" : "s"} need restocking</strong
        ><span>{low.map((item) => item.name).join(", ")}</span>
      </div>
    </div>{/if}
  <div class="category-tabs" aria-label="Supply categories">
    {#each ["All", "Feed", "Vitamin", "Medicine", "Equipment"] as option}<button
        class:current={category === option}
        onclick={() => (category = option)}>{option}</button
      >{/each}
  </div>
  <div class="supply-grid">
    {#each visible as item}<article class="supply-card">
        <div class="supply-card-top">
          <span class="supply-icon"><Package size={22} /></span><span
            class:low={item.quantity <= item.reorderLevel}
            class="stock-pill"
            >{item.quantity <= item.reorderLevel
              ? "Low stock"
              : "In stock"}</span
          ><button
            class="icon-button"
            aria-label={"Edit " + item.name}
            onclick={() => open("supply", { id: item.id })}
            ><Pencil size={16} /></button
          >
        </div>
        <small>{item.category}</small>
        <h2>{item.name}</h2>
        <div class="supply-quantity">
          <strong>{item.quantity}</strong><span>{item.unit} available</span>
        </div>
        <div class="supply-progress">
          <span
            style:width={Math.min(
              100,
              (item.quantity / Math.max(item.reorderLevel * 2, 1)) * 100,
            ) + "%"}
            class:low={item.quantity <= item.reorderLevel}
          ></span>
        </div>
        <label class="field"
          ><span>Adjustment amount ({item.unit})</span><input
            type="number"
            min="0.01"
            step="0.01"
            value={amounts[item.id] ?? 1}
            oninput={(event) =>
              (amounts[item.id] = Number(event.currentTarget.value))}
          /></label
        >
        <div class="supply-foot">
          <span>Reorder at {item.reorderLevel} {item.unit}</span>
          <div>
            <button
              aria-label={"Deduct stock of " + item.name}
              onclick={() => adjust(item.id, -1, item.name)}
              disabled={working.includes(item.id) || item.quantity === 0}
              ><Minus size={16} /></button
            ><button
              aria-label={"Restock " + item.name}
              onclick={() => adjust(item.id, 1, item.name)}
              disabled={working.includes(item.id)}><Plus size={16} /></button
            >
          </div>
        </div>
      </article>{:else}<div class="empty-state">
        <Package size={26} />
        <h2>No supplies in this category</h2>
        <p>Add an item to start tracking its stock.</p>
      </div>{/each}
  </div>
</div>
