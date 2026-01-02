// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA6XTrXrZz1axWm35sYYQL39GxU7Im1eZ0",
  authDomain: "expo2-3100a.firebaseapp.com",
  projectId: "expo2-3100a",
  storageBucket: "expo2-3100a.firebasestorage.app",
  messagingSenderId: "529345093106",
  appId: "1:529345093106:web:980792d073f0c7e7a65f6b",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Initialize Storage
export const storage = getStorage(app);
export const auth = getAuth(app);
