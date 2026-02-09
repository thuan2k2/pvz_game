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
    
    // [FIX] Thêm tham số buộc Google hiện popup chọn tài khoản
    // Tránh lỗi 'auth/popup-closed-by-user' do trình duyệt tự đóng popup
    provider.setCustomParameters({
        prompt: 'select_account'
    });

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
                item_broadcast_count: 0, 
                broadcast_queue: [], 
                inventory: [],
                createdAt: new Date()
            });
        }
        return user;
    } catch (error) {
        console.error("Lỗi đăng nhập Google:", error);
        
        // Xử lý các mã lỗi phổ biến của Popup
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error("Bạn đã tắt cửa sổ đăng nhập.");
        }
        if (error.code === 'auth/cancelled-popup-request') {
            // Lỗi này xảy ra khi user click nhiều lần, có thể bỏ qua
            console.warn("Popup bị hủy do yêu cầu mới.");
            return null; 
        }
        if (error.code === 'auth/popup-blocked') {
            throw new Error("Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng tắt chặn Pop-up.");
        }
        
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
            item_broadcast_count: 0, 
            broadcast_queue: [], 
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

// --- 2. [CẬP NHẬT] HÀM MUA ĐỒ SHOP (THÊM LOGIC TẶNG THẺ ĐẠI GIA) ---
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

            // B. CHUẨN BỊ DỮ LIỆU CẬP NHẬT CƠ BẢN
            let updates = {
                [currencyField]: newBalance 
            };

            // [MỚI] LOGIC TẶNG THẺ ĐẠI GIA (NẾU ĐƠN >= 400.000 VNCoin)
            if (itemData.currency === 'VNCoin' && price >= 400000) {
                updates.item_broadcast_count = increment(1); 
                const uniquePackName = `${itemData.name}#${Date.now()}`;
                updates.broadcast_queue = arrayUnion(uniquePackName);
            }

            // C. XỬ LÝ "GIAO HÀNG" 
            if (itemData.type === 'coin') {
                updates.coins = increment(parseInt(itemData.value));
            } 
            else if (itemData.type === 'item') {
                if (itemData.itemCode === 'plant_food') {
                    updates.item_plant_food_count = increment(parseInt(itemData.amount || 1));
                } else if (itemData.itemCode === 'sun_pack') {
                    if (itemData.duration && itemData.duration !== 99999) {
                        const now = new Date().getTime();
                        let currentExpire = now;
                        if (userData.temp_items && userData.temp_items.sun_pack) {
                            const oldDate = userData.temp_items.sun_pack.toMillis();
                            if (oldDate > now) currentExpire = oldDate;
                        }
                        const additionalMillis = parseInt(itemData.duration) * 24 * 60 * 60 * 1000;
                        const newExpireDate = new Date(currentExpire + additionalMillis);
                        updates[`temp_items.sun_pack`] = newExpireDate;
                        updates[`item_settings.sun_pack`] = true;
                    } else {
                        updates.inventory = arrayUnion(itemData.itemCode);
                        updates[`item_settings.sun_pack`] = true;
                    }
                } else {
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

// --- [MỚI] HÀM SỬ DỤNG THẺ ĐẠI GIA ---
export async function useBigSpenderCard(uid, email) {
    const userRef = doc(db, "users", uid);
    
    try {
        await runTransaction(db, async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw "Lỗi user";
            const data = userSnap.data();

            if (!data.item_broadcast_count || data.item_broadcast_count <= 0) {
                throw "Bạn không có Thẻ Đại Gia!";
            }

            // Lấy tên gói hàng từ hàng đợi
            let packageName = "Gói Bí Ẩn";
            let newQueue = data.broadcast_queue || [];
            
            if (newQueue.length > 0) {
                const rawName = newQueue[0];
                packageName = rawName.split('#')[0]; 
                newQueue.shift(); 
            } else {
                packageName = "Vật Phẩm Giá Trị Liên Thành";
            }

            // Cập nhật User
            transaction.update(userRef, {
                item_broadcast_count: increment(-1),
                broadcast_queue: newQueue
            });

            // Ghi vào bảng thông báo Server
            const broadcastRef = doc(collection(db, "server_broadcasts"));
            transaction.set(broadcastRef, {
                sender: email,
                packageName: packageName,
                message: `${email} đã Vung tay Bạc Tỷ cho gói "${packageName}". Cả Sever phải Ngước nhìn độ Hào nhoáng Bá vương đi nào!`,
                timestamp: serverTimestamp()
            });
        });
        return { success: true };
    } catch (error) {
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