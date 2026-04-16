import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Count templates + tickets as a sign the DB is reachable
  const { count: templateCount } = await supabase
    .from('workflow_templates')
    .select('*', { count: 'exact', head: true })

  const { count: ticketCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Yarro v2</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Signed in as {user?.email}
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-4 h-10 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              Sign out
            </button>
          </form>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="text-3xl font-bold text-neutral-900">{templateCount ?? 0}</div>
            <div className="text-sm text-neutral-600 mt-1">Workflow templates</div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="text-3xl font-bold text-neutral-900">{ticketCount ?? 0}</div>
            <div className="text-sm text-neutral-600 mt-1">Tickets</div>
          </div>
        </div>

        <div className="mt-8 p-6 bg-white rounded-xl border border-neutral-200">
          <h2 className="font-semibold text-neutral-900 mb-2">Foundation ready</h2>
          <p className="text-sm text-neutral-600">
            Auth, database, and deployment are live. Dashboard, ticket UI, and workflow
            templates come in Days 2–5.
          </p>
        </div>
      </div>
    </div>
  )
}
