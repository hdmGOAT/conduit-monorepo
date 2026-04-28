import GroupForm from '../../../components/GroupForm'

export const metadata = {
  title: 'Create Group',
}

export default function Page() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Create a new group</h1>
      <GroupForm />
    </main>
  )
}
