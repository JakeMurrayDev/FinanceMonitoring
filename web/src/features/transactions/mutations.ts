import { useMutation, useMutationState, type QueryClient } from '@tanstack/react-query'
import { useRouter, type AnyRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { api, ensureOk, isApiError, unwrap } from '@/api/client'
import type { TransactionItem, TransactionPage } from '@/api/types'
import { categoriesQueryOptions } from '@/features/categories/queries'

import {
  ACCOUNT_CURRENCY,
  toFormInput,
  type TransactionFormInput,
  type TransactionFormValues,
} from './form-schema'
import { transactionKeys } from './queries'

export type UpdateVariables = TransactionFormValues & Pick<TransactionItem, 'id' | 'version'>

// History state lets a failed save reopen its dialog with what the user typed,
// without putting form data in the URL.
declare module '@tanstack/react-router' {
  interface HistoryState {
    transactionDraft?: TransactionFormInput
    serverErrors?: Record<string, string[] | undefined>
  }
}

// ── Cache helpers ───────────────────────────────────────────────────────────
// The list cache holds one entry per filter/sort/page combination, so
// optimistic changes are applied to every cached list, then rolled back from a
// snapshot if the server says no.

type ListSnapshot = [readonly unknown[], TransactionPage | undefined][]

async function snapshotLists(client: QueryClient): Promise<ListSnapshot> {
  // Stop in-flight refetches from overwriting the optimistic change.
  await client.cancelQueries({ queryKey: transactionKeys.lists() })
  return client.getQueriesData<TransactionPage>({ queryKey: transactionKeys.lists() })
}

function restoreLists(client: QueryClient, snapshot: ListSnapshot | undefined) {
  for (const [key, data] of snapshot ?? []) client.setQueryData(key, data)
}

function updateLists(client: QueryClient, update: (page: TransactionPage) => TransactionPage) {
  client.setQueriesData<TransactionPage>({ queryKey: transactionKeys.lists() }, (page) =>
    page ? update(page) : page,
  )
}

function categoryName(client: QueryClient, id: string) {
  return client.getQueryData(categoriesQueryOptions().queryKey)?.find((c) => c.id === id)?.name
}

/** Settle by refetching, so the cache ends up exactly as the server has it. */
function refetchAll(client: QueryClient) {
  return client.invalidateQueries({ queryKey: transactionKeys.all })
}

// ── Failure handling ────────────────────────────────────────────────────────

type DialogTarget =
  | { to: '/transactions/new' }
  | { to: '/transactions/$transactionId/edit'; params: { transactionId: string } }

/** Reopen the add/edit dialog with the user's input, optionally with server field errors. */
function reopen(
  router: AnyRouter,
  target: DialogTarget,
  draft?: TransactionFormInput,
  serverErrors?: Record<string, string[] | undefined>,
) {
  void router.navigate({
    ...target,
    search: true,
    state: (prev) => ({ ...prev, transactionDraft: draft, serverErrors }),
  })
}

function handleSaveError(
  router: AnyRouter,
  error: Error,
  target: DialogTarget,
  values: TransactionFormValues,
  verb: string,
) {
  const draft = toFormInput(values)
  if (isApiError(error, 400)) {
    toast.error(`Couldn’t ${verb} “${values.description}”. Check the highlighted fields.`)
    reopen(router, target, draft, error.problem?.errors)
    return
  }
  toast.error(`Couldn’t ${verb} “${values.description}”.`, {
    description: error.message,
    action: {
      label: 'Try again',
      onClick: () => {
        reopen(router, target, draft)
      },
    },
  })
}

// ── Mutations ───────────────────────────────────────────────────────────────

/**
 * Create. A new row's position in a sorted, filtered, paged list isn't known
 * until the server answers, so instead of guessing in the cache, the table
 * renders pending creates from the mutation's variables (usePendingCreates).
 */
export function useCreateTransaction() {
  const router = useRouter()
  return useMutation({
    mutationKey: transactionKeys.create(),
    mutationFn: async (values: TransactionFormValues) =>
      unwrap(
        await api.POST('/api/transactions', { body: { ...values, currency: ACCOUNT_CURRENCY } }),
      ),
    onSuccess: (created) => {
      toast.success(`Added “${created.description}”.`)
    },
    onError: (error, values) => {
      handleSaveError(router, error, { to: '/transactions/new' }, values, 'add')
    },
    // Returning the promise keeps the mutation pending until the lists have
    // refetched, so the pending row and the real row never both show.
    onSettled: (_data, _error, _variables, _result, { client }) => refetchAll(client),
  })
}

export function usePendingCreates(): TransactionFormValues[] {
  return useMutationState({
    filters: { mutationKey: transactionKeys.create(), status: 'pending' },
    select: (mutation) => mutation.state.variables as TransactionFormValues,
  })
}

/** Update. Patches the row in every cached list immediately; rolls back on failure. */
export function useUpdateTransaction() {
  const router = useRouter()
  return useMutation({
    mutationFn: async ({ id, version, ...values }: UpdateVariables) =>
      unwrap(
        await api.PUT('/api/transactions/{id}', {
          params: { path: { id } },
          body: { ...values, currency: ACCOUNT_CURRENCY, version },
        }),
      ),
    onMutate: async ({ id, version, ...values }, { client }) => {
      const snapshot = await snapshotLists(client)
      // Remember what it was called, so a failure message names the right transaction.
      const originalDescription =
        client.getQueryData<TransactionItem>(transactionKeys.detail(id))?.description ??
        snapshot.flatMap(([, page]) => page?.items ?? []).find((item) => item.id === id)
          ?.description
      const name = categoryName(client, values.categoryId)
      updateLists(client, (page) => ({
        ...page,
        items: page.items.map((item) =>
          item.id === id
            ? { ...item, ...values, categoryName: name ?? item.categoryName, version: version + 1 }
            : item,
        ),
      }))
      return { snapshot, originalDescription }
    },
    onSuccess: (updated, _variables, _result, { client }) => {
      client.setQueryData(transactionKeys.detail(updated.id), updated)
      toast.success(`Saved “${updated.description}”.`)
    },
    onError: (error, variables, result, { client }) => {
      restoreLists(client, result?.snapshot)
      const target = {
        to: '/transactions/$transactionId/edit',
        params: { transactionId: variables.id },
      } as const
      if (isApiError(error, 409)) {
        const name = result?.originalDescription ?? variables.description
        toast.error(`“${name}” was changed elsewhere, so your edit wasn’t saved.`, {
          action: {
            label: 'Review',
            onClick: () => {
              reopen(router, target)
            },
          },
        })
        return
      }
      handleSaveError(router, error, target, variables, 'save')
    },
    onSettled: (_data, _error, _variables, _result, { client }) => refetchAll(client),
  })
}

/** Delete. Removes the row from every cached list immediately; restores it on failure. */
export function useDeleteTransaction() {
  return useMutation({
    mutationFn: async ({ id, version }: TransactionItem) => {
      ensureOk(
        await api.DELETE('/api/transactions/{id}', {
          params: { path: { id }, query: { version } },
        }),
      )
    },
    onMutate: async ({ id }, { client }) => {
      const snapshot = await snapshotLists(client)
      updateLists(client, (page) => {
        if (!page.items.some((item) => item.id === id)) return page
        const totalCount = page.totalCount - 1
        return {
          ...page,
          items: page.items.filter((item) => item.id !== id),
          totalCount,
          totalPages: Math.ceil(totalCount / page.pageSize),
        }
      })
      return { snapshot }
    },
    onSuccess: (_data, item, _result, { client }) => {
      client.removeQueries({ queryKey: transactionKeys.detail(item.id) })
      toast.success(`Deleted “${item.description}”.`)
    },
    onError: (error, item, result, { client }) => {
      if (isApiError(error, 404)) {
        // Already gone (deleted elsewhere), which is what the user wanted.
        toast.info(`“${item.description}” had already been deleted.`)
        return
      }
      restoreLists(client, result?.snapshot)
      toast.error(
        isApiError(error, 409)
          ? `“${item.description}” was changed elsewhere, so it wasn’t deleted.`
          : `Couldn’t delete “${item.description}”.`,
        {
          description: isApiError(error, 409)
            ? 'It’s been restored with the latest details.'
            : error.message,
        },
      )
    },
    onSettled: (_data, _error, _variables, _result, { client }) => refetchAll(client),
  })
}
