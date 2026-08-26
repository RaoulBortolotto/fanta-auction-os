import { useRef } from 'react'
import { defaultSettings, TEMPLATES } from '../defaults'
import { useAuctionStore } from '../store/useAuctionStore'
import type { BudgetByRole, ModelWeights, Role } from '../types'

function download(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage() {
  const {
    state,
    meta,
    updateSettings,
    applyTemplate,
    exportJson,
    importJson,
    exportCsv,
    exportRoster,
    resetAll,
    dataAsOf,
  } = useAuctionStore()

  const s = state.settings
  const fileRef = useRef<HTMLInputElement>(null)

  const setBudgetPlan = (role: Role, v: number) => {
    updateSettings({
      budgetPlan: { ...s.budgetPlan, [role]: v },
      budgetTemplate: 'custom',
    })
  }

  const setSlots = (role: Role, v: number) => {
    updateSettings({ slots: { ...s.slots, [role]: v } })
  }

  const setWeight = (
    group: keyof ModelWeights,
    key: string,
    v: number,
  ) => {
    updateSettings({
      weights: {
        ...s.weights,
        [group]: { ...s.weights[group], [key]: v },
      },
    })
  }

  const restoreModel = () => {
    const d = defaultSettings()
    updateSettings({
      alpha: d.alpha,
      inflationAbsorption: d.inflationAbsorption,
      inflationClamp: d.inflationClamp,
      penaltyConversion: d.penaltyConversion,
      weights: structuredClone(d.weights),
      replacementPurchased: { ...d.replacementPurchased },
      replacementStarters: { ...d.replacementStarters },
      modThresholds: structuredClone(d.modThresholds),
    })
  }

  const listone = (meta as { listoneMeta?: { counts?: Record<string, number>; total?: number } })
    .listoneMeta
  const audit = (meta as { audit?: Record<string, unknown> }).audit
  const policy = (meta as { dataPolicy?: { note?: string; unavailable?: string } }).dataPolicy

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">
        Persistenza solo locale (localStorage) · data as of {dataAsOf} · policy:{' '}
        {policy?.unavailable ?? 'N/D'}
      </p>

      <div className="panel">
        <div className="panel-title">Aspetto & modalità</div>
        <div className="form-grid">
          <label>
            Tema
            <select
              value={s.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'light' })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <label>
            Switch
            <select
              value={s.switchMode}
              onChange={(e) =>
                updateSettings({ switchMode: e.target.value as 'basic' | 'plus' })
              }
            >
              <option value="basic">Basic</option>
              <option value="plus">Plus</option>
            </select>
          </label>
          <label>
            Fonte voto
            <input
              value={s.voteSource}
              onChange={(e) => updateSettings({ voteSource: e.target.value })}
            />
          </label>
          <label className="row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={s.officeReserveGk}
              onChange={(e) => updateSettings({ officeReserveGk: e.target.checked })}
              style={{ width: 'auto' }}
            />
            Riserva d&apos;ufficio portiere
          </label>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '0.85rem' }}>
        <div className="panel-title">Lega</div>
        <div className="form-grid">
          <label>
            Squadre
            <input
              type="number"
              value={s.teams}
              onChange={(e) => updateSettings({ teams: Number(e.target.value) || 10 })}
            />
          </label>
          <label>
            Budget
            <input
              type="number"
              value={s.budget}
              onChange={(e) => updateSettings({ budget: Number(e.target.value) || 500 })}
            />
          </label>
          <label>
            Clean sheet bonus
            <input
              type="number"
              value={s.cleanSheetBonus}
              onChange={(e) => updateSettings({ cleanSheetBonus: Number(e.target.value) || 0 })}
            />
          </label>
          <label>
            Fascia gol
            <input
              type="number"
              value={s.goalBand}
              onChange={(e) => updateSettings({ goalBand: Number(e.target.value) || 6 })}
            />
          </label>
          <label>
            Max sub
            <input
              type="number"
              value={s.maxSubs}
              onChange={(e) => updateSettings({ maxSubs: Number(e.target.value) || 5 })}
            />
          </label>
        </div>
        <div className="panel-title" style={{ marginTop: 12 }}>
          Slot rosa
        </div>
        <div className="form-grid">
          {(['P', 'D', 'C', 'A'] as Role[]).map((r) => (
            <label key={r}>
              Slot {r}
              <input
                type="number"
                value={s.slots[r]}
                onChange={(e) => setSlots(r, Number(e.target.value) || 0)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: '0.85rem' }}>
        <div className="panel-title">Template budget piano</div>
        <div className="row" style={{ marginBottom: 10 }}>
          {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((id) => (
            <button
              key={id}
              type="button"
              className={s.budgetTemplate === id ? 'primary' : ''}
              onClick={() => applyTemplate(id)}
            >
              {id}
            </button>
          ))}
          <button type="button" onClick={() => applyTemplate('custom')}>
            custom
          </button>
        </div>
        <div className="form-grid">
          {(['P', 'D', 'C', 'A'] as Role[]).map((r) => (
            <label key={r}>
              Piano {r}
              <input
                type="number"
                value={s.budgetPlan[r]}
                onChange={(e) => setBudgetPlan(r, Number(e.target.value) || 0)}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: '0.85rem' }}>
        <div className="panel-title">Modello economico</div>
        <div className="form-grid">
          <label>
            Alpha
            <input
              type="number"
              step={0.01}
              value={s.alpha}
              onChange={(e) => updateSettings({ alpha: Number(e.target.value) || 1 })}
            />
          </label>
          <label>
            Inflation absorption
            <input
              type="number"
              step={0.01}
              value={s.inflationAbsorption}
              onChange={(e) =>
                updateSettings({ inflationAbsorption: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label>
            Inflation clamp min
            <input
              type="number"
              step={0.01}
              value={s.inflationClamp[0]}
              onChange={(e) =>
                updateSettings({
                  inflationClamp: [Number(e.target.value) || 0.75, s.inflationClamp[1]],
                })
              }
            />
          </label>
          <label>
            Inflation clamp max
            <input
              type="number"
              step={0.01}
              value={s.inflationClamp[1]}
              onChange={(e) =>
                updateSettings({
                  inflationClamp: [s.inflationClamp[0], Number(e.target.value) || 1.35],
                })
              }
            />
          </label>
          <label>
            Penalty conversion
            <input
              type="number"
              step={0.001}
              value={s.penaltyConversion}
              onChange={(e) =>
                updateSettings({ penaltyConversion: Number(e.target.value) || 0 })
              }
            />
          </label>
        </div>
        <div className="panel-title" style={{ marginTop: 12 }}>
          Soglie MOD
        </div>
        <div className="form-grid">
          <label>
            +1 da
            <input
              type="number"
              step={0.01}
              value={s.modThresholds.plus1[0]}
              onChange={(e) =>
                updateSettings({
                  modThresholds: {
                    ...s.modThresholds,
                    plus1: [Number(e.target.value), s.modThresholds.plus1[1]],
                  },
                })
              }
            />
          </label>
          <label>
            +1 a
            <input
              type="number"
              step={0.01}
              value={s.modThresholds.plus1[1]}
              onChange={(e) =>
                updateSettings({
                  modThresholds: {
                    ...s.modThresholds,
                    plus1: [s.modThresholds.plus1[0], Number(e.target.value)],
                  },
                })
              }
            />
          </label>
          <label>
            +3 da
            <input
              type="number"
              step={0.01}
              value={s.modThresholds.plus3[0]}
              onChange={(e) =>
                updateSettings({
                  modThresholds: {
                    ...s.modThresholds,
                    plus3: [Number(e.target.value), s.modThresholds.plus3[1]],
                  },
                })
              }
            />
          </label>
          <label>
            +3 a
            <input
              type="number"
              step={0.01}
              value={s.modThresholds.plus3[1]}
              onChange={(e) =>
                updateSettings({
                  modThresholds: {
                    ...s.modThresholds,
                    plus3: [s.modThresholds.plus3[0], Number(e.target.value)],
                  },
                })
              }
            />
          </label>
          <label>
            +5 da
            <input
              type="number"
              step={0.01}
              value={s.modThresholds.plus5}
              onChange={(e) =>
                updateSettings({
                  modThresholds: { ...s.modThresholds, plus5: Number(e.target.value) },
                })
              }
            />
          </label>
        </div>
        <button type="button" className="primary" style={{ marginTop: 12 }} onClick={restoreModel}>
          Ripristina modello consigliato
        </button>
      </div>

      <div className="panel" style={{ marginTop: '0.85rem' }}>
        <div className="panel-title">Pesi modello</div>
        {(Object.keys(s.weights) as (keyof ModelWeights)[]).map((group) => (
          <div key={group} style={{ marginBottom: 12 }}>
            <div className="metric-label">{group}</div>
            <div className="form-grid">
              {Object.entries(s.weights[group]).map(([k, v]) => (
                <label key={k}>
                  {k}
                  <input
                    type="number"
                    step={0.01}
                    value={v}
                    onChange={(e) => setWeight(group, k, Number(e.target.value) || 0)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: '0.85rem' }}>
        <div className="panel-title">Replacement levels</div>
        <div className="form-grid">
          {(['P', 'D', 'C', 'A'] as Role[]).map((r) => (
            <label key={`rp-${r}`}>
              Purchased {r}
              <input
                type="number"
                value={s.replacementPurchased[r]}
                onChange={(e) =>
                  updateSettings({
                    replacementPurchased: {
                      ...s.replacementPurchased,
                      [r]: Number(e.target.value) || 0,
                    } as BudgetByRole,
                  })
                }
              />
            </label>
          ))}
          {(['P', 'D', 'C', 'A'] as Role[]).map((r) => (
            <label key={`rs-${r}`}>
              Starters {r}
              <input
                type="number"
                value={s.replacementStarters[r]}
                onChange={(e) =>
                  updateSettings({
                    replacementStarters: {
                      ...s.replacementStarters,
                      [r]: Number(e.target.value) || 0,
                    } as BudgetByRole,
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: '0.85rem' }}>
        <div className="panel-title">Import / Export</div>
        <div className="row">
          <button type="button" onClick={() => download('fanta-auction-os.json', exportJson())}>
            Esporta JSON
          </button>
          <button
            type="button"
            onClick={() => download('aste.csv', exportCsv(), 'text/csv')}
          >
            Esporta CSV aste
          </button>
          <button
            type="button"
            onClick={() => download('rosa.csv', exportRoster(), 'text/csv')}
          >
            Esporta rosa CSV
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            Importa JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const text = await file.text()
              try {
                importJson(text)
              } catch {
                alert('JSON non valido')
              }
              e.target.value = ''
            }}
          />
          <button type="button" className="danger" onClick={() => resetAll()}>
            Reset completo
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '0.85rem' }}>
        <div className="panel-title">Info dataset / audit</div>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
          {policy?.note ?? 'Data policy N/D. Nessuna inventata di stats numeriche fantasy.'}
        </p>
        <div className="chip-row">
          <span className="tag">
            Listone total {listone?.total ?? (meta as { total?: number }).total ?? 'N/D'}
          </span>
          {listone?.counts &&
            Object.entries(listone.counts).map(([k, v]) => (
              <span key={k} className="tag">
                {k}:{v}
              </span>
            ))}
          {audit && (
            <>
              <span className="tag rig">
                penaltyAssigned {String((audit as { penaltyAssigned?: number }).penaltyAssigned ?? 'N/D')}
              </span>
              <span className="tag">
                setPieces {(audit as { setPiecesAssigned?: number }).setPiecesAssigned ?? 'N/D'}
              </span>
              <span className="tag g1">
                g1 {(audit as { g1Assigned?: number }).g1Assigned ?? 'N/D'}
              </span>
            </>
          )}
        </div>
        <p className="dim mono" style={{ fontSize: '0.75rem', marginTop: 8 }}>
          STORAGE local-only · chiave fanta-auction-os-v1 · nessuna sync cloud
        </p>
      </div>
    </div>
  )
}
