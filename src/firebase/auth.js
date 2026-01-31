import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail 
} from "firebase/auth";
// [CẬP NHẬT] Import thêm functions
import { auth, db, functions } from "./config.js"; 
import { 
    doc, getDoc, updateDoc, increment, setDoc, 
    collection, query, where, getDocs, onSnapshot 
} from 'firebase/firestore'; 
// [CẬP NHẬT] Import httpsCallable để gọi Cloud Functions
import { httpsCallable } from "firebase/functions";

// --- HÀM MỚI: LẤY CẤU HÌNH HỆ THỐNG ---
export async function getSystemConfig() {
    try {
        const docRef = doc(db, "system_config", "general");
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Lỗi lấy config:", error);
        return null;
    }
}

/**
 * Đăng ký tài khoản mới
 */
export async function registerNewUser(email, password, phone) {
    try {
        const config = await getSystemConfig();
        const starterCoins = config?.economy?.starter_coins || 0;

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            email: email,
            phone: phone || "",
            role: "user",
            coins: starterCoins,
            inventory: [],
            createdAt: new Date()
        });
        return user;
    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        throw error;
    }
}

/**
 * Đăng nhập
 */
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        throw error;
    }
}

/**
 * Đăng xuất
 */
export async function logoutUser() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Lỗi đăng xuất:", error);
    }
}

/**
 * Lấy dữ liệu user (Dùng 1 lần)
 */
export async function getUserData(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Lỗi lấy data:", error);
        return null;
    }
}

// HÀM LẮNG NGHE DỮ LIỆU REALTIME
export function listenToUserData(uid, callback) {
    const docRef = doc(db, "users", uid);
    return onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            console.log("Không tìm thấy dữ liệu user!");
            callback(null);
        }
    }, (error) => {
        console.error("Lỗi lắng nghe realtime:", error);
    });
}

export function monitorAuthState(callback) {
    onAuthStateChanged(auth, callback);
}

// [CẬP NHẬT QUAN TRỌNG] Các hàm gọi Cloud Functions để chống Hack

// 1. Gọi Server để nhận thưởng cuối game (Thay thế addUserCoins ở Client)
export async function callEndGameReward(isVictory) {
    const claimReward = httpsCallable(functions, 'claimEndGameReward');
    try {
        const result = await claimReward({ isVictory: isVictory });
        return result.data; // Trả về { success, reward, message }
    } catch (error) {
        console.error("Lỗi gọi function nhận thưởng:", error);
        return null;
    }
}

// 2. Gọi Server để mua đồ (An toàn tuyệt đối)
export async function callBuyItem(itemId) {
    const buyItem = httpsCallable(functions, 'buyShopItem');
    try {
        const result = await buyItem({ itemId: itemId });
        return result.data; // Trả về { success, newBalance }
    } catch (error) {
        console.error("Lỗi gọi function mua đồ:", error);
        throw error; // Ném lỗi để main.js hiển thị alert
    }
}

// --- HÀM CŨ: addUserCoins ---
// Vẫn giữ lại để tránh lỗi code cũ, nhưng nên hạn chế dùng nếu đã bật Security Rules chặn ghi đè Coin
export async function addUserCoins(amount) {
    const user = auth.currentUser;
    if (!user) return null;
    try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { coins: increment(amount) });
        const newSnap = await getDoc(userRef);
        return newSnap.data().coins;
    } catch (error) {
        console.error("Lỗi cộng tiền (Client):", error);
        return null;
    }
}

// --- HÀM: QUÊN MẬT KHẨU ---
export async function verifyAndResetPassword(email, phone) {
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("Email này chưa từng đăng ký!");
        }

        let userData = null;
        querySnapshot.forEach((doc) => {
            userData = doc.data();
        });

        if (userData.phone !== phone) {
            throw new Error("Số điện thoại không khớp với tài khoản này!");
        }

        await sendPasswordResetEmail(auth, email);
        return true; 
    } catch (error) {
        console.error("Lỗi quên mật khẩu:", error);
        throw error;
    }
}