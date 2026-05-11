import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcceptInvite } from '@/components/invites/AcceptInvite'

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: invite } = await supabase
    .from('group_invites')
    .select('id, group_id, expires_at, accepted_by, groups:group_id(name, cover_emoji, description)')
    .eq('token', params.token)
    .maybeSingle()

  if (!user) {
    redirect(`/auth?invite=${params.token}`)
  }

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
        <div className="glass-strong w-full rounded-3xl p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Invite not found</h1>
          <p className="mt-2 text-sm text-fg-muted">This invite link is invalid or has been removed.</p>
        </div>
      </main>
    )
  }

  const expired = new Date(invite.expires_at) < new Date()
  const used = !!invite.accepted_by
  const group = invite.groups as { name: string; cover_emoji: string; description: string | null } | null

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <AcceptInvite
        token={params.token}
        groupName={group?.name || 'a group'}
        groupEmoji={group?.cover_emoji || '💸'}
        groupDescription={group?.description || null}
        expired={expired}
        used={used}
      />
    </main>
  )
}