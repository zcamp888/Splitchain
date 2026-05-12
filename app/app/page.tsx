import { PersonalDashboard } from '@/components/app/PersonalDashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function AppHomePage() {
  return <PersonalDashboard />
}