import { createFileRoute } from '@tanstack/react-router'

import { EditTransactionDialog } from '@/features/transactions/components/TransactionDialogs'
import { transactionQueryOptions } from '@/features/transactions/queries'

const ignore = () => undefined

export const Route = createFileRoute('/transactions/$transactionId/edit')({
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.query(transactionQueryOptions(params.transactionId)).catch(ignore)
  },
  head: () => ({ meta: [{ title: 'Edit transaction · Finance Monitor' }] }),
  component: EditTransactionDialog,
})
