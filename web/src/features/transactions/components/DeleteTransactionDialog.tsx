import type { TransactionItem } from '@/api/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatIsoDate } from '@/lib/dates'

import { useFormatSignedAmount } from '../format'

interface DeleteTransactionDialogProps {
  transaction: TransactionItem | null
  onConfirm: (transaction: TransactionItem) => void
  onCancel: () => void
}

/** Confirmation before an irreversible delete. Focus starts on Cancel, the safe choice. */
export function DeleteTransactionDialog({
  transaction,
  onConfirm,
  onCancel,
}: DeleteTransactionDialogProps) {
  const formatSignedAmount = useFormatSignedAmount()
  return (
    <AlertDialog
      open={transaction !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        {transaction && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
              <AlertDialogDescription>
                “{transaction.description}”, {formatSignedAmount(transaction)} on{' '}
                {formatIsoDate(transaction.date)}. This can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  onConfirm(transaction)
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
