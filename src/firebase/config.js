// src/firebase/config.js

// Import các hàm cần thiết từ thư viện Firebase
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// [MỚI] Import Functions để gọi hàm từ Server
import { getFunctions } from "firebase/functions"; 
// [MỚI - CẬP NHẬT] Import thêm Storage (Lưu ảnh) và Realtime Database (Lưu thông số game)
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

// Cấu hình Firebase (Lấy từ Firebase Console của bạn)
const firebaseConfig = {
  apiKey: "AIzaSyBLL7VHNqlfMMddcguHoavzy_Cj6ReUhU4",             // Ví dụ: AIzaSyD...
  authDomain: "plans-game.firebaseapp.com",
  projectId: "plans-game",
  storageBucket: "plans-game.firebasestorage.app",
  messagingSenderId: "480122242241",
  appId: "1:480122242241:web:bc5c31438e5298a985c040"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Xuất các công cụ để dùng ở file khác
export const auth = getAuth(app);       // Quản lý đăng nhập/đăng ký
export const db = getFirestore(app);    // Quản lý cơ sở dữ liệu người chơi (Firestore)
export const functions = getFunctions(app); // [MỚI] Quản lý Cloud Functions

// [MỚI - CẬP NHẬT] Xuất công cụ cho Admin Tool
export const storage = getStorage(app); // Quản lý kho ảnh (Storage)
export const database = getDatabase(app); // Quản lý thông số Game (Realtime Database)

console.log("🔥 Firebase đã được kết nối!");