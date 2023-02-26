import { initializeApp } from 'firebase/app'
import { getStorage, listAll, ref, uploadBytes } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: 'moondao-x-lifeship.appspot.com',
  messagingSenderId: process.env.FIREBASE_MSG_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const storage = getStorage(app)

export async function uploadFile(imageFile: any, walletAddress: string) {
  const uploadRef = ref(storage, `${walletAddress}/nft`)
  return await uploadBytes(uploadRef, imageFile)
}

export async function hasUserSubmittedNFT(walletAddress: string) {
  const userRef = ref(storage, walletAddress)
  const data = (await listAll(userRef)).items
  return data.length > 0 ? true : false
}

/*
FIREBASE_API_KEY=AIzaSyBOxUCzDUi6pZH7vRQgPVs0YtMkQWuRy_0
FIREBASE_AUTH_DOMAIN=moondao-x-lifeship.firebaseapp.com
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=moondao-x-lifeship.appspot.com
FIREBASE_MSG_SENDER_ID=443395864085
FIREBASE_APP_ID=1:443395864085:web:7e69ddaf956c8fddf2001c*/
