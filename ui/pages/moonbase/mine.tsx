import Head from '@/components/layout/Head'
import MyMoonbase from '@/components/my-moonbase/MyMoonbase'

export default function MyMoonbasePage() {
  return (
    <>
      <Head
        title="My Moonbase"
        description="Build your own moonbase from the hardware you predict will win each race to the Moon."
      />
      <MyMoonbase />
    </>
  )
}
