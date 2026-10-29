import { Shell } from '@/components/Shell'
import { NewCallForm } from './NewCallForm'

export default function NewCall() {
  return (
    <Shell>
      <h1 className="mb-6 text-2xl font-semibold">New call</h1>
      <NewCallForm />
    </Shell>
  )
}
