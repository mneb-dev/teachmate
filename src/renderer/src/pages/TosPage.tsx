import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  CircleCheck,
  ClipboardList,
  FilePlus2,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { calculationErrors, validateTosInputs } from '@shared/calculation-rules'
import type { TeachingDocument } from '@shared/documents'
import {
  checkTosTable,
  computeTosTable,
  renderTosMarkdown,
  tableMatchesShape,
  type TosInputs,
  type TosTable,
} from '@shared/tos'
import { getNavItem } from '@renderer/app/navigation'
import { Badge } from '@renderer/components/ui/Badge'
import { Button } from '@renderer/components/ui/Button'
import { Card } from '@renderer/components/ui/Card'
import { CopyButton } from '@renderer/components/ui/CopyButton'
import { Dialog } from '@renderer/components/ui/Dialog'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { ExportDocxButton } from '@renderer/features/documents/ExportDocxButton'
import { OpenSavedDialog } from '@renderer/features/documents/OpenSavedDialog'
import { useDocumentEditor } from '@renderer/features/documents/useDocumentEditor'
import { TosForm } from '@renderer/features/tos/TosForm'
import { TosTableEditor } from '@renderer/features/tos/TosTableEditor'

type TosDoc = Extract<TeachingDocument, { kind: 'tos' }>

/** Recalculate unless the teacher edited cells and the table still fits the inputs. */
function syncTable(inputs: TosInputs, table: TosTable | null): TosTable {
  return table?.edited && tableMatchesShape(inputs, table) ? table : computeTosTable(inputs)
}

