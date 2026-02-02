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

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            const config = await getSystemConfig();
            const starterCoins = config?.economy?.starter_coins || 0;

            await setDoc(userRef, {
                email: user.email,
                phone: user.phoneNumber || "",
                role: "user",
                coins: starterCoins,
                vn_coin: 0, 
                item_plant_food_count: 0,
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

export async function callEndGameReward(isVictory) {
    const claimReward = httpsCallable(functions, 'claimEndGameReward');
    try {
        const result = await claimReward({ isVictory: isVictory });
        return result.data; 
    } catch (error) {
        console.error("Lỗi gọi function nhận thưởng:", error);
        return null;
    }
}

export async function callBuyItem(itemId) {
    const buyItem = httpsCallable(functions, 'buyShopItem');
    try {
        const result = await buyItem({ itemId: itemId });
        return result.data; 
    } catch (error) {
        console.error("Lỗi gọi function mua đồ:", error);
        throw error; 
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
            type: actionType, 
            assetType: assetType, 
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

// --- [MỚI] HÀM BẬT/TẮT TRẠNG THÁI ITEM ---
export async function toggleItemStatus(uid, itemCode, isActive) {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
            [`item_settings.${itemCode}`]: isActive 
        });
    } catch (error) {
        console.error("Lỗi toggle:", error);
    }
}

// --- 2. HÀM MUA ĐỒ SHOP (CẬP NHẬT LOGIC CỘNG DỒN NGÀY) ---
export async function buyShopItemWithLog(uid, itemData) {
    const userRef = doc(db, "users", uid);

    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw "User không tồn tại!";

            const userData = userSnap.data();
            
            // A. XÁC ĐỊNH LOẠI TIỀN CẦN TRỪ
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
                [currencyField]: newBalance 
            };

            // C. XỬ LÝ "GIAO HÀNG" 
            if (itemData.type === 'coin') {
                updates.coins = increment(parseInt(itemData.value));
            } 
            else if (itemData.type === 'item') {
                if (itemData.itemCode === 'plant_food') {
                    // Cộng dồn số lượng 
                    updates.item_plant_food_count = increment(parseInt(itemData.amount || 1));
                } else if (itemData.itemCode === 'sun_pack') {
                    // [MỚI] Xử lý Gói Mặt Trời: Cộng dồn ngày
                    if (itemData.duration && itemData.duration !== 99999) {
                        const now = new Date().getTime();
                        let currentExpire = now;

                        // Nếu đang có hạn thì cộng nối tiếp từ ngày hết hạn cũ
                        if (userData.temp_items && userData.temp_items.sun_pack) {
                            const oldDate = userData.temp_items.sun_pack.toMillis();
                            if (oldDate > now) currentExpire = oldDate;
                        }

                        // Cộng thêm số ngày mua 
                        const additionalMillis = parseInt(itemData.duration) * 24 * 60 * 60 * 1000;
                        const newExpireDate = new Date(currentExpire + additionalMillis);

                        updates[`temp_items.sun_pack`] = newExpireDate;
                        updates[`item_settings.sun_pack`] = true; // Mặc định bật
                    } else {
                        // Vĩnh viễn -> Thêm vào inventory
                        updates.inventory = arrayUnion(itemData.itemCode);
                        updates[`item_settings.sun_pack`] = true;
                    }
                } else {
                    // Vật phẩm khác -> Thêm vào mảng inventory
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
        const userSnap = await getDoc(doc(db, "users", uid));
        const userData = userSnap.exists() ? userSnap.data() : null;

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

// --- HÀM TRỪ ITEM KHI SỬ DỤNG TRONG GAME ---
export async function useGameItem(uid, itemCode) {
    try {
        const userRef = doc(db, "users", uid);
        
        if (itemCode === 'plant_food') {
            await updateDoc(userRef, { 
                item_plant_food_count: increment(-1) 
            });
        }
        
        console.log(`Đã dùng 1 ${itemCode} và đồng bộ lên server.`);
    } catch (error) {
        console.error("Lỗi đồng bộ item:", error);
    }
}