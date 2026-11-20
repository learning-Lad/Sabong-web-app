import type { Bird, BreedingRecord, HealthLog, Flock, Pen, Reminder, Supply } from './types'
import { offsetDate } from './utils'

class DemoStore {
  birds = $state<Bird[]>([
    { id: 'GF-001', name: 'Atlas', breed: 'Rhode Island Red', bloodline: '', flockId: 'F-1', sex: 'Male', color: 'Red and black', hatchDate: '2024-03-18', weight: 2.6, status: 'Active', penId: 'P-1', sireId: '', damId: '', breeder: 'San Isidro Farm', pedigreeNotes: 'Strong frame and quick recovery.' },
    { id: 'GF-002', name: 'Sable', breed: 'Plymouth Rock', bloodline: '', flockId: 'F-1', sex: 'Female', color: 'Black', hatchDate: '2024-07-09', weight: 2.1, status: 'Brood', penId: 'P-2', sireId: '', damId: '', breeder: 'San Isidro Farm', pedigreeNotes: 'Recorded as a Plymouth Rock.' },
    { id: 'GF-003', name: 'Copper', breed: 'Mixed / Crossbreed', bloodline: '', flockId: 'F-1', sex: 'Male', color: 'Copper', hatchDate: '2025-04-02', weight: 2.3, status: 'Active', penId: 'P-3', sireId: 'GF-001', damId: 'GF-002', breedingId: 'BR-001', breeder: 'San Isidro Farm', pedigreeNotes: 'First offspring of Atlas and Sable.' },
    { id: 'GF-004', name: 'Ember', breed: 'Unknown', bloodline: '', flockId: 'F-2', sex: 'Male', color: 'Red', hatchDate: '2025-01-23', weight: 2.4, status: 'Active', penId: 'P-4', sireId: '', damId: '', breeder: 'S. Villanueva', pedigreeNotes: 'Previous breed records unavailable.' },
    { id: 'GF-005', name: 'Luna', breed: 'Sussex', bloodline: '', flockId: 'F-2', sex: 'Female', color: 'Grey', hatchDate: '2025-06-11', weight: 1.9, status: 'Brood', penId: 'P-5', sireId: '', damId: '', breeder: 'San Isidro Farm', pedigreeNotes: 'Calm temperament.' },
    { id: 'GF-006', name: 'Blaze', breed: 'Mixed / Crossbreed', bloodline: '', flockId: '', sex: 'Male', color: 'Red and white', hatchDate: '2026-02-14', weight: 1.7, status: 'Active', penId: 'P-6', sireId: 'GF-004', damId: 'GF-005', breedingId: 'BR-002', breeder: 'San Isidro Farm', pedigreeNotes: 'Young bird. Monitor growth monthly.' },
  ])
  pens = $state<Pen[]>([
    { id: 'P-1', name: 'Pen 1' }, { id: 'P-2', name: 'Pen 2' }, { id: 'P-3', name: 'Pen 3' },
    { id: 'P-4', name: 'Pen 4' }, { id: 'P-5', name: 'Pen 5' }, { id: 'P-6', name: 'Pen 6' },
  ])
  breeding = $state<BreedingRecord[]>([
    { id: 'BR-001', sireId: 'GF-001', damId: 'GF-002', matingDate: '2024-12-14', eggsCount: 8, hatchedCount: 6, notes: 'Copper is linked to this pairing.' },
    { id: 'BR-002', sireId: 'GF-004', damId: 'GF-005', matingDate: '2025-09-12', eggsCount: 7, hatchedCount: 5, notes: 'Blaze is linked to this pairing.' },
  ])
  health = $state<HealthLog[]>([
    { id: 'HL-001', targetType: 'bird', targetId: 'GF-003', category: 'Vaccination', date: offsetDate(-3), notes: 'Newcastle booster administered.' },
    { id: 'HL-002', targetType: 'pen', targetId: 'P-1', category: 'Routine care', date: offsetDate(-7), notes: 'Pen cleaned and disinfected.' },
    { id: 'HL-003', targetType: 'bird', targetId: 'GF-006', category: 'Vitamin', date: offsetDate(-10), notes: 'Vitamin B complex.' },
  ])
  reminders = $state<Reminder[]>([
    { id: 'R-001', birdId: 'GF-006', description: 'Growth check and weight', dueDate: offsetDate(1), done: false },
    { id: 'R-002', birdId: 'GF-003', description: 'Newcastle booster follow-up', dueDate: offsetDate(3), done: false },
    { id: 'R-003', birdId: 'GF-001', description: 'Deworming', dueDate: offsetDate(6), done: false },
  ])
  supplies = $state<Supply[]>([
    { id: 'SI-001', name: 'Premium grower feed', category: 'Feed', quantity: 18, unit: 'kg', reorderLevel: 10 },
    { id: 'SI-002', name: 'Vitamin B complex', category: 'Vitamin', quantity: 4, unit: 'bottles', reorderLevel: 5 },
    { id: 'SI-003', name: 'Newcastle vaccine', category: 'Medicine', quantity: 2, unit: 'vials', reorderLevel: 4 },
    { id: 'SI-004', name: 'Disinfectant', category: 'Equipment', quantity: 9, unit: 'L', reorderLevel: 3 },
  ])
  flocks = $state<Flock[]>([
    { id: 'F-1', name: 'Heritage flock' },
    { id: 'F-2', name: 'Backyard flock' },
  ])
}
export const demoStore = new DemoStore()