export function TosPage() {
  const nav = getNavItem('table-of-specifications')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const documentId = params.get('d')
  const onIdChange = useCallback(
    (id: string | null) => setParams(id ? { d: id } : {}, { replace: true }),
    [setParams],
  )
  const editor = useDocumentEditor({ kind: 'tos', documentId, onIdChange })
  const [openSaved, setOpenSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const doc = editor.doc?.kind === 'tos' ? (editor.doc as TosDoc) : null
  const check = doc ? checkTosTable(doc.inputs, doc.table) : null
  const calcProblems = doc ? calculationErrors(doc) : []
  const busy = editor.busy !== null
  const markdown =
    doc?.table && calcProblems.length === 0
      ? renderTosMarkdown(doc.title, doc.inputs, doc.table)
      : ''

  const setInputs = (fn: (i: TosInputs) => TosInputs) =>
    editor.update((d) => {
      if (d.kind !== 'tos') return d
      const inputs = fn(d.inputs)
      return { ...d, inputs, table: syncTable(inputs, d.table) }
    })

  const setCell = (row: number, column: number, value: number) =>
    editor.update((d) => {
      if (d.kind !== 'tos' || !d.table) return d
      const rows = d.table.rows.map((r, i) =>
        i === row ? { ...r, cells: r.cells.map((v, j) => (j === column ? value : v)) } : r,
      )
      return { ...d, table: { ...d.table, rows, edited: true } }
    })

  const recalculate = () =>
    editor.update((d) => (d.kind === 'tos' ? { ...d, table: computeTosTable(d.inputs) } : d))

  const confirmDiscard = () =>
    !editor.dirty || !editor.persisted || window.confirm('You have unsaved changes. Discard them?')

  const buildAssessment = async () => {
    const missing = doc ? Object.values(validateTosInputs(doc.inputs)).filter(Boolean) : []
    if (missing.length > 0) {
      editor.setError(`Complete the TOS first: ${missing.join(' ')}`)
      return
    }
    const saved = await editor.save()
    if (saved) navigate(`/assessments?fromTos=${encodeURIComponent(saved.id)}`)
  }

  return (
    <>
      <PageHeader
        title={nav.label}
        description="Allocate test items by teaching hours and Bloom’s taxonomy — totals are checked automatically."
        icon={nav.icon}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => confirmDiscard() && setOpenSaved(true)}
            >
              <FolderOpen className="size-4" aria-hidden />
              Open saved
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => confirmDiscard() && editor.startNew()}
            >
              <FilePlus2 className="size-4" aria-hidden />
              New TOS
            </Button>
          </>
        }
      />

      {editor.load.status === 'loading' && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Loading…
        </div>
      )}
      {editor.load.status === 'error' && (
        <Card className="mx-auto max-w-md p-8 text-center">
          <TriangleAlert className="mx-auto size-6 text-primary" aria-hidden />
          <p className="mt-2 text-sm font-medium">Couldn’t open this TOS</p>
          <p className="mt-1 text-sm text-muted-foreground">{editor.load.error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={editor.startNew}>
            Start a new TOS
          </Button>
        </Card>
      )}

      {editor.load.status === 'ready' && doc && check && (
        <div className="grid grid-cols-1 items-start gap-6 2xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <Card className="p-5">
            <TosForm
              inputs={doc.inputs}
              errors={editor.errors as Partial<Record<keyof TosInputs, string>>}
              showErrors={Object.keys(editor.errors).length > 0}
              onChange={setInputs}
            />
          </Card>

          <div className="min-w-0 space-y-4">
            {/* Toolbar */}
            <Card className="p-4">
              <label htmlFor="doc-title" className="sr-only">
                Document title
              </label>
              <input
                id="doc-title"
                value={doc.title}
                maxLength={160}
                onChange={(ev) => editor.setTitle(ev.target.value)}
                className="-mx-2 block h-9 w-[calc(100%+1rem)] rounded-lg border border-transparent bg-transparent px-2 text-base font-semibold hover:border-border focus:border-primary/60 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {calcProblems.length > 0 ? (
                  <Badge tone="primary">Totals don’t match</Badge>
                ) : !editor.persisted ? (
                  <Badge>Not saved yet</Badge>
                ) : editor.dirty ? (
                  <Badge tone="primary">Unsaved changes</Badge>
                ) : (
                  <Badge tone="success">
                    <CircleCheck className="size-3" aria-hidden />
                    Saved
                  </Badge>
                )}
                <span className="flex-1" />
                <Button
                  size="sm"
                  variant={editor.dirty ? 'primary' : 'secondary'}
                  disabled={busy || calcProblems.length > 0}
                  title={calcProblems.length > 0 ? 'Fix the totals before saving' : undefined}
                  onClick={() => void editor.save()}
                >
                  <Save className="size-4" aria-hidden />
                  Save
                </Button>
                {markdown && <CopyButton text={markdown} label="Copy as Markdown" />}
                <ExportDocxButton editor={editor} disabled={calcProblems.length > 0} />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || calcProblems.length > 0}
                  onClick={() => void buildAssessment()}
                >
                  <ClipboardList className="size-4" aria-hidden />
                  Build assessment
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Delete TOS"
                  title="Delete TOS"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </Card>

            {editor.error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex-1">{editor.error}</span>
                <button
                  type="button"
                  className="cursor-pointer text-xs font-medium hover:underline"
                  onClick={() => editor.setError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Item allocation</h2>
                  <p className="text-xs text-muted-foreground">
                    {doc.table?.edited
                      ? 'Edited by hand. Recalculate to redistribute from hours and percentages.'
                      : 'Calculated from teaching hours and the Bloom’s distribution.'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={recalculate}
                  disabled={!doc.table?.edited}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Recalculate
                </Button>
              </div>
              {doc.table && (
                <TosTableEditor inputs={doc.inputs} table={doc.table} onCellChange={setCell} />
              )}
            </Card>

            <Card className="p-4" aria-label="Calculation check" role="status">
              {calcProblems.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CircleCheck className="size-4" aria-hidden />
                  All row totals, column totals and the grand total ({check.grandTotal} items) are
                  correct.
                </p>
              ) : (
                <div className="text-sm">
                  <p className="flex items-center gap-2 font-medium text-primary">
                    <ShieldAlert className="size-4" aria-hidden />
                    Fix {calcProblems.length} problem{calcProblems.length === 1 ? '' : 's'} before
                    saving
                  </p>
                  <ul className="mt-2 space-y-1 text-xs leading-5">
                    {calcProblems.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {check.warnings.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {check.warnings.map((w, i) => (
                    <li key={i}>Note: {w}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      <OpenSavedDialog
        open={openSaved}
        kind="tos"
        noun="TOS"
        onClose={() => setOpenSaved(false)}
        onOpen={(id) => {
          setOpenSaved(false)
          onIdChange(id)
        }}
      />
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this TOS?"
        description={`“${doc?.title ?? ''}” will be permanently removed from this device.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setConfirmDelete(false)
                void editor.remove()
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          </>
        }
      />
    </>
  )
}
