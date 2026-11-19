<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    ArrowRight,
    Bell,
    Bird,
    CirclePlus,
    FileText,
    ClipboardList,
    HeartPulse,
    LayoutDashboard,
    LogOut,
    Menu,
    Package,
    Sparkles,
    RefreshCw,
    X,
  } from "@lucide/svelte";
  import Auth from "./screens/Auth.svelte";
  import Dashboard from "./screens/Dashboard.svelte";
  import Roster from "./screens/Roster.svelte";
  import Profile from "./screens/Profile.svelte";
  import Breeding from "./screens/Breeding.svelte";
  import Health from "./screens/Health.svelte";
  import Supplies from "./screens/Supplies.svelte";
  import Reports from "./screens/Reports.svelte";
  import FlockRecords from "./screens/FlockRecords.svelte";
  import More from "./screens/More.svelte";
  import Assistant from "./screens/Assistant.svelte";
  import { store } from "./lib/store.svelte";
  import { auth } from "./lib/auth.svelte";
  import { readableError } from "./lib/supabase";
  import { uploadPhoto, removePhoto } from "./lib/repository";
  import { validateBird, validDate, numberError } from "./lib/validation";
  import type { Bird as BirdRecord, ModalKind, Page } from "./lib/types";
  import { BREEDS, CUSTOM_BREED, age, formatDate, makeId, today } from "./lib/utils";
  let signedIn = $derived(store.demo || !!auth.user);
  let farmName = $derived(store.farmName);
  let page = $state<Page>("dashboard"),
    selectedBirdId = $state("");
  let flockFilter = $state("");
  let modalKind = $state<ModalKind | null>(null),
    draft = $state<Record<string, string>>({}),
    errors = $state<Record<string, string>>({});
  let toast = $state(""),
    saving = $state(false),
    photoFile = $state<File | null>(null);
  let pendingBirdDraft = $state<Record<string, string> | null>(null);
  let pendingPhoto: File | null = null;
  let modalElement: HTMLDialogElement;
  let notifications = $state<HTMLDetailsElement>();
  let toastTimer: ReturnType<typeof setTimeout>;
  onMount(() => {
    const stop = auth.initialize();
    return () => {
      stop();
      clearTimeout(toastTimer);
    };
  });
  $effect(() => {
    if (!signedIn) {
      page = "dashboard";
      flockFilter = "";
      closeModal();
    }
  });
  const nav = [
    { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
    { id: "roster" as Page, label: "Bird directory", icon: Bird },
    { id: "breeding" as Page, label: "Breeding & lineage", icon: Bird },
    { id: "health" as Page, label: "Care & schedule", icon: HeartPulse },
    { id: "supplies" as Page, label: "Supply tracker", icon: Package },
    { id: "assistant" as Page, label: "Care assistant", icon: Sparkles },
    { id: "flock-records" as Page, label: "Flock records", icon: ClipboardList },
    { id: "reports" as Page, label: "Reports", icon: FileText },
  ];
  const pageLabels: Record<Page, string> = {
    dashboard: "Dashboard",
    roster: "Bird directory",
    profile: "Bird profile",
    breeding: "Breeding & lineage",
    health: "Care & schedule",
    supplies: "Supply tracker",
    assistant: "Care assistant",
    reports: "Reports",
    "flock-records": "Flock records",
    more: "More tools",
  };
  const modalLabels: Record<
    ModalKind,
    { title: string; description: string; action: string }
  > = {
    bird: {
      title: "Register bird",
      description: "Create a profile and link its place in your farm.",
      action: "Save bird",
    },
    health: {
      title: "Log care",
      description:
        "Record a treatment, vaccination, vitamin, or routine check.",
      action: "Save care log",
    },
    breeding: {
      title: "Record pairing",
      description: "Link existing parents and record a hatch result.",
      action: "Save pairing",
    },
    supply: {
      title: "Add supply",
      description: "Track another feed, medicine, or farm item.",
      action: "Save supply",
    },
    reminder: {
      title: "Set care reminder",
      description: "Schedule a task for a bird in your farm.",
      action: "Save reminder",
    },
    pen: {
      title: "Add pen",
      description: "Create another housing location.",
      action: "Add pen",
    },
    "flock-task": {
      title: "Add daily task",
      description: "This task appears on the flock’s checklist each day.",
      action: "Save task",
    },
    "egg-collection": {
      title: "Record egg collection",
      description: "Enter the flock’s total for the selected day.",
      action: "Save collection",
    },
    flock: {
      title: "Add flock",
      description: "Group birds for easier browsing in the dashboard and directory.",
      action: "Save flock",
    },
  };
  let pendingCount = $derived(
    store.reminders.filter((item) => !item.done).length,
  );
  let alertCount = $derived(pendingCount + store.lowStock.length);
  function navigate(next: Page, birdId?: string) {
    if (notifications) notifications.open = false;
    if (birdId) selectedBirdId = birdId;
    page = next;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function notify(message: string) {
    toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ""), 5000);
  }
  function enter() {
    store.startDemo();
    navigate("dashboard");
  }
  async function signOut() {
    try {
      if (store.demo) store.reset();
      else await auth.signOut();
      notify("Signed out");
    } catch (error) {
      notify(readableError(error));
    }
  }
  async function refresh() {
    try {
      await store.refresh();
      notify("Farm records refreshed");
    } catch (error) {
      store.error = readableError(error);
    }
  }
  async function open(kind: ModalKind, values: Record<string, string> = {}) {
    errors = {};
    modalKind = kind;
    photoFile = null;
    if (kind === "bird") {
      const bird = values.id
          ? store.birds.find((item) => item.id === values.id)
          : undefined,
        base = bird || store.createEmptyBird();
      draft = {
        ...Object.fromEntries(
          Object.entries(base).map(([key, value]) => [
            key,
            String(value ?? ""),
          ]),
        ),
        breedChoice: BREEDS.some((breed) => breed === base.breed) ? base.breed : CUSTOM_BREED,
        weight: String(base.weight || ""),
        photo: base.photo || "",
        ...values,
      };
    } else if (kind === "health")
      draft = {
        id: makeId("HL"),
        targetType: "bird",
        targetId: store.birds[0]?.id || "",
        category: "Vaccination",
        date: today(),
        notes: "",
        supplyId: "",
        quantityUsed: "",
        ...values,
      };
    else if (kind === "breeding") {
      const record = values.id
        ? store.breeding.find((item) => item.id === values.id)
        : undefined;
      draft = {
        sireId:
          store.birds.find(
            (item) =>
              item.sex === "Male" && ["Active", "Brood"].includes(item.status),
          )?.id || "",
        damId:
          store.birds.find(
            (item) =>
              item.sex === "Female" &&
              ["Active", "Brood"].includes(item.status),
          )?.id || "",
        matingDate: today(),
        eggsCount: "0",
        hatchedCount: "0",
        notes: "",
        ...Object.fromEntries(
          Object.entries(record || {}).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
        ...values,
      };
    } else if (kind === "supply") {
      const record = values.id
        ? store.supplies.find((item) => item.id === values.id)
        : undefined;
      draft = {
        name: "",
        category: "Feed",
        quantity: "0",
        unit: "kg",
        reorderLevel: "0",
        ...Object.fromEntries(
          Object.entries(record || {}).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
        ...values,
      };
    } else if (kind === "reminder")
      draft = {
        birdId: store.birds[0]?.id || "",
        description: "",
        dueDate: today(),
        ...values,
      };
    else if (kind === "flock") {
      const flock = store.flocks.find((item) => item.id === values.id);
      draft = { name: flock?.name ?? "", ...values };
    } else if (kind === "egg-collection") {
      const entry = store.eggCollections.find((item) => item.id === values.id);
      draft = {
        count: entry ? String(entry.count) : "",
        notes: entry?.notes || "",
        version: String(entry?.version || 1),
        ...values,
      };
    } else draft = { name: "", ...values };
    await tick();
    modalElement?.showModal();
  }
  function closeModal() {
    if (saving) return;
    if (modalElement?.open) modalElement.close();
    if (modalKind === "pen") {
      pendingBirdDraft = null;
      pendingPhoto = null;
    }
    modalKind = null;
    draft = {};
    errors = {};
    photoFile = null;
  }
  async function submitModal(event: SubmitEvent) {
    event.preventDefault();
    if (!modalKind || saving) return;
    const kind = modalKind,
      next: Record<string, string> = {};
    const required = (key: string, message: string) => {
      if (!String(draft[key] ?? "").trim()) next[key] = message;
    };
    const date = (key: string, future = false) => {
      if (!validDate(draft[key] || "") || (!future && draft[key]! > today()))
        next[key] =
          "Choose a valid date" +
          (future ? "." : " that is not in the future.");
    };
    let bird: BirdRecord | undefined;
    if (kind === "bird") {
      bird = {
        id: draft.id!,
        name: (draft.name || "").trim(),
        breed: (draft.breedChoice === CUSTOM_BREED ? draft.breed : draft.breedChoice)?.trim() || "",
        bloodline: draft.bloodline?.trim() || "",
        flockId: draft.flockId || "",
        sex: draft.sex as BirdRecord["sex"],
        color: (draft.color || "").trim(),
        hatchDate: draft.hatchDate || "",
        weight: draft.weight === "" ? 0 : Number(draft.weight),
        status: draft.status as BirdRecord["status"],
        penId: draft.penId || "",
        sireId: draft.sireId || "",
        damId: draft.damId || "",
        breedingId: draft.breedingId || "",
        breeder: draft.breeder?.trim() || "",
        pedigreeNotes: draft.pedigreeNotes?.trim() || "",
        photo: draft.photo || undefined,
        photoPath: draft.photoPath || undefined,
        version: draft.version ? Number(draft.version) : undefined,
      };
      Object.assign(
        next,
        validateBird(bird, store.birds, store.breeding, today()),
      );
    } else if (kind === "health") {
      required("targetId", "Choose a bird or pen.");
      required("notes", "Describe the care provided.");
      date("date");
      if (
        draft.supplyId &&
        (numberError(draft.quantityUsed) || Number(draft.quantityUsed) <= 0)
      )
        next.quantityUsed = "Enter a positive quantity used.";
    } else if (kind === "breeding") {
      required("sireId", "Choose an available sire.");
      required("damId", "Choose an available dam.");
      date("matingDate");
      if (numberError(draft.eggsCount, true))
        next.eggsCount = "Enter a whole number of eggs, zero or more.";
      if (
        numberError(draft.hatchedCount, true) ||
        Number(draft.hatchedCount) > Number(draft.eggsCount)
      )
        next.hatchedCount =
          "Hatched chicks must be a whole number no greater than the eggs set.";
    } else if (kind === "supply") {
      required("name", "Enter an item name.");
      required("unit", "Enter a unit, such as kg or bottles.");
      if (numberError(draft.quantity))
        next.quantity = "Enter a quantity of zero or more.";
      if (numberError(draft.reorderLevel))
        next.reorderLevel = "Enter a reorder level of zero or more.";
    } else if (kind === "reminder") {
      required("birdId", "Choose a bird.");
      required("description", "Describe the care task.");
      date("dueDate", true);
    } else if (kind === "flock-task") {
      required("name", "Enter a task name.");
    } else if (kind === "egg-collection") {
      date("date");
      if (numberError(draft.count, true) || Number(draft.count) > 100000)
        next.count = "Enter a whole number from 0 to 100,000.";
    } else required("name", kind === "flock" ? "Enter a flock name." : "Enter a pen name.");
    errors = next;
    if (Object.keys(next).length) {
      await tick();
      modalElement
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
      return;
    }
    saving = true;
    let uploadedPath = "";
    try {
      if (kind === "bird" && bird) {
        const exists = store.birds.some((item) => item.id === bird!.id),
          oldPath = bird.photoPath;
        if (photoFile && !store.demo) {
          uploadedPath = await uploadPhoto(store.farmId, bird.id, photoFile);
          bird.photoPath = uploadedPath;
        }
        if (exists) await store.updateBird(bird);
        else await store.addBird(bird);
        uploadedPath = ""; // The record now owns this object; don't delete it during later error handling.
        if (oldPath && oldPath !== bird.photoPath && !store.demo)
          void removePhoto(oldPath).catch(() =>
            notify("Profile saved. An older photo could not be removed."),
          );
        saving = false;
        closeModal();
        notify(
          exists ? "Bird profile updated" : bird.name + " added to your farm",
        );
        navigate("profile", bird.id);
      } else if (kind === "health") {
        await store.addHealth(
          {
            id: draft.id || makeId("HL"),
            targetType: draft.targetType as "bird" | "pen",
            targetId: draft.targetId!,
            category: draft.category as
              "Vaccination" | "Vitamin" | "Medication" | "Routine care",
            date: draft.date!,
            notes: draft.notes!.trim(),
          },
          draft.supplyId,
          Number(draft.quantityUsed) || 0,
        );
        saving = false;
        closeModal();
        notify("Care log saved");
        navigate("health");
      } else if (kind === "breeding") {
        await store.saveBreeding({
          id: draft.id || makeId("BR"),
          sireId: draft.sireId!,
          damId: draft.damId!,
          matingDate: draft.matingDate!,
          eggsCount: Number(draft.eggsCount),
          hatchedCount: Number(draft.hatchedCount),
          notes: draft.notes?.trim() || "",
          version: draft.version ? Number(draft.version) : undefined,
        });
        saving = false;
        closeModal();
        notify("Pairing saved");
        navigate("breeding");
      } else if (kind === "supply") {
        await store.saveSupply({
          id: draft.id || makeId("SI"),
          name: draft.name!.trim(),
          category: draft.category as
            "Feed" | "Vitamin" | "Medicine" | "Equipment",
          quantity: Number(draft.quantity),
          unit: draft.unit!.trim(),
          reorderLevel: Number(draft.reorderLevel),
          version: draft.version ? Number(draft.version) : undefined,
        });
        saving = false;
        closeModal();
        notify("Supply saved");
        navigate("supplies");
      } else if (kind === "reminder") {
        await store.addReminder({
          id: makeId("R"),
          birdId: draft.birdId!,
          description: draft.description!.trim(),
          dueDate: draft.dueDate!,
          done: false,
        });
        saving = false;
        closeModal();
        notify("Care reminder scheduled");
        navigate("health");
      } else if (kind === "flock-task" || kind === "egg-collection") {
        if (kind === "flock-task") {
          await store.addFlockTask(draft.flockId!, draft.name!.trim());
        } else {
          await store.saveEggCollection({
            id: draft.id || makeId("EGG"),
            flockId: draft.flockId!,
            date: draft.date!,
            count: Number(draft.count),
            notes: draft.notes?.trim() || "",
            version: Number(draft.version),
          }, !!draft.id);
        }
        saving = false;
        closeModal();
        notify(kind === "flock-task" ? "Daily task added" : "Egg collection saved");
      } else if (kind === "flock") {
        const flock = await store.saveFlock(draft.name!.trim(), draft.id);
        const editing = !!draft.id;
        flockFilter = flock.id;
        saving = false;
        closeModal();
        notify(editing ? "Flock renamed" : "Flock added");
      } else if (kind === "pen") {
        const pen = await store.addPen(draft.name!.trim()),
          previous = pendingBirdDraft,
          file = pendingPhoto;
        pendingBirdDraft = null;
        pendingPhoto = null;
        saving = false;
        closeModal();
        notify("Pen added");
        if (previous) {
          await open("bird", { ...previous, penId: pen.id });
          photoFile = file;
        }
      }
    } catch (error) {
      if (uploadedPath) await removePhoto(uploadedPath).catch(() => {});
      errors = { form: readableError(error) };
    } finally {
      saving = false;
    }
  }
  function handlePhoto(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      errors = { photo: "Choose a JPG, PNG, or WebP photo up to 5 MB." };
      return;
    }
    photoFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      draft.photo = String(reader.result || "");
      errors = {};
    };
    reader.readAsDataURL(file);
  }
