import { GroupDetail } from '@/components/app/GroupDetail'

export default function GroupPage({ params }: { params: { id: string } }) {
  return <GroupDetail groupId={params.id} />
}