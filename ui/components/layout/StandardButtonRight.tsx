import Button from './Button'
import React from 'react'

type StandardButtonRightProps = {
  className?: string
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  borderRadius?: string
  link?: string
  textColor?: string
  styleOnly?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export default function StandardButtonRight(props: StandardButtonRightProps) {
  return <Button variant="right" {...props} />
}
