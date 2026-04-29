import { CollectionEditor } from '@/components/collections/collection-editor'

export const metadata = {
  title: 'Create Collection | Conduit',
}

export default async function Page({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await params as { id: string }

  return (
    <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <div className="mb-12 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest/60">New Activity</p>
        <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl">
          Launch a collection.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/60">
          Gather funds and info in one smooth flow. Members pay first, then unlock the form to provide their details.
        </p>
      </div>

      <div className="float-in delay-1">
        <CollectionEditor groupId={id} mode="create" />
      </div>
    </main>
  )
}