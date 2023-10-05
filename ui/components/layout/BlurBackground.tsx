interface BlurBackground {
  styles?: string
}

const BlurBackground = ({ styles }: BlurBackground) => {
  return (
    <div
      className={`${
        !styles ? 'rounded-2xl' : styles
      } absolute inset-0 bg-gradient-to-br from-moon-blue to-detail-light blur dark:from-detail-dark dark:to-moon-gold`}
    ></div>
  )
}

export default BlurBackground

/*

* Parent must have the 'relative' class for this to work, this component must be placed right below the parent div of the whole component.

* The 'component-background' class has 'relative' inside, so there's no need to add the relative class to the component unless you aren't using 'component-background'.

* Depending how the HTML is structured for certain components, this might not work.

* In case you can't use this component, consider simply adding a small (0.5px - 1px) border to the element with a subtle shadow using the classes "detail-light" and "detail-dark" (these classes are in the Tailwind Config file so you will find border and shadow utilities for them while developing).

* Components generally are rounded-2xl, this component defaults to that but can accept other properties to make it fit other shapes.

*/
