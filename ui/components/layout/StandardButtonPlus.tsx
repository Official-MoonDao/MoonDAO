import { PlusCircleIcon } from '@heroicons/react/20/solid'
import Button from './Button'

export default function StandardButtonPlus(props: any) {
  return (
    <Button {...props} icon={<PlusCircleIcon className="w-6 h-6" />} iconPosition="left">
      {props.children}
    </Button>
  )
}
