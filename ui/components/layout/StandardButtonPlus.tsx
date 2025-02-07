import { PlusCircleIcon } from '@heroicons/react/20/solid'
import StandardButton from './StandardButton'

export default function StandardButtonPlus(props: any) {
  return (
    <StandardButton {...props}>
      <div className="flex items-center gap-2">
        <PlusCircleIcon className="w-6 h-6" />
        {props.children}
      </div>
    </StandardButton>
  )
}
