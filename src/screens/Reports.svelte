<script lang="ts">
  import { Download, FileText, Printer } from "@lucide/svelte";
  import { store } from "../lib/store.svelte";
  import { age, birdName, formatDate, today } from "../lib/utils";
  import { csv } from "../lib/csv";
  let { farmName }: { farmName: string } = $props();
  type Report = "Birds" | "Health" | "Breeding" | "Supplies";
  let report = $state<Report>("Birds");
  let from = $state(""),
    to = $state("");
  const included = (date: string) =>
    (!from || date >= from) && (!to || date <= to);
  let rows = $derived.by((): string[][] => {
    if (report === "Birds")
      return store.birds
        .filter((bird) => included(bird.hatchDate))
        .map((bird) => [
          bird.id,
          bird.name,
          bird.breed,
          bird.bloodline,
          formatDate(bird.hatchDate),
          age(bird.hatchDate),
          bird.status,
          store.pens.find((p) => p.id === bird.penId)?.name || "Unassigned",
          bird.breeder,
          bird.sireId ? birdName(store.birds, bird.sireId) : "Unknown",
          bird.damId ? birdName(store.birds, bird.damId) : "Unknown",
          bird.pedigreeNotes,
        ]);
    if (report === "Health")
      return store.health
        .filter((log) => included(log.date))
        .map((log) => [
          formatDate(log.date),
          log.category,
          log.targetType === "bird"
            ? birdName(store.birds, log.targetId)
            : store.pens.find((p) => p.id === log.targetId)?.name || "Pen",
          log.notes,
        ]);
    if (report === "Breeding")
      return store.breeding
        .filter((item) => included(item.matingDate))
        .map((item) => [
          item.id,
          formatDate(item.matingDate),
          birdName(store.birds, item.sireId),
          birdName(store.birds, item.damId),
          String(item.eggsCount),
          String(item.hatchedCount),
          item.eggsCount
            ? Math.round((item.hatchedCount / item.eggsCount) * 100) + "%"
            : "0%",
          String(store.birds.filter((b) => b.breedingId === item.id).length),
        ]);
    return store.supplies.map((item) => [
      item.name,
      item.category,
      item.quantity + " " + item.unit,
      item.reorderLevel + " " + item.unit,
      item.quantity <= item.reorderLevel ? "Low stock" : "In stock",
    ]);
  });
  let headings = $derived(
    report === "Birds"
      ? [
          "ID",
          "Name",
          "Breed",
          "Bloodline",
          "Hatch date",
          "Age",
          "Status",
          "Pen",
          "Breeder",
          "Sire",
          "Dam",
          "Notes",
        ]
      : report === "Health"
        ? ["Date", "Care type", "Target", "Notes"]
        : report === "Breeding"
          ? [
              "ID",
              "Date",
              "Sire",
              "Dam",
              "Eggs",
              "Hatched",
              "Rate",
              "Linked offspring",
            ]
          : ["Item", "Category", "Balance", "Reorder at", "Status"],
  );
  function download() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv([headings, ...rows])], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "farm-" + report.toLowerCase() + "-" + today() + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
</script>

<div class="page-stack print-page">
  <div class="page-heading">
    <div>
      <p class="kicker">Farm records</p>
      <h1>Reports</h1>
      <p class="page-lead">
        Printable views and CSV exports of your farm data.
      </p>
    </div>
    <div class="heading-actions print-hide">
      <button class="secondary-button" onclick={download}
        ><Download size={18} /> Download CSV</button
      ><button class="primary-button" onclick={() => window.print()}
        ><Printer size={18} /> Print report</button
      >
    </div>
  </div>
  <div class="report-types print-hide">
    {#each ["Birds", "Health", "Breeding", "Supplies"] as kind}<button
        class:current={report === kind}
        onclick={() => (report = kind as Report)}
        ><FileText size={18} /> {kind}</button
      >{/each}
  </div>
  {#if report !== "Supplies"}<div class="form-grid print-hide">
      <label class="field"
        ><span
          >From date ({report === "Birds"
            ? "hatch"
            : report === "Health"
              ? "care"
              : "mating"})</span
        ><input type="date" bind:value={from} /></label
      ><label class="field"
        ><span>To date</span><input
          type="date"
          bind:value={to}
          min={from}
        /></label
      >
    </div>{/if}
  <section class="panel report-panel">
    <div class="report-head">
      <div>
        <span class="brand-small">SABONG</span>
        <h2>{report} report</h2>
        <p>{farmName} · Generated {formatDate(today())}</p>
        {#if report !== "Supplies" && (from || to)}<p>
            {from ? formatDate(from) : "All dates"} — {to
              ? formatDate(to)
              : "Present"}
          </p>{/if}
      </div>
      <span class="tag">{rows.length} records</span>
    </div>
    <div class="table-scroll">
      <table>
        <thead
          ><tr
            >{#each headings as heading}<th scope="col">{heading}</th
              >{/each}</tr
          ></thead
        ><tbody
          >{#each rows as row}<tr
              >{#each row as cell}<td>{cell}</td>{/each}</tr
            >{/each}</tbody
        >
      </table>
    </div>
    {#if !rows.length}<p class="muted-note">
        No records are available for this report.
      </p>{/if}
  </section>
</div>