</script>

{#if !auth.ready || (auth.loading && !signedIn)}
  <main class="loading-screen" role="status">Loading your farm…</main>
{:else if !signedIn || auth.recovering}
  <Auth onEnter={enter} />
{:else}
  <div class="app-shell">
    <aside class="sidebar">
      <button
        class="sidebar-brand"
        onclick={() => navigate("dashboard")}
        aria-label="Sabong dashboard"
        ><span class="brand-mark"><img src="/sabong-mark.png" alt="" /></span
        ><span><strong>SABONG</strong><small>Poultry manager</small></span
        ></button
      >
      <div class="farm-switch">
        <span class="farm-initial">{farmName.charAt(0)}</span><span
          ><strong>{farmName}</strong><small
            >{store.demo ? "Sample workspace" : "Private farm"}</small
          ></span
        >
      </div>
      <div class="sidebar-section-label">Workspace</div>
      <nav class="side-nav" aria-label="Main navigation">
        {#each nav as item}
          {@const Icon = item.icon}
          <button
            class:current={page === item.id ||
              (page === "profile" && item.id === "roster")}
            onclick={() => navigate(item.id)}
            ><Icon size={19} strokeWidth={1.8} /><span>{item.label}</span
            >{#if item.id === "health" && pendingCount}<small
                >{pendingCount}</small
              >{/if}</button
          >
        {/each}
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-help">
          <Bell size={18} /><span
            ><strong>Stay on schedule</strong><small
              >{pendingCount} care reminders ahead</small
            ></span
          >
        </div>
        <button class="logout-button" onclick={signOut}
          ><LogOut size={18} /> Sign out</button
        >
      </div>
    </aside>
    <div class="app-main">
      <header class="topbar">
        <div class="mobile-top-brand">
          <img src="/sabong-mark.png" alt="" /><strong>SABONG</strong>
        </div>
        <div class="breadcrumb">
          <span>Workspace</span><ArrowRight size={14} /><strong
            >{pageLabels[page]}</strong
          >
        </div>
        <div class="topbar-actions">
          <span class="demo-badge"
            >{store.demo ? "Sample demo" : "Cloud connected"}</span
          >{#if !store.demo}<button
              class="icon-button"
              aria-label="Refresh records"
              disabled={store.busy}
              onclick={refresh}><RefreshCw size={18} /></button
            >{/if}
          <details class="notification-menu" bind:this={notifications}>
            <summary class="topbar-notification" aria-label={`Notifications (${alertCount})`}>
              <Bell size={19} />
              {#if alertCount}<span class="notification-count" aria-hidden="true">{alertCount > 99 ? "99+" : alertCount}</span>{/if}
            </summary>
            <div class="panel notification-panel">
              <h2>Notifications</h2>
              {#if store.lowStock.length}
                <button class="secondary-button" onclick={() => navigate("supplies")}>
                  {store.lowStock.length} {store.lowStock.length === 1 ? "item needs" : "items need"} restocking
                </button>
              {/if}
              {#if pendingCount}
                <button class="secondary-button" onclick={() => navigate("health")}>
                  {pendingCount} open care {pendingCount === 1 ? "reminder" : "reminders"}
                </button>
              {/if}
              {#if !alertCount}<p class="muted-note">No open notifications.</p>{/if}
            </div>
          </details>
          <span class="user-avatar" title={farmName}>{farmName.charAt(0)}</span
          ><button class="mobile-logout" aria-label="Sign out" onclick={signOut}
            ><LogOut size={19} /></button
          >
        </div>
      </header>
      <main class="content" id="main-content">
        {#if store.demo}<p class="workspace-notice">
            Sample mode: changes are temporary. Sign out to use a real farm
            account.
          </p>{/if}
        {#if store.error}<p class="form-error" role="alert">
            {store.error}
            <button class="text-button" onclick={refresh}>Retry</button>
          </p>{/if}
        {#if store.photoWarning}<p class="workspace-notice">
            {store.photoWarning}
          </p>{/if}
        {#if page === "dashboard"}<Dashboard {navigate} {open} {farmName} bind:flockFilter />
        {:else if page === "roster"}<Roster {navigate} {open} bind:flockFilter />
        {:else if page === "profile"}<Profile
            birdId={selectedBirdId}
            {navigate}
            {open}
            {notify}
          />
        {:else if page === "breeding"}<Breeding {navigate} {open} />
        {:else if page === "health"}<Health {open} {notify} />
        {:else if page === "supplies"}<Supplies {open} {notify} />
        {:else if page === "assistant"}<Assistant />
        {:else if page === "flock-records"}<FlockRecords {open} initialFlock={flockFilter} viewBirds={() => navigate("roster")} />
        {:else if page === "reports"}<Reports {farmName} />
        {:else}<More {navigate} />{/if}
      </main>
    </div>
    <nav class="mobile-nav" aria-label="Mobile navigation">
      <button
        class:current={page === "dashboard"}
        onclick={() => navigate("dashboard")}
        ><LayoutDashboard size={21} /><span>Home</span></button
      >
      <button
        class:current={page === "roster" || page === "profile"}
        onclick={() => navigate("roster")}
        ><Bird size={21} /><span>Birds</span></button
      >
      <button
        class="mobile-add"
        aria-label="Register bird"
        onclick={() => open("bird")}
        ><CirclePlus size={27} /><span>Add</span></button
      >
      <button
        class:current={page === "health"}
        onclick={() => navigate("health")}
        ><HeartPulse size={21} /><span>Care</span></button
      >
      <button
        class:current={!["dashboard", "roster", "profile", "health"].includes(
          page,
        )}
        onclick={() => navigate("more")}
        ><Menu size={21} /><span>More</span></button
      >
    </nav>
  </div>
{/if}

<dialog
  class="form-dialog"
  bind:this={modalElement}
  onclose={() => {
    if (!modalElement.open && !saving) modalKind = null;
  }}
  oncancel={(event) => {
    if (saving) event.preventDefault();
  }}
  onclick={(event) => {
    if (event.target === modalElement) closeModal();
  }}
>
  {#if modalKind}
    <div class="dialog-header">
      <div>
        <p class="kicker">Sabong records</p>
        <h2>
          {draft.id &&
          modalKind === "bird" &&
          store.birds.some((item) => item.id === draft.id)
            ? "Edit bird profile"
            : modalKind === "flock" && draft.id ? "Rename flock" : modalLabels[modalKind].title}
        </h2>
        <p>{modalLabels[modalKind].description}</p>
      </div>
      <button class="icon-button" aria-label="Close form" onclick={closeModal}
        ><X size={20} /></button
      >
    </div>
    <form class="dialog-form" onsubmit={submitModal} novalidate>
      {#if Object.keys(errors).length}<div class="error-summary" role="alert">
          {errors.form || "Please correct the highlighted fields."}
        </div>{/if}
      <fieldset disabled={saving} class="form-fields">
        {#if modalKind === "bird"}
          <label class="photo-upload"
            ><span class="bird-photo-preview"
              >{#if draft.photo}<img
                  src={draft.photo}
                  alt="Selected bird"
                />{:else}<Bird size={28} />{/if}</span
            ><span
              >{draft.photo ? "Change photo" : "Add bird photo"}<small
                >Choose a photo or use your camera</small
              ></span
            ><input
              type="file"
              accept="image/*"
              onchange={handlePhoto}
            /></label
          >{#if errors.photo}<p class="field-error" role="alert">
              {errors.photo}
            </p>{/if}
          <label class="inline-link camera-choice"
            >Take photo
            <input
              class="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onchange={handlePhoto}
            />
          </label>
          <div class="form-grid">
            <label class="field"
              ><span>Bird name <b>*</b></span><input
                bind:value={draft.name}
                aria-invalid={!!errors.name}
                placeholder="e.g. Atlas"
              />{#if errors.name}<small class="field-error">{errors.name}</small
                >{/if}</label
            >
            <label class="field">
              <span>Breed <b>*</b></span>
              <select bind:value={draft.breedChoice}>
                {#each BREEDS as breed}<option value={breed}>{breed}</option>{/each}
                <option value={CUSTOM_BREED}>Custom breed</option>
              </select>
            </label>
            {#if draft.breedChoice === CUSTOM_BREED}
              <label class="field">
                <span>Custom breed <b>*</b></span>
                <input bind:value={draft.breed} aria-invalid={!!errors.breed} />
                {#if errors.breed}<small class="field-error">{errors.breed}</small>{/if}
              </label>
            {/if}
            <label class="field">
              <span>Strain or bloodline (optional)</span>
              <input bind:value={draft.bloodline} />
            </label>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>Flock (optional)</span>
              <select bind:value={draft.flockId}>
                <option value="">Unassigned</option>
                {#each store.flocks as flock (flock.id)}
                  <option value={flock.id}>{flock.name}</option>
                {/each}
              </select>
            </label
            ><label class="field"
              ><span>Sex</span><select bind:value={draft.sex}
                ><option>Male</option><option>Female</option></select
              ></label
            >
          </div>
          <div class="form-grid">
            <label class="field"
              ><span>Color / markings <b>*</b></span><input
                bind:value={draft.color}
                aria-invalid={!!errors.color}
                placeholder="e.g. Red and black"
              />{#if errors.color}<small class="field-error"
                  >{errors.color}</small
                >{/if}</label
            ><label class="field"
              ><span>Hatch date <b>*</b></span><input
                type="date"
                bind:value={draft.hatchDate}
                aria-invalid={!!errors.hatchDate}
                max={today()}
              />{#if errors.hatchDate}<small class="field-error"
                  >{errors.hatchDate}</small
                >{:else}<small class="field-hint">{age(draft.hatchDate)}</small
                >{/if}</label
            >
          </div>
          <div class="form-grid">
            <label class="field"
              ><span>Pen</span><select bind:value={draft.penId}
                ><option value="">Unassigned</option
                >{#each store.pens as pen}<option value={pen.id}
                    >{pen.name}</option
                  >{/each}</select
              ></label
            ><label class="field"
              ><span>Status</span><select bind:value={draft.status}
                ><option>Active</option><option>Brood</option><option
                  >Sold</option
                ><option>Deceased</option></select
              ></label
            >
          </div>
          <button
            type="button"
            class="inline-link"
            onclick={() => {
              pendingBirdDraft = { ...draft };
              pendingPhoto = photoFile;
              closeModal();
              open("pen");
            }}>Add a new pen</button
          >
          <div class="form-grid">
            <label class="field"
              ><span>Sire</span><select
                bind:value={draft.sireId}
                aria-invalid={!!errors.sireId}
                ><option value="">Unknown</option
                >{#each store.birds.filter((item) => item.sex === "Male" && item.id !== draft.id) as bird}<option
                    value={bird.id}>{bird.name}</option
                  >{/each}</select
              ></label
            ><label class="field"
              ><span>Dam</span><select
                bind:value={draft.damId}
                aria-invalid={!!errors.damId}
                ><option value="">Unknown</option
                >{#each store.birds.filter((item) => item.sex === "Female" && item.id !== draft.id) as bird}<option
                    value={bird.id}>{bird.name}</option
                  >{/each}</select
              >{#if errors.damId}<small class="field-error"
                  >{errors.damId}</small
                >{/if}</label
            >
          </div>
          <label class="field"
            ><span>Breeding record</span><select
              bind:value={draft.breedingId}
              aria-invalid={!!errors.breedingId}
              onchange={() => {
                const pair = store.breeding.find(
                  (item) => item.id === draft.breedingId,
                );
                if (pair) {
                  draft.sireId = pair.sireId;
                  draft.damId = pair.damId;
                }
              }}
              ><option value="">No pairing linked</option
              >{#each store.breeding as pair}<option value={pair.id}
                  >{pair.id} · {pair.matingDate}</option
                >{/each}</select
            >{#if errors.breedingId}<small class="field-error"
                >{errors.breedingId}</small
              >{/if}</label
          >
          <div class="form-grid">
            <label class="field"
              ><span>Weight (kg)</span><input
                type="number"
                step="0.01"
                min="0"
                bind:value={draft.weight}
                aria-invalid={!!errors.weight}
              />{#if errors.weight}<small class="field-error"
                  >{errors.weight}</small
                >{/if}</label
            ><label class="field"
              ><span>Breeder</span><input
                bind:value={draft.breeder}
                placeholder="Farm or breeder name"
              /></label
            >
          </div>
          <label class="field"
            ><span>Pedigree notes</span><textarea
              rows="3"
              bind:value={draft.pedigreeNotes}
              placeholder="Traits, ancestry, and notes"></textarea></label
          >
        {:else if modalKind === "health"}
          <div class="form-grid">
            <label class="field"
              ><span>Apply to</span><select
                bind:value={draft.targetType}
                onchange={() =>
                  (draft.targetId =
                    draft.targetType === "bird"
                      ? store.birds[0]?.id || ""
                      : store.pens[0]?.id || "")}
                ><option value="bird">Single bird</option><option value="pen"
                  >Entire pen</option
                ></select
              ></label
            ><label class="field"
              ><span
                >{draft.targetType === "bird" ? "Bird" : "Pen"} <b>*</b></span
              ><select
                bind:value={draft.targetId}
                aria-invalid={!!errors.targetId}
                >{#if draft.targetType === "bird"}{#each store.birds as bird}<option
                      value={bird.id}>{bird.name}</option
                    >{/each}{:else}{#each store.pens as pen}<option
                      value={pen.id}>{pen.name}</option
                    >{/each}{/if}</select
              >{#if errors.targetId}<small class="field-error"
                  >{errors.targetId}</small
                >{/if}</label
            >
          </div>
          <div class="form-grid">
            <label class="field"
              ><span>Care type</span><select bind:value={draft.category}
                ><option>Vaccination</option><option>Vitamin</option><option
                  >Medication</option
                ><option>Routine care</option></select
              ></label
            ><label class="field"
              ><span>Date</span><input
                type="date"
                bind:value={draft.date}
                aria-invalid={!!errors.date}
                max={today()}
              />{#if errors.date}<small class="field-error">{errors.date}</small
                >{/if}</label
            >
          </div>
          <label class="field"
            ><span>Notes <b>*</b></span><textarea
              rows="4"
              bind:value={draft.notes}
              aria-invalid={!!errors.notes}
              placeholder="Treatment, dosage, and observations"
            ></textarea>{#if errors.notes}<small class="field-error"
                >{errors.notes}</small
              >{/if}</label
          >
          <div class="form-grid">
            <label class="field"
              ><span>Deduct supply (optional)</span><select
                bind:value={draft.supplyId}
                ><option value="">No stock used</option
                >{#each store.supplies as item}<option value={item.id}
                    >{item.name} ({item.quantity} {item.unit})</option
                  >{/each}</select
              ></label
            >{#if draft.supplyId}<label class="field"
                ><span>Quantity used</span><input
                  type="number"
                  min="0.01"
                  step="0.01"
                  bind:value={draft.quantityUsed}
                  aria-invalid={!!errors.quantityUsed}
                />{#if errors.quantityUsed}<small class="field-error"
                    >{errors.quantityUsed}</small
                  >{/if}</label
              >{/if}
          </div>
        {:else if modalKind === "breeding"}
          <div class="form-grid">
            <label class="field"
              ><span>Sire <b>*</b></span><select
                bind:value={draft.sireId}
                aria-invalid={!!errors.sireId}
                >{#each store.birds.filter((item) => item.sex === "Male" && (["Active", "Brood"].includes(item.status) || (draft.id && item.id === draft.sireId))) as bird}<option
                    value={bird.id}>{bird.name} · {bird.breed || "Unknown breed"}</option
                  >{/each}</select
              >{#if errors.sireId}<small class="field-error"
                  >{errors.sireId}</small
                >{/if}</label
            ><label class="field"
              ><span>Dam <b>*</b></span><select
                bind:value={draft.damId}
                aria-invalid={!!errors.damId}
                >{#each store.birds.filter((item) => item.sex === "Female" && (["Active", "Brood"].includes(item.status) || (draft.id && item.id === draft.damId))) as bird}<option
                    value={bird.id}>{bird.name} · {bird.breed || "Unknown breed"}</option
                  >{/each}</select
              >{#if errors.damId}<small class="field-error"
                  >{errors.damId}</small
                >{/if}</label
            >
          </div>
          <div class="form-grid">
            <label class="field"
              ><span>Mating date</span><input
                type="date"
                bind:value={draft.matingDate}
                max={today()}
                aria-invalid={!!errors.matingDate}
              />{#if errors.matingDate}<small class="field-error"
                  >{errors.matingDate}</small
                >{/if}</label
            ><label class="field"
              ><span>Eggs set</span><input
                type="number"
                min="0"
                step="1"
                bind:value={draft.eggsCount}
                aria-invalid={!!errors.eggsCount}
              />{#if errors.eggsCount}<small class="field-error"
                  >{errors.eggsCount}</small
                >{/if}</label
            >
          </div>
          <label class="field"
            ><span>Chicks hatched</span><input
              type="number"
              min="0"
              bind:value={draft.hatchedCount}
              aria-invalid={!!errors.hatchedCount}
            />{#if errors.hatchedCount}<small class="field-error"
                >{errors.hatchedCount}</small
              >{/if}</label
          ><label class="field"
            ><span>Notes</span><textarea
              rows="3"
              bind:value={draft.notes}
              placeholder="Pairing notes"></textarea></label
          >
        {:else if modalKind === "supply"}
          <label class="field"
            ><span>Item name <b>*</b></span><input
              bind:value={draft.name}
              aria-invalid={!!errors.name}
              placeholder="e.g. Grower feed"
            />{#if errors.name}<small class="field-error">{errors.name}</small
              >{/if}</label
          >
          <div class="form-grid">
            <label class="field"
              ><span>Category</span><select bind:value={draft.category}
                ><option>Feed</option><option>Vitamin</option><option
                  >Medicine</option
                ><option>Equipment</option></select
              ></label
            ><label class="field"
              ><span>Unit <b>*</b></span><input
                bind:value={draft.unit}
                aria-invalid={!!errors.unit}
                placeholder="kg, bottles, vials"
              />{#if errors.unit}<small class="field-error">{errors.unit}</small
                >{/if}</label
            >
          </div>
          <div class="form-grid">
            <label class="field"
              ><span>Starting quantity</span><input
                type="number"
                min="0"
                step="0.01"
                bind:value={draft.quantity}
                disabled={!!draft.id}
                aria-invalid={!!errors.quantity}
              />{#if draft.id}<small class="field-hint"
                  >Use the stock adjustment controls to change the balance.</small
                >{/if}{#if errors.quantity}<small class="field-error"
                  >{errors.quantity}</small
                >{/if}</label
            ><label class="field"
              ><span>Low stock alert at</span><input
                type="number"
                min="0"
                step="0.01"
                bind:value={draft.reorderLevel}
                aria-invalid={!!errors.reorderLevel}
              />{#if errors.reorderLevel}<small class="field-error"
                  >{errors.reorderLevel}</small
                >{/if}</label
            >
          </div>
        {:else if modalKind === "reminder"}
          <label class="field"
            ><span>Bird <b>*</b></span><select
              bind:value={draft.birdId}
              aria-invalid={!!errors.birdId}
              >{#each store.birds as bird}<option value={bird.id}
                  >{bird.name}</option
                >{/each}</select
            >{#if errors.birdId}<small class="field-error"
                >{errors.birdId}</small
              >{/if}</label
          ><label class="field"
            ><span>Care task <b>*</b></span><input
              bind:value={draft.description}
              aria-invalid={!!errors.description}
              placeholder="e.g. Deworming"
            />{#if errors.description}<small class="field-error"
                >{errors.description}</small
              >{/if}</label
          ><label class="field"
            ><span>Due date</span><input
              type="date"
              bind:value={draft.dueDate}
              aria-invalid={!!errors.dueDate}
            />{#if errors.dueDate}<small class="field-error"
                >{errors.dueDate}</small
              >{/if}</label
          >
        {:else if modalKind === "egg-collection"}
          <p class="muted-note">{formatDate(draft.date || "")}</p>
          <label class="field">
            <span>Eggs collected <b>*</b></span>
            <input type="number" min="0" max="100000" step="1" value={draft.count} oninput={(event) => (draft.count = event.currentTarget.value)} aria-invalid={!!errors.count} />
            {#if errors.count}<small class="field-error">{errors.count}</small>{/if}
          </label>
          <label class="field">
            <span>Notes (optional)</span>
            <textarea maxlength="500" bind:value={draft.notes}></textarea>
          </label>
        {:else if modalKind === "flock-task"}
          <label class="field">
            <span>Task name <b>*</b></span>
            <input maxlength="120" bind:value={draft.name} aria-invalid={!!errors.name} placeholder="e.g. Check waterers" />
            {#if errors.name}<small class="field-error">{errors.name}</small>{/if}
          </label>
        {:else}
          <label class="field"
            ><span>{modalKind === "flock" ? "Flock name" : "Pen name"} <b>*</b></span><input
              bind:value={draft.name}
              maxlength={120}
              aria-invalid={!!errors.name}
              placeholder={modalKind === "flock" ? "e.g. Backyard flock" : "e.g. Pen 7"}
            />{#if errors.name}<small class="field-error">{errors.name}</small
              >{/if}</label
          >
        {/if}
      </fieldset>
      <div class="dialog-actions">
        <button
          type="button"
          class="secondary-button"
          disabled={saving}
          onclick={closeModal}>Cancel</button
        ><button type="submit" class="primary-button" disabled={saving}
          >{saving ? "Saving…" : modalLabels[modalKind].action}
          <ArrowRight size={17} /></button
        >
      </div>
    </form>
  {/if}
</dialog>
{#if toast}<div class="toast" role="status">{toast}</div>{/if}
