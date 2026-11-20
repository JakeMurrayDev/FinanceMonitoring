import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useLocation, useNavigate } from '@tanstack/react-router'

import { isApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { categoriesQueryOptions } from '@/features/categories/queries'

import { toFormInput } from '../form-schema'
import { useCreateTransaction, useUpdateTransaction } from '../mutations'
import { transactionQueryOptions } from '../queries'
import { TransactionForm } from './TransactionForm'

const editRoute = getRouteApi('/transactions/$transactionId/edit')

/** Close a dialog route by returning to the list, keeping its filters. */
function useCloseDialog() {
  const navigate = useNavigate()
  return () => void navigate({ to: '/transactions', search: true })
}

/** A draft and server errors, present when a failed save reopened this dialog. */
function useDraft() {
  return useLocation({ select: (location) => location.state })
}

function TransactionDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    // A route-driven dialog: always open while its route matches; closing navigates away.
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function NewTransactionDialog() {
  const close = useCloseDialog()
  const { transactionDraft, serverErrors } = useDraft()
  const categories = useQuery(categoriesQueryOptions())
  const create = useCreateTransaction()

  return (
    <TransactionDialog
      title="Add transaction"
      description="Record income or an expense."
      onClose={close}
    >
      <TransactionForm
        categories={categories.data}
        defaultValues={transactionDraft}
        serverErrors={serverErrors}
        submitLabel="Add transaction"
        onCancel={close}
        onSubmit={(values) => {
          // Optimistic: close straight away; the table shows the row as "Saving…".
          create.mutate(values)
          close()
        }}
      />
    </TransactionDialog>
  )
}

export function EditTransactionDialog() {
  const close = useCloseDialog()
  const { transactionId } = editRoute.useParams()
  const { transactionDraft, serverErrors } = useDraft()
  const categories = useQuery(categoriesQueryOptions())
  const transaction = useQuery(transactionQueryOptions(transactionId))
  const update = useUpdateTransaction()

  return (
    <TransactionDialog
      title="Edit transaction"
      description="Changes are saved to your history."
      onClose={close}
    >
      {transaction.isPending ? (
        <div role="status" aria-label="Loading transaction" className="grid gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : transaction.isError ? (
        <div role="alert" className="grid gap-4">
          <p>
            {isApiError(transaction.error, 404)
              ? 'This transaction doesn’t exist. It may have been deleted.'
              : `Couldn’t load this transaction: ${transaction.error.message}`}
          </p>
          <Button variant="outline" onClick={close} className="justify-self-end">
            Close
          </Button>
        </div>
      ) : (
        <TransactionForm
          categories={categories.data}
          defaultValues={transactionDraft ?? toFormInput(transaction.data)}
          serverErrors={serverErrors}
          submitLabel="Save changes"
          onCancel={close}
          onSubmit={(values) => {
            update.mutate({ ...values, id: transaction.data.id, version: transaction.data.version })
            close()
          }}
        />
      )}
    </TransactionDialog>
  )
}
