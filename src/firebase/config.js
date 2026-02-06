// src/firebase/config.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
// [ĐÃ XÓA] Không import Realtime Database nữa
// import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBLL7VHNqlfMMddcguHoavzy_Cj6ReUhU4",
  authDomain: "plans-game.firebaseapp.com",
  // [ĐÃ XÓA] databaseURL (Không cần thiết vì đã bỏ Realtime DB)
  projectId: "plans-game",
  storageBucket: "plans-game.firebasestorage.app",
  messagingSenderId: "480122242241",
  appId: "1:480122242241:web:bc5c31438e5298a985c040"
};

// Khởi tạo Firebase App
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// [QUAN TRỌNG] Gán bằng null để tắt cảnh báo lỗi Config
// Hệ thống bây giờ chỉ dùng 'db' (Firestore)
export const database = null;

console.log("🔥 Firebase đã được kết nối (Firestore Mode)!");