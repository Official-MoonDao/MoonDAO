import { toast } from 'react-hot-toast'

export const errorToast = (msg: string) =>
  toast.error(msg, {
    position: 'top-right',
    duration: 5000,
  })

/* 

Notification that displays every time there is a connection error.

For documentation on how to customize and style this notification, check https://fkhadra.github.io/react-toastify/introduction/


*/
