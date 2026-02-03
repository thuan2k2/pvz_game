// src/firebase/config.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBLL7VHNqlfMMddcguHoavzy_Cj6ReUhU4",
  authDomain: "plans-game.firebaseapp.com",
  // Đường dẫn kết nối Realtime Database (Bắt buộc để sửa lỗi Warning)
  databaseURL: "https://plans-game-default-rtdb.firebaseio.com",
  projectId: "plans-game",
  storageBucket: "plans-game.firebasestorage.app",
  messagingSenderId: "480122242241",
  appId: "1:480122242241:web:bc5c31438e5298a985c040"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Xuất các module để sử dụng trong game
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
export const database = getDatabase(app);

console.log("🔥 Firebase đã được kết nối!");