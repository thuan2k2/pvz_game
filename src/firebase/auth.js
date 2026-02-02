import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail,
    GoogleAuthProvider, 
    signInWithPopup 
} from "firebase/auth";
import { auth, db, functions } from "./config.js"; 
import { 
    doc, getDoc, updateDoc, increment, setDoc, 
    collection, query, where, getDocs, onSnapshot,
    runTransaction, addDoc, serverTimestamp, orderBy, limit, arrayUnion
} from 'firebase/firestore'; 
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
 * Đăng nhập bằng Google
 */
export async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Kiểm tra xem user đã tồn tại trong Firestore chưa
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            const config = await getSystemConfig();
            const starterCoins = config?.economy?.starter_coins || 0;

            // Nếu là người dùng mới, khởi tạo dữ liệu
            await setDoc(userRef, {
                email: user.email,
                phone: user.phoneNumber || "",
                role: "user",
                coins: starterCoins,
                vn_coin: 0, // [MỚI] Khởi tạo VNCoin
                item_plant_food_count: 0, // [MỚI] Khởi tạo số lượng item đặc biệt
                inventory: [],
                createdAt: new Date()
            });
        }
        return user;
    } catch (error) {
        console.error("Lỗi đăng nhập Google:", error);
        throw error;
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
            vn_coin: 0,
            item_plant_food_count: 0,
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

// --- 1. HÀM GHI LOG HỆ THỐNG ---
export async function saveLog(uid, actionType, assetType, amount, note, oldBalance = 0, newBalance = 0) {
    try {
        await addDoc(collection(db, "transactions_history"), {
            uid: uid,
            type: actionType, // DEPOSIT, BUY_SHOP, GAME_REWARD...
            assetType: assetType, // VNCoin, Coin, Item
            amount: amount,
            note: note,
            balanceBefore: oldBalance,
            balanceAfter: newBalance,
            timestamp: serverTimestamp()
        });
        console.log("Đã ghi log:", note);
    } catch (error) {
        console.error("Lỗi ghi log:", error);
    }
}

// --- 2. HÀM MUA ĐỒ SHOP (Xử lý thông minh cho VNCoin & Coin) ---
export async function buyShopItemWithLog(uid, itemData) {
    const userRef = doc(db, "users", uid);

    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw "User không tồn tại!";

            const userData = userSnap.data();
            
            // A. XÁC ĐỊNH LOẠI TIỀN CẦN TRỪ
            // Nếu currency là "Coin" thì trừ coins, mặc định còn lại là trừ vn_coin
            const currencyField = (itemData.currency === "Coin") ? "coins" : "vn_coin";
            const currentBalance = userData[currencyField] || 0;
            const price = parseInt(itemData.price);

            // Kiểm tra số dư
            if (currentBalance < price) {
                throw `Không đủ ${itemData.currency || 'VNCoin'}!`;
            }

            const newBalance = currentBalance - price;

            // B. CHUẨN BỊ DỮ LIỆU CẬP NHẬT
            let updates = {
                [currencyField]: newBalance // Trừ tiền
            };

            // C. XỬ LÝ "GIAO HÀNG" DỰA TRÊN TYPE
            if (itemData.type === 'coin') {
                // Nếu mua gói Coin -> Cộng Coin vào tài khoản game
                // itemData.value chứa số lượng coin nhận được
                updates.coins = increment(parseInt(itemData.value));
            } 
            else if (itemData.type === 'item') {
                // Nếu mua vật phẩm (ví dụ Plant Food)
                if (itemData.itemCode === 'plant_food') {
                    // Cộng dồn số lượng vào field riêng
                    updates.item_plant_food_count = increment(parseInt(itemData.amount || 1));
                } else {
                    // Vật phẩm khác (Skin, Cây) -> Thêm vào mảng inventory
                    updates.inventory = arrayUnion(itemData.itemCode);
                }
            }

            // D. THỰC HIỆN UPDATE DB
            transaction.update(userRef, updates);

            // E. GHI LOG GIAO DỊCH
            const logRef = doc(collection(db, "transactions_history"));
            transaction.set(logRef, {
                uid: uid,
                type: "BUY_SHOP",
                assetType: itemData.currency || "VNCoin",
                amount: -price,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                note: `Mua: ${itemData.name}`,
                timestamp: serverTimestamp()
            });
        });

        return { success: true };
    } catch (error) {
        console.error("Giao dịch lỗi:", error);
        return { success: false, message: error.toString() };
    }
}

// --- 3. HÀM ADMIN: LẤY CHI TIẾT USER & LOGS ---
export async function getAdminUserDetail(uid) {
    try {
        // Lấy Info
        const userSnap = await getDoc(doc(db, "users", uid));
        const userData = userSnap.exists() ? userSnap.data() : null;

        // Lấy Logs (50 giao dịch gần nhất)
        const q = query(
            collection(db, "transactions_history"), 
            where("uid", "==", uid),
            orderBy("timestamp", "desc"),
            limit(50)
        );
        const logsSnap = await getDocs(q);
        const logs = logsSnap.docs.map(d => ({id: d.id, ...d.data()}));

        return { userData, logs };
    } catch (error) {
        console.error("Lỗi lấy chi tiết Admin:", error);
        return null;
    }
}